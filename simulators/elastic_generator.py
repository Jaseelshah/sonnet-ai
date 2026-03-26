"""
elastic_generator.py — Sentinel AI Phase 6: Virtualized SIEM Connector

Generates realistic ECS-compliant security alerts and indexes them into
Elasticsearch at a configurable cadence, simulating a live SIEM producing
alerts for the Sentinel AI triage pipeline to consume.

Usage:
    python simulators/elastic_generator.py

Environment variables (can also be set in project-root .env):
    ELASTIC_URL       — Elasticsearch base URL (default: http://localhost:9200)
    ELASTIC_USERNAME  — Optional HTTP Basic username
    ELASTIC_PASSWORD  — Optional HTTP Basic password
    ELASTIC_INDEX     — Index to write into (default: sonnet-ai-alerts)

The script runs indefinitely, writing 1-3 alerts every 30 seconds.
Stop it with Ctrl+C.
"""

from __future__ import annotations

import random
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Environment loading — shared utility in scripts/env_utils.py
# ---------------------------------------------------------------------------

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.env_utils import load_dotenv  # noqa: E402

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_PROJECT_ROOT / ".env")

import os  # noqa: E402 — must come after dotenv load

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ELASTIC_URL: str = os.getenv("ELASTIC_URL", "http://localhost:9200")
ELASTIC_USERNAME: str = os.getenv("ELASTIC_USERNAME", "")
ELASTIC_PASSWORD: str = os.getenv("ELASTIC_PASSWORD", "")
ELASTIC_INDEX: str = os.getenv("ELASTIC_INDEX", "sonnet-ai-alerts")

CYCLE_INTERVAL_SECONDS: int = 30
MIN_ALERTS_PER_CYCLE: int = 1
MAX_ALERTS_PER_CYCLE: int = 3

# ---------------------------------------------------------------------------
# Realistic data pools
# ---------------------------------------------------------------------------

_INTERNAL_IPS: list[str] = [
    # 10.0.0.0/8
    "10.0.1.15", "10.0.1.22", "10.0.2.101", "10.0.3.55", "10.0.4.200",
    "10.0.5.88", "10.0.10.14", "10.0.10.75", "10.0.20.33", "10.0.50.9",
    "10.1.0.5", "10.1.1.200", "10.2.3.17", "10.5.0.8", "10.10.10.1",
    # 172.16.0.0/12
    "172.16.0.10", "172.16.1.50", "172.16.2.99", "172.16.5.14",
    "172.17.0.3", "172.20.10.22", "172.25.5.77", "172.30.0.45",
]

# RFC 5737 documentation addresses — TEST-NET-1/2/3 (192.0.2.0/24,
# 198.51.100.0/24, 203.0.113.0/24).  Never routed on the public Internet.
_EXTERNAL_IPS: list[str] = [
    # TEST-NET-1 (192.0.2.0/24)
    "192.0.2.1",   "192.0.2.14",  "192.0.2.33",  "192.0.2.57",
    "192.0.2.88",  "192.0.2.102", "192.0.2.145",
    # TEST-NET-2 (198.51.100.0/24)
    "198.51.100.4",  "198.51.100.19", "198.51.100.38",
    "198.51.100.77", "198.51.100.99", "198.51.100.200",
    # TEST-NET-3 (203.0.113.0/24)
    "203.0.113.5",  "203.0.113.22", "203.0.113.47",
    "203.0.113.91", "203.0.113.130","203.0.113.199",
]

_USERNAMES: list[str] = [
    "jsmith", "admin", "svc-backup", "da-admin", "j.doe", "m.johnson",
    "helpdesk", "sql-svc", "a.patel", "l.chen", "r.garcia", "svc-deploy",
    "backup-agent", "svc-monitoring", "t.williams", "k.nguyen", "root",
    "administrator", "svc-exchange", "svc-ad-sync",
]

_WINDOWS_HOSTS: list[str] = [
    "DC01", "DC02", "WS-PC1042", "WS-PC0087", "MAIL-SRV", "FILE-SRV01",
    "FILE-SRV02", "DB-PROD-03", "LAPTOP-HR-012", "LAPTOP-FIN-007",
    "APP-SRV-01", "APP-SRV-02", "PRINT-SRV", "WS-DEV-033", "BACKUP-SRV",
    "MGMT-SRV01", "CITRIX-GW", "RDP-GATEWAY", "WSUS-SRV", "WS-EXEC-001",
]

