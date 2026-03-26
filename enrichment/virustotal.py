"""
VirusTotal IOC enrichment – Phase 4.

Extracts IOCs (IPs, domains, file hashes) from normalised alerts and queries
the VirusTotal API v3 for reputation data before Claude triages them.
"""

from __future__ import annotations

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from config.settings import VIRUSTOTAL_API_KEY, VIRUSTOTAL_ENABLED
from models.alert import Alert

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────
VT_BASE = "https://www.virustotal.com/api/v3"

# Free-tier: 4 requests/min → 15 s between requests keeps us safely under.
_RATE_LIMIT_DELAY: float = 15.0

# Patterns for IOC extraction
_SHA256_RE = re.compile(r"\b[A-Fa-f0-9]{64}\b")
_SHA1_RE = re.compile(r"\b[A-Fa-f0-9]{40}\b")
_MD5_RE = re.compile(r"\b[A-Fa-f0-9]{32}\b")
_DOMAIN_RE = re.compile(
    r"\b((?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+"
    r"(?:[a-zA-Z]{2,}))\b"
)
_IPV4_RE = re.compile(
    r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}"
    r"(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
)

# Defanged IOC patterns (e.g. xfer-cdn-node9[.]com)
_DEFANGED_DOMAIN_RE = re.compile(
    r"\b((?:[a-zA-Z0-9](?:[a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\[\.\])+"
    r"(?:[a-zA-Z]{2,}))\b"
)

# Skip RFC-1918, loopback, and link-local IPs — they aren't useful for VT.
_PRIVATE_IP_RE = re.compile(
    r"^(?:10\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|127\.|169\.254\.)"
)

# File extensions that get falsely matched as domains (case-insensitive check)
_FILE_EXTENSIONS = frozenset({
    "exe", "dll", "sys", "bat", "cmd", "ps1", "vbs", "js", "msi", "scr",
    "com", "pif", "cpl", "inf", "reg", "tmp", "log", "cfg", "ini", "dat",
    "db", "bak", "old", "lnk", "doc", "docx", "xls", "xlsx", "pdf", "zip",
    "rar", "7z", "tar", "gz", "iso", "img", "bin", "xml", "json", "csv",
    "txt", "rtf", "html", "htm", "py", "rb", "pl", "sh", "yaml", "yml",
    "conf", "config", "evtx", "etl", "dmp",
})

# Valid public TLDs we actually care about for IOC extraction.
_VALID_TLDS = frozenset({
    # Generic
    "com", "net", "org", "io", "info", "biz", "co", "me", "tv", "cc",
    "us", "xyz", "top", "site", "online", "club", "app", "dev", "cloud",
    "pro", "tech", "store", "shop", "live", "life", "world", "today",
    "space", "fun", "website", "link", "click", "win", "bid", "trade",
    "stream", "download", "racing", "review", "date", "science",
    # Country codes commonly seen in threats
    "ru", "cn", "tk", "ml", "ga", "cf", "gq", "pw", "su", "ir", "kp",
    "br", "de", "uk", "fr", "nl", "in", "au", "ca", "za", "ua", "ro",
    "cz", "pl", "se", "no", "fi", "dk", "it", "es", "pt", "be", "at",
    "ch", "jp", "kr", "tw", "sg", "hk", "mx", "ar", "cl", "nz",
    # Infrastructure
    "edu", "gov", "mil", "int",
})

# Internal / non-routable domain suffixes to skip.
_INTERNAL_SUFFIXES = frozenset({
    "local", "internal", "lan", "corp", "home", "localdomain", "intranet",
    "private", "test", "example", "invalid", "localhost",
})