_LINUX_HOSTS: list[str] = [
    "web-prod-01", "web-prod-02", "api-gateway", "db-primary", "db-replica",
    "k8s-node-01", "k8s-node-02", "bastion-host", "log-aggregator",
    "monitoring-01", "ci-runner-03", "vault-server", "kafka-broker-01",
    "redis-cache", "elastic-node-01",
]

_PROTOCOL_PORTS: dict[str, int] = {
    "dns": 53,
    "http": 80,
    "https": 443,
    "smb": 445,
    "rdp": 3389,
    "ssh": 22,
    "ldap": 389,
    "ldaps": 636,
    "winrm": 5985,
    "kerberos": 88,
    "ftp": 21,
    "mssql": 1433,
    "mysql": 3306,
}

# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _now_with_jitter() -> datetime:
    """Return UTC now offset by a random ±0-60 second jitter."""
    jitter = random.randint(-60, 60)
    return datetime.now(timezone.utc) + timedelta(seconds=jitter)


def _iso(dt: datetime) -> str:
    """Format a datetime as ISO 8601 with millisecond precision."""
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _random_internal_ip() -> str:
    return random.choice(_INTERNAL_IPS)


def _random_external_ip() -> str:
    return random.choice(_EXTERNAL_IPS)


def _random_high_port() -> int:
    return random.randint(49152, 65535)


def _random_pid() -> int:
    return random.randint(512, 65535)


def _random_host(os_family: str) -> str:
    if os_family == "windows":
        return random.choice(_WINDOWS_HOSTS)
    return random.choice(_LINUX_HOSTS)


# ---------------------------------------------------------------------------
# Attack-type alert template builders
# Each function returns a dict ready for Elasticsearch indexing.
# ---------------------------------------------------------------------------

def _build_brute_force() -> dict[str, Any]:
    """Multiple failed logins from same source IP targeting different accounts."""
    username = random.choice(_USERNAMES)
    src_ip = _random_external_ip()
    dst_host = _random_host("windows")
    attempt_count = random.randint(15, 200)
    return {
        "@timestamp": _iso(_now_with_jitter()),
        "event.kind": "signal",
        "event.category": "authentication",
        "event.type": "denied",
        "event.action": "logon-failed",
        "source.ip": src_ip,
        "source.port": _random_high_port(),
        "destination.ip": _random_internal_ip(),
        "destination.port": _PROTOCOL_PORTS["ldaps"],
        "user.name": username,
        "host.name": dst_host,
        "host.os.family": "windows",
        "process.name": "lsass.exe",
        "process.pid": _random_pid(),
        "rule.name": "Brute Force - Multiple Failed Authentications",
        "rule.id": "auth-001",
        "kibana.alert.severity": "high",
        "kibana.alert.rule.category": "Credential Access",
        "kibana.alert.rule.description": (
            f"Detected {attempt_count} consecutive authentication failures "
            f"from {src_ip} targeting account '{username}' on {dst_host}. "
            "Pattern is consistent with a brute-force or credential stuffing attack."
        ),
        "kibana.alert.uuid": str(uuid.uuid4()),
    }


def _build_lateral_movement() -> dict[str, Any]:
    """PsExec / WMI / SMB connections between internal hosts."""
    tools = ["psexec.exe", "wmic.exe", "net.exe", "sc.exe", "schtasks.exe"]
    protocols = ["SMB", "WMI", "RPC"]
    protocol = random.choice(protocols)
    src_host = _random_host("windows")
    dst_host = _random_host("windows")
    username = random.choice(_USERNAMES)
    return {
        "@timestamp": _iso(_now_with_jitter()),
        "event.kind": "signal",
        "event.category": "network",
        "event.type": "connection",
        "event.action": "connection-attempted",
        "source.ip": _random_internal_ip(),
        "source.port": _random_high_port(),
        "destination.ip": _random_internal_ip(),
        "destination.port": _PROTOCOL_PORTS["smb"],
        "user.name": username,
        "host.name": src_host,
        "host.os.family": "windows",
        "process.name": random.choice(tools),
        "process.pid": _random_pid(),
        "rule.name": f"Lateral Movement - {protocol} Admin Tool Execution",
        "rule.id": "lat-002",
        "kibana.alert.severity": "high",
        "kibana.alert.rule.category": "Lateral Movement",
        "kibana.alert.rule.description": (
            f"Suspicious {protocol} activity detected from {src_host} to {dst_host} "
            f"under account '{username}'. Remote admin tooling associated with "
            "lateral movement (T1021) observed in process chain."
        ),
        "kibana.alert.uuid": str(uuid.uuid4()),
    }