def _validate_ioc(value: str, ioc_type: str) -> bool:
    """Validate an IOC value before querying VirusTotal.

    Rejects empty values, oversized strings, path traversal sequences,
    null bytes, and values that do not match the expected type pattern.
    """
    if not value or len(value) > 256:
        return False
    # Reject path traversal attempts
    if ".." in value or "/" in value or "\\" in value:
        return False
    # Reject null bytes
    if "\x00" in value:
        return False
    # Type-specific validation against the same compiled patterns used for extraction
    if ioc_type == "ip":
        return bool(_IPV4_RE.fullmatch(value))
    if ioc_type == "domain":
        return bool(_DOMAIN_RE.fullmatch(value))
    if ioc_type == "hash":
        return bool(
            _SHA256_RE.fullmatch(value)
            or _SHA1_RE.fullmatch(value)
            or _MD5_RE.fullmatch(value)
        )
    return False


# ── Data classes ─────────────────────────────────────────────────────────────
@dataclass
class EnrichmentResult:
    """Reputation data for a single IOC from VirusTotal."""

    ioc_value: str
    ioc_type: str  # "ip", "domain", "hash"
    malicious_count: int = 0
    suspicious_count: int = 0
    total_engines: int = 0
    verdict: str = "UNKNOWN"  # MALICIOUS | SUSPICIOUS | CLEAN | UNKNOWN
    tags: list[str] = field(default_factory=list)
    last_seen: str = ""

    # ── Serialisation ─────────────────────────────────────────────────────
    def to_dict(self) -> dict[str, Any]:
        return {
            "ioc_value": self.ioc_value,
            "ioc_type": self.ioc_type,
            "malicious_count": self.malicious_count,
            "suspicious_count": self.suspicious_count,
            "total_engines": self.total_engines,
            "verdict": self.verdict,
            "tags": self.tags,
            "last_seen": self.last_seen,
        }

    def to_prompt_context(self) -> str:
        """One-line summary suitable for injection into the triage prompt."""
        return (
            f"[VT] {self.ioc_type.upper()} {self.ioc_value} → {self.verdict} "
            f"({self.malicious_count}/{self.total_engines} engines flagged malicious, "
            f"{self.suspicious_count} suspicious)"
            + (f" | tags: {', '.join(self.tags)}" if self.tags else "")
            + (f" | last seen: {self.last_seen}" if self.last_seen else "")
        )


# ── IOC extraction ───────────────────────────────────────────────────────────
def _refang_domain(domain: str) -> str:
    """Convert defanged notation back to a real domain: evil[.]com → evil.com."""
    return domain.replace("[.]", ".")