def _build_privilege_escalation() -> dict[str, Any]:
    """Token manipulation, sudo abuse, UAC bypass."""
    techniques = [
        ("token-manipulation", "windows", "Token impersonation via SeImpersonatePrivilege abuse on {host}"),
        ("uac-bypass", "windows", "UAC bypass attempt detected via CMSTPLUA COM interface on {host}"),
        ("sudo-abuse", "linux", "Unusual sudo invocation outside business hours on {host}"),
    ]
    technique_action, os_family, desc_tpl = random.choice(techniques)
    host = _random_host(os_family)
    username = random.choice(_USERNAMES)
    priv_processes = {
        "windows": ["lsass.exe", "services.exe", "svchost.exe", "cmd.exe", "powershell.exe"],
        "linux": ["sudo", "su", "pkexec", "bash", "python3"],
    }
    return {
        "@timestamp": _iso(_now_with_jitter()),
        "event.kind": "signal",
        "event.category": "process",
        "event.type": "start",
        "event.action": technique_action,
        "source.ip": _random_internal_ip(),
        "source.port": _random_high_port(),
        "destination.ip": _random_internal_ip(),
        "destination.port": _PROTOCOL_PORTS["winrm"] if os_family == "windows" else _PROTOCOL_PORTS["ssh"],
        "user.name": username,
        "host.name": host,
        "host.os.family": os_family,
        "process.name": random.choice(priv_processes[os_family]),
        "process.pid": _random_pid(),
        "rule.name": "Privilege Escalation - Suspicious Privilege Gain",
        "rule.id": "priv-003",
        "kibana.alert.severity": "critical",
        "kibana.alert.rule.category": "Privilege Escalation",
        "kibana.alert.rule.description": desc_tpl.format(host=host) + f" by user '{username}'.",
        "kibana.alert.uuid": str(uuid.uuid4()),
    }


def _build_data_exfiltration() -> dict[str, Any]:
    """Large outbound transfers to external IPs over DNS or HTTPS."""
    channels = [
        ("dns-tunneling", "dns", "DNS tunneling exfiltration via high-volume TXT record queries"),
        ("https-exfil", "https", "Anomalous HTTPS POST volume to uncategorised external host"),
    ]
    channel_action, protocol_key, desc = random.choice(channels)
    dst_ip = _random_external_ip()
    src_host = _random_host(random.choice(["windows", "linux"]))
    os_family = "windows" if src_host in _WINDOWS_HOSTS else "linux"
    bytes_out = random.randint(50_000_000, 2_000_000_000)
    return {
        "@timestamp": _iso(_now_with_jitter()),
        "event.kind": "signal",
        "event.category": "network",
        "event.type": "connection",
        "event.action": channel_action,
        "source.ip": _random_internal_ip(),
        "source.port": _random_high_port(),
        "destination.ip": dst_ip,
        "destination.port": _PROTOCOL_PORTS[protocol_key],
        "user.name": random.choice(_USERNAMES),
        "host.name": src_host,
        "host.os.family": os_family,
        "process.name": "svchost.exe" if os_family == "windows" else "curl",
        "process.pid": _random_pid(),
        "rule.name": "Data Exfiltration - Anomalous Outbound Transfer",
        "rule.id": "exfil-004",
        "kibana.alert.severity": "critical",
        "kibana.alert.rule.category": "Exfiltration",
        "kibana.alert.rule.description": (
            f"{desc}. {bytes_out / 1_048_576:.1f} MB transferred outbound "
            f"from {src_host} to external host {dst_ip}. "
            "Exceeds baseline threshold by 3+ standard deviations."
        ),
        "kibana.alert.uuid": str(uuid.uuid4()),
    }


def _build_malware_execution() -> dict[str, Any]:
    """Suspicious executables, known malware hashes, unsigned binaries."""
    malware_samples = [
        ("cobalt-strike-beacon", "beacon.exe", "CobaltStrike beacon implant detected via memory signature"),
        ("meterpreter-stager", "svchost32.exe", "Meterpreter stager identified by network callback pattern"),
        ("ransomware-precursor", "vssadmin.exe", "Shadow copy deletion preceding ransomware deployment"),
        ("trojan-dropper", "winupd.exe", "Unsigned binary masquerading as Windows Update component"),
        ("mimikatz-variant", "mimi.exe", "Credential-dumping tool with known Mimikatz signature"),
    ]
    mal_action, proc_name, desc = random.choice(malware_samples)
    host = _random_host("windows")
    return {
        "@timestamp": _iso(_now_with_jitter()),
        "event.kind": "signal",
        "event.category": "process",
        "event.type": "start",
        "event.action": mal_action,
        "source.ip": _random_internal_ip(),
        "source.port": _random_high_port(),
        "destination.ip": _random_external_ip(),
        "destination.port": random.choice([80, 443, 8080, 4444, 1337]),
        "user.name": random.choice(_USERNAMES),
        "host.name": host,
        "host.os.family": "windows",
        "process.name": proc_name,
        "process.pid": _random_pid(),
        "rule.name": "Malware - Suspicious Executable Detected",
        "rule.id": "mal-005",
        "kibana.alert.severity": "critical",
        "kibana.alert.rule.category": "Execution",
        "kibana.alert.rule.description": (
            f"{desc} on {host}. Binary is unsigned and not present "
            "in the approved software inventory. Immediate containment recommended."
        ),
        "kibana.alert.uuid": str(uuid.uuid4()),
    }


def _build_port_scanning() -> dict[str, Any]:
    """Connection attempts to multiple ports from single source."""
    src_ip = random.choice([_random_external_ip(), _random_internal_ip()])
    target_ip = _random_internal_ip()
    port_count = random.randint(200, 65000)
    scan_types = ["SYN", "XMAS", "FIN", "NULL", "ACK"]
    scan_type = random.choice(scan_types)
    return {
        "@timestamp": _iso(_now_with_jitter()),
        "event.kind": "signal",
        "event.category": "network",
        "event.type": "connection",
        "event.action": "port-scan-detected",
        "source.ip": src_ip,
        "source.port": _random_high_port(),
        "destination.ip": target_ip,
        "destination.port": random.randint(1, 1024),
        "user.name": "",
        "host.name": _random_host("linux"),
        "host.os.family": "linux",
        "process.name": "firewalld",
        "process.pid": _random_pid(),
        "rule.name": f"Discovery - {scan_type} Port Scan Detected",
        "rule.id": "disc-006",
        "kibana.alert.severity": "medium",
        "kibana.alert.rule.category": "Discovery",
        "kibana.alert.rule.description": (
            f"{scan_type} scan originating from {src_ip} probed "
            f"{port_count} ports on {target_ip} within a 60-second window. "
            "Consistent with automated network reconnaissance (T1046)."
        ),
        "kibana.alert.uuid": str(uuid.uuid4()),
    }


def _build_suspicious_powershell() -> dict[str, Any]:
    """Encoded commands, download cradles, AMSI bypass."""
    techniques = [
        (
            "amsi-bypass",
            "Attempt to patch AMSI via reflection detected in PowerShell process memory",
        ),
        (
            "download-cradle",
            "IEX download cradle executing remote script via Invoke-Expression",
        ),
        (
            "encoded-command",
            "Base64-encoded PowerShell command exceeding entropy threshold",
        ),
        (
            "constrained-language-bypass",
            "PowerShell Constrained Language Mode bypass via runspace manipulation",
        ),
    ]
    ps_action, desc = random.choice(techniques)
    host = _random_host("windows")
    parent_processes = ["winword.exe", "excel.exe", "outlook.exe", "cmd.exe", "wscript.exe"]
    return {
        "@timestamp": _iso(_now_with_jitter()),
        "event.kind": "signal",
        "event.category": "process",
        "event.type": "start",
        "event.action": ps_action,
        "source.ip": _random_internal_ip(),
        "source.port": _random_high_port(),
        "destination.ip": _random_external_ip(),
        "destination.port": _PROTOCOL_PORTS["https"],
        "user.name": random.choice(_USERNAMES),
        "host.name": host,
        "host.os.family": "windows",
        "process.name": "powershell.exe",
        "process.pid": _random_pid(),
        "rule.name": "Suspicious PowerShell - Evasion Technique Detected",
        "rule.id": "ps-007",
        "kibana.alert.severity": "high",
        "kibana.alert.rule.category": "Execution",
        "kibana.alert.rule.description": (
            f"{desc} on {host}. "
            f"Spawned by {random.choice(parent_processes)}. "
            "Consistent with living-off-the-land technique T1059.001."
        ),
        "kibana.alert.uuid": str(uuid.uuid4()),
    }