def _is_valid_domain(domain: str) -> bool:
    """Return True only for genuine public domain names worth querying VT for.

    Rejects filenames (foo.exe), internal hostnames (DC01.internal),
    single-label names, and domains whose TLD isn't in our allowlist.
    """
    parts = domain.rsplit(".", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        return False

    tld = parts[1].lower()
    name = parts[0]

    # Reject internal / non-routable suffixes
    if tld in _INTERNAL_SUFFIXES:
        return False

    # Must have a recognised public TLD
    if tld not in _VALID_TLDS:
        return False

    # Reject file extensions masquerading as TLDs, but only when the TLD
    # is ambiguous (e.g. "com", "bat") AND the name portion looks like a
    # bare filename (no dots, i.e. single-label like "payload.exe").
    # Multi-label names like "xfer-cdn-node9.com" are real domains.
    if tld in _FILE_EXTENSIONS and "." not in name:
        # Single-label + ambiguous TLD: likely a filename (e.g. "svchost.exe")
        # unless the name is clearly a plausible domain (contains hyphens or
        # is longer than a typical filename stem).
        if len(name) <= 15 and "-" not in name:
            return False

    return True


def extract_iocs(alert: Alert) -> dict[str, str]:
    """Return a dict mapping IOC value → IOC type from the alert.

    Extracts IPs, domains, and file hashes from structured fields and the
    raw JSON blob, deduplicating as we go.
    """
    iocs: dict[str, str] = {}

    # Structured IP fields (skip private / empty)
    for ip in (alert.source_ip, alert.dest_ip):
        if ip and not _PRIVATE_IP_RE.match(ip):
            iocs[ip] = "ip"

    # Walk the raw dict for string values
    text_blob = json.dumps(alert.raw, default=str) if alert.raw else ""
    text_blob += " " + alert.description

    # File hashes (longest first to avoid partial matches)
    sha256_hashes = set(_SHA256_RE.findall(text_blob))
    for h in sha256_hashes:
        iocs[h] = "hash"

    for h in _SHA1_RE.findall(text_blob):
        # Skip if this is a substring of any SHA-256 hash
        if h not in iocs and not any(h in s256 for s256 in sha256_hashes):
            iocs[h] = "hash"

    for h in _MD5_RE.findall(text_blob):
        if h not in iocs and not any(h in s256 for s256 in sha256_hashes):
            # Also check against SHA-1 matches already recorded
            sha1_hashes = set(k for k, v in iocs.items() if v == "hash" and len(k) == 40)
            if not any(h in s1 for s1 in sha1_hashes):
                iocs[h] = "hash"

    # Domains (strict filtering to avoid filenames, usernames, hostnames)
    for d in _DEFANGED_DOMAIN_RE.findall(text_blob):
        real = _refang_domain(d)
        if _is_valid_domain(real):
            iocs[real] = "domain"
    for d in _DOMAIN_RE.findall(text_blob):
        if _is_valid_domain(d):
            iocs[d] = "domain"

    # Public IPs found in free text (supplement the structured fields)
    for ip in _IPV4_RE.findall(text_blob):
        if ip not in iocs and not _PRIVATE_IP_RE.match(ip):
            iocs[ip] = "ip"

    return iocs


# ── VirusTotal API calls ────────────────────────────────────────────────────
def _vt_request(endpoint: str) -> dict[str, Any] | None:
    """Perform a single GET against the VT v3 API. Returns parsed JSON or None."""
    url = f"{VT_BASE}/{endpoint}"
    req = Request(url, headers={
        "x-apikey": VIRUSTOTAL_API_KEY,
        "Accept": "application/json",
    })

    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except HTTPError as exc:
        if exc.code == 404:
            logger.info("VT: no data for %s", endpoint)
        elif exc.code == 429:
            logger.warning("VT: rate-limited on %s – skipping", endpoint)
        else:
            logger.warning("VT: HTTP %s for %s", exc.code, endpoint)
        return None
    except (URLError, OSError) as exc:
        logger.error("VT: network error for %s: %s", endpoint, exc)
        return None


def _parse_analysis_stats(
    data: dict[str, Any], ioc_value: str, ioc_type: str
) -> EnrichmentResult:
    """Build an EnrichmentResult from VT's last_analysis_stats structure."""
    attrs = data.get("data", {}).get("attributes", {})
    stats = attrs.get("last_analysis_stats", {})

    malicious = stats.get("malicious", 0)
    suspicious = stats.get("suspicious", 0)
    harmless = stats.get("harmless", 0)
    undetected = stats.get("undetected", 0)
    total = malicious + suspicious + harmless + undetected

    # Derive verdict
    if malicious >= 5:
        verdict = "MALICIOUS"
    elif malicious >= 1 or suspicious >= 3:
        verdict = "SUSPICIOUS"
    elif total > 0:
        verdict = "CLEAN"
    else:
        verdict = "UNKNOWN"

    tags = attrs.get("tags", [])
    last_seen = attrs.get("last_analysis_date", "")
    if isinstance(last_seen, int):
        # VT returns epoch seconds
        from datetime import datetime, timezone
        last_seen = datetime.fromtimestamp(last_seen, tz=timezone.utc).isoformat()

    return EnrichmentResult(
        ioc_value=ioc_value,
        ioc_type=ioc_type,
        malicious_count=malicious,
        suspicious_count=suspicious,
        total_engines=total,
        verdict=verdict,
        tags=tags[:10],  # cap to avoid prompt bloat
        last_seen=str(last_seen),
    )


def _lookup_ip(ip: str) -> EnrichmentResult:
    if not _validate_ioc(ip, "ip"):
        logger.warning("Invalid IOC rejected: %s", ip)
        return EnrichmentResult(ioc_value=ip, ioc_type="ip")
    data = _vt_request(f"ip_addresses/{ip}")
    if data is None:
        return EnrichmentResult(ioc_value=ip, ioc_type="ip")
    return _parse_analysis_stats(data, ip, "ip")


def _lookup_domain(domain: str) -> EnrichmentResult:
    if not _validate_ioc(domain, "domain"):
        logger.warning("Invalid IOC rejected: %s", domain)
        return EnrichmentResult(ioc_value=domain, ioc_type="domain")
    data = _vt_request(f"domains/{domain}")
    if data is None:
        return EnrichmentResult(ioc_value=domain, ioc_type="domain")
    return _parse_analysis_stats(data, domain, "domain")


def _lookup_hash(file_hash: str) -> EnrichmentResult:
    if not _validate_ioc(file_hash, "hash"):
        logger.warning("Invalid IOC rejected: %s", file_hash)
        return EnrichmentResult(ioc_value=file_hash, ioc_type="hash")
    data = _vt_request(f"files/{file_hash}")
    if data is None:
        return EnrichmentResult(ioc_value=file_hash, ioc_type="hash")
    return _parse_analysis_stats(data, file_hash, "hash")


_LOOKUP = {
    "ip": _lookup_ip,
    "domain": _lookup_domain,
    "hash": _lookup_hash,
}


# ── Public API ───────────────────────────────────────────────────────────────
def enrich_alert(alert: Alert) -> list[EnrichmentResult]:
    """Extract IOCs from an alert and look each up against VirusTotal.

    Returns an empty list (without crashing) when enrichment is disabled
    or the API key is missing.
    """
    if not VIRUSTOTAL_ENABLED:
        logger.debug("VirusTotal enrichment disabled – skipping.")
        return []

    if not VIRUSTOTAL_API_KEY:
        logger.warning("VIRUSTOTAL_API_KEY not configured – skipping enrichment.")
        return []

    iocs = extract_iocs(alert)
    if not iocs:
        logger.info("No external IOCs found in alert %s", alert.id)
        return []

    logger.info(
        "Enriching alert %s – %d IOC(s): %s",
        alert.id,
        len(iocs),
        ", ".join(iocs.keys()),
    )

    results: list[EnrichmentResult] = []
    for idx, (value, ioc_type) in enumerate(iocs.items()):
        # Rate-limit: pause between requests (skip delay before the first one)
        if idx > 0:
            logger.debug("Rate-limit delay (%.0fs) …", _RATE_LIMIT_DELAY)
            time.sleep(_RATE_LIMIT_DELAY)

        lookup_fn = _LOOKUP.get(ioc_type)
        if lookup_fn is None:
            continue

        try:
            result = lookup_fn(value)
            results.append(result)
            logger.info(
                "VT result for %s (%s): %s (%d/%d malicious)",
                value,
                ioc_type,
                result.verdict,
                result.malicious_count,
                result.total_engines,
            )
        except Exception:
            logger.exception("VT lookup failed for %s", value)
            results.append(EnrichmentResult(ioc_value=value, ioc_type=ioc_type))

    return results


def format_enrichment_summary(results: list[EnrichmentResult]) -> str:
    """Render enrichment results as a text block for reports and notifications."""
    if not results:
        return ""

    lines = ["  IOC Enrichment (VirusTotal):"]
    for r in results:
        flag = {"MALICIOUS": "!!", "SUSPICIOUS": "! ", "CLEAN": "  ", "UNKNOWN": "? "}
        prefix = flag.get(r.verdict, "? ")
        lines.append(
            f"    {prefix} {r.ioc_type.upper():6s} {r.ioc_value} → "
            f"{r.verdict} ({r.malicious_count}/{r.total_engines} malicious)"
        )
    return "\n".join(lines)