def _build_failed_mfa() -> dict[str, Any]:
    """Multiple MFA challenge failures suggesting token theft attempt."""
    username = random.choice(_USERNAMES)
    src_ip = _random_external_ip()
    failure_count = random.randint(5, 30)
    providers = ["Azure AD MFA", "Duo Security", "Okta Verify", "Google Authenticator"]
    provider = random.choice(providers)
    return {
        "@timestamp": _iso(_now_with_jitter()),
        "event.kind": "signal",
        "event.category": "authentication",
        "event.type": "denied",
        "event.action": "mfa-challenge-failed",
        "source.ip": src_ip,
        "source.port": _random_high_port(),
        "destination.ip": _random_internal_ip(),
        "destination.port": _PROTOCOL_PORTS["https"],
        "user.name": username,
        "host.name": _random_host("windows"),
        "host.os.family": "windows",
        "process.name": "lsass.exe",
        "process.pid": _random_pid(),
        "rule.name": "Failed MFA - Possible Token Theft or Push Bombing",
        "rule.id": "mfa-008",
        "kibana.alert.severity": "medium",
        "kibana.alert.rule.category": "Credential Access",
        "kibana.alert.rule.description": (
            f"{failure_count} consecutive {provider} challenge failures "
            f"for account '{username}' from {src_ip}. "
            "Behaviour consistent with MFA fatigue attack or stolen session token (T1621)."
        ),
        "kibana.alert.uuid": str(uuid.uuid4()),
    }


# ---------------------------------------------------------------------------
# Attack-type registry with weighted selection
# ---------------------------------------------------------------------------

# (builder_fn, weight) — higher weight = selected more often
_ATTACK_REGISTRY: list[tuple[Any, int]] = [
    (_build_brute_force, 20),
    (_build_port_scanning, 18),
    (_build_failed_mfa, 15),
    (_build_lateral_movement, 13),
    (_build_suspicious_powershell, 12),
    (_build_data_exfiltration, 10),
    (_build_malware_execution, 8),
    (_build_privilege_escalation, 4),
]

_BUILDERS = [fn for fn, _ in _ATTACK_REGISTRY]
_WEIGHTS = [w for _, w in _ATTACK_REGISTRY]


def generate_alert() -> dict[str, Any]:
    """Select a random attack type (weighted) and return a generated alert dict."""
    builder = random.choices(_BUILDERS, weights=_WEIGHTS, k=1)[0]
    alert = builder()
    # Omit user.name entirely when the builder left it blank (e.g. port scans
    # have no associated user), rather than sending an empty string to the index.
    if not alert.get("user.name"):
        alert.pop("user.name", None)
    return alert


# ---------------------------------------------------------------------------
# Elasticsearch index mapping
# ---------------------------------------------------------------------------

_INDEX_MAPPING: dict[str, Any] = {
    "mappings": {
        "properties": {
            "@timestamp": {"type": "date"},
            "event": {
                "properties": {
                    "kind": {"type": "keyword"},
                    "category": {"type": "keyword"},
                    "type": {"type": "keyword"},
                    "action": {"type": "keyword"},
                }
            },
            "source": {
                "properties": {
                    "ip": {"type": "ip"},
                    "port": {"type": "integer"},
                }
            },
            "destination": {
                "properties": {
                    "ip": {"type": "ip"},
                    "port": {"type": "integer"},
                }
            },
            "user": {
                "properties": {
                    "name": {"type": "keyword"},
                }
            },
            "host": {
                "properties": {
                    "name": {"type": "keyword"},
                    "os": {
                        "properties": {
                            "family": {"type": "keyword"},
                        }
                    },
                }
            },
            "process": {
                "properties": {
                    "name": {"type": "keyword"},
                    "pid": {"type": "integer"},
                }
            },
            "rule": {
                "properties": {
                    "name": {"type": "keyword"},
                    "id": {"type": "keyword"},
                }
            },
            "kibana": {
                "properties": {
                    "alert": {
                        "properties": {
                            "severity": {"type": "keyword"},
                            "uuid": {"type": "keyword"},
                            "rule": {
                                "properties": {
                                    "category": {"type": "keyword"},
                                    "description": {"type": "text"},
                                }
                            },
                        }
                    }
                }
            },
        }
    },
    "settings": {
        "number_of_shards": 1,
        "number_of_replicas": 0,
    },
}


# ---------------------------------------------------------------------------
# Elasticsearch client helpers
# ---------------------------------------------------------------------------

def _build_client() -> Any:
    """Construct and return an Elasticsearch client from environment config."""
    try:
        from elasticsearch import Elasticsearch
    except ImportError:
        print(
            "[ERROR] The 'elasticsearch' package is not installed.\n"
            "        Run: pip install elasticsearch",
            file=sys.stderr,
        )
        sys.exit(1)

    kwargs: dict[str, Any] = {"hosts": [ELASTIC_URL]}
    if ELASTIC_USERNAME and ELASTIC_PASSWORD:
        kwargs["basic_auth"] = (ELASTIC_USERNAME, ELASTIC_PASSWORD)

    client = Elasticsearch(**kwargs)
    return client


def _ensure_index(client: Any, index: str) -> None:
    """Create *index* with the SIEM mapping if it does not already exist."""
    try:
        if not client.indices.exists(index=index):
            client.indices.create(
                index=index,
                settings=_INDEX_MAPPING["settings"],
                mappings=_INDEX_MAPPING["mappings"],
            )
            print(f"[SETUP] Created index '{index}' with ECS mapping.")
        else:
            print(f"[SETUP] Index '{index}' already exists — skipping creation.")
    except Exception as exc:  # noqa: BLE001
        print(f"[WARN]  Could not verify/create index '{index}': {exc}", file=sys.stderr)


# ---------------------------------------------------------------------------
# Console formatting
# ---------------------------------------------------------------------------

_SEVERITY_LABELS: dict[str, str] = {
    "critical": "CRIT",
    "high": "HIGH",
    "medium": " MED",
    "low": " LOW",
}


def _print_alert_summary(alert: dict[str, Any]) -> None:
    """Print a one-line summary of a generated alert to stdout."""
    ts = alert.get("@timestamp", "")[:19].replace("T", " ")
    severity = alert.get("kibana.alert.severity", "unknown")
    label = _SEVERITY_LABELS.get(severity, severity.upper().ljust(4))
    rule = alert.get("rule.name", "Unknown Rule")
    src_ip = alert.get("source.ip", "?")
    host = alert.get("host.name", "?")
    print(f"  [{ts}] [{label}]  {rule:<55}  src={src_ip}  host={host}")


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def _index_alert(client: Any, index: str, alert: dict[str, Any]) -> bool:
    """Index a single alert document. Returns True on success."""
    try:
        client.index(index=index, document=alert)
        return True
    except Exception as exc:  # noqa: BLE001
        print(f"  [ERROR] Failed to index alert: {exc}", file=sys.stderr)
        return False


def run() -> None:
    """Entry point: connect to Elasticsearch and generate alerts in a loop."""
    print("=" * 70)
    print("  Sentinel AI — Elastic SIEM Alert Generator")
    print("=" * 70)
    print(f"  Target URL   : {ELASTIC_URL}")
    print(f"  Index        : {ELASTIC_INDEX}")
    print(f"  Cycle        : every {CYCLE_INTERVAL_SECONDS}s  ({MIN_ALERTS_PER_CYCLE}-{MAX_ALERTS_PER_CYCLE} alerts/cycle)")
    if ELASTIC_USERNAME:
        print(f"  Auth         : {ELASTIC_USERNAME} / ***")
    else:
        print("  Auth         : none (unauthenticated)")
    print("=" * 70)
    print("  Press Ctrl+C to stop.\n")

    client = _build_client()

    # Verify connectivity before entering the loop
    try:
        info = client.info()
        cluster_name = info.get("cluster_name", "unknown")
        version = info.get("version", {}).get("number", "?")
        print(f"[CONN]  Connected to cluster '{cluster_name}' (Elasticsearch {version})\n")
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Cannot reach Elasticsearch at {ELASTIC_URL}: {exc}", file=sys.stderr)
        print("        Ensure Elasticsearch is running and ELASTIC_URL is correct.", file=sys.stderr)
        sys.exit(1)

    _ensure_index(client, ELASTIC_INDEX)
    print()

    cycle = 0
    total_indexed = 0

    try:
        while True:
            cycle += 1
            count = random.randint(MIN_ALERTS_PER_CYCLE, MAX_ALERTS_PER_CYCLE)
            print(f"[CYCLE {cycle:04d}]  Generating {count} alert(s) ...")

            for _ in range(count):
                alert = generate_alert()
                success = _index_alert(client, ELASTIC_INDEX, alert)
                if success:
                    _print_alert_summary(alert)
                    total_indexed += 1

            print(f"           Total indexed so far: {total_indexed}\n")
            time.sleep(CYCLE_INTERVAL_SECONDS)

    except KeyboardInterrupt:
        print("\n" + "=" * 70)
        print(f"  Shutdown requested.  Total alerts indexed: {total_indexed}")
        print("=" * 70)


if __name__ == "__main__":
    run()
