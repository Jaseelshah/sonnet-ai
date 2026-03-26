"""
Maps MITRE ATT&CK techniques to Australian Essential Eight mitigation strategies.
"""

from __future__ import annotations

# Essential Eight controls
E8_APPLICATION_CONTROL = "Application Control"
E8_PATCH_APPLICATIONS = "Patch Applications"
E8_MACRO_SETTINGS = "Configure Microsoft Office Macro Settings"
E8_USER_APP_HARDENING = "User Application Hardening"
E8_RESTRICT_ADMIN = "Restrict Administrative Privileges"
E8_PATCH_OS = "Patch Operating Systems"
E8_MFA = "Multi-Factor Authentication"
E8_BACKUPS = "Regular Backups"

# Map MITRE ATT&CK technique IDs to Essential Eight controls
# A technique may map to multiple controls
_TECHNIQUE_TO_E8: dict[str, list[str]] = {
    # Initial Access
    "T1566": [E8_USER_APP_HARDENING, E8_MACRO_SETTINGS],  # Phishing
    "T1566.001": [E8_USER_APP_HARDENING, E8_MACRO_SETTINGS],  # Spearphishing Attachment
    "T1566.002": [E8_USER_APP_HARDENING],  # Spearphishing Link
    "T1190": [E8_PATCH_APPLICATIONS, E8_PATCH_OS],  # Exploit Public-Facing Application
    "T1133": [E8_MFA, E8_RESTRICT_ADMIN],  # External Remote Services
    "T1078": [E8_MFA, E8_RESTRICT_ADMIN],  # Valid Accounts
    "T1078.001": [E8_MFA, E8_RESTRICT_ADMIN],  # Default Accounts
    "T1078.002": [E8_MFA, E8_RESTRICT_ADMIN],  # Domain Accounts
    "T1078.003": [E8_MFA, E8_RESTRICT_ADMIN],  # Local Accounts
    "T1078.004": [E8_MFA, E8_RESTRICT_ADMIN],  # Cloud Accounts
    "T1195": [E8_APPLICATION_CONTROL],  # Supply Chain Compromise
    "T1195.002": [E8_APPLICATION_CONTROL],  # Compromise Software Supply Chain

    # Execution
    "T1059": [E8_APPLICATION_CONTROL],  # Command and Scripting Interpreter
    "T1059.001": [E8_APPLICATION_CONTROL],  # PowerShell
    "T1059.003": [E8_APPLICATION_CONTROL],  # Windows Command Shell
    "T1059.005": [E8_APPLICATION_CONTROL, E8_MACRO_SETTINGS],  # Visual Basic
    "T1059.006": [E8_APPLICATION_CONTROL],  # Python
    "T1059.007": [E8_USER_APP_HARDENING],  # JavaScript
    "T1204": [E8_USER_APP_HARDENING],  # User Execution
    "T1204.001": [E8_USER_APP_HARDENING],  # Malicious Link
    "T1204.002": [E8_APPLICATION_CONTROL, E8_MACRO_SETTINGS],  # Malicious File
    "T1203": [E8_PATCH_APPLICATIONS, E8_USER_APP_HARDENING],  # Exploitation for Client Execution

    # Persistence
    "T1053": [E8_RESTRICT_ADMIN],  # Scheduled Task/Job
    "T1547": [E8_APPLICATION_CONTROL, E8_RESTRICT_ADMIN],  # Boot or Logon Autostart Execution
    "T1543": [E8_RESTRICT_ADMIN],  # Create or Modify System Process

    # Privilege Escalation
    "T1068": [E8_PATCH_OS, E8_PATCH_APPLICATIONS],  # Exploitation for Privilege Escalation
    "T1134": [E8_RESTRICT_ADMIN],  # Access Token Manipulation
    "T1548": [E8_RESTRICT_ADMIN],  # Abuse Elevation Control Mechanism
    "T1548.002": [E8_RESTRICT_ADMIN],  # Bypass User Account Control

    # Defense Evasion
    "T1562": [E8_RESTRICT_ADMIN],  # Impair Defenses
    "T1055": [E8_APPLICATION_CONTROL],  # Process Injection
    "T1036": [E8_APPLICATION_CONTROL],  # Masquerading

    # Credential Access
    "T1110": [E8_MFA],  # Brute Force
    "T1110.001": [E8_MFA],  # Password Guessing
    "T1110.003": [E8_MFA],  # Password Spraying
    "T1110.004": [E8_MFA],  # Credential Stuffing
    "T1003": [E8_RESTRICT_ADMIN],  # OS Credential Dumping
    "T1621": [E8_MFA],  # Multi-Factor Authentication Request Generation
    "T1556": [E8_MFA, E8_RESTRICT_ADMIN],  # Modify Authentication Process
    "T1552": [E8_RESTRICT_ADMIN],  # Unsecured Credentials

    # Discovery
    "T1046": [E8_PATCH_OS],  # Network Service Discovery
    "T1087": [E8_RESTRICT_ADMIN],  # Account Discovery

    # Lateral Movement
    "T1021": [E8_MFA, E8_RESTRICT_ADMIN],  # Remote Services
    "T1021.001": [E8_MFA, E8_RESTRICT_ADMIN],  # Remote Desktop Protocol
    "T1021.002": [E8_RESTRICT_ADMIN],  # SMB/Windows Admin Shares
    "T1021.004": [E8_MFA],  # SSH
    "T1021.006": [E8_MFA],  # Windows Remote Management
    "T1210": [E8_PATCH_OS, E8_PATCH_APPLICATIONS],  # Exploitation of Remote Services
    "T1570": [E8_RESTRICT_ADMIN],  # Lateral Tool Transfer

    # Exfiltration
    "T1048": [E8_BACKUPS],  # Exfiltration Over Alternative Protocol
    "T1041": [E8_BACKUPS],  # Exfiltration Over C2 Channel
    "T1567": [E8_BACKUPS, E8_USER_APP_HARDENING],  # Exfiltration Over Web Service

    # Impact
    "T1486": [E8_BACKUPS],  # Data Encrypted for Impact (Ransomware)
    "T1490": [E8_BACKUPS, E8_RESTRICT_ADMIN],  # Inhibit System Recovery
    "T1489": [E8_RESTRICT_ADMIN],  # Service Stop
    "T1485": [E8_BACKUPS],  # Data Destruction
}

# Tactic-level fallback: if no technique match, use the tactic
_TACTIC_TO_E8: dict[str, list[str]] = {
    "Initial Access": [E8_MFA, E8_USER_APP_HARDENING],
    "Execution": [E8_APPLICATION_CONTROL],
    "Persistence": [E8_APPLICATION_CONTROL, E8_RESTRICT_ADMIN],
    "Privilege Escalation": [E8_RESTRICT_ADMIN, E8_PATCH_OS],
    "Defense Evasion": [E8_APPLICATION_CONTROL],
    "Credential Access": [E8_MFA],
    "Discovery": [E8_PATCH_OS],
    "Lateral Movement": [E8_MFA, E8_RESTRICT_ADMIN],
    "Collection": [E8_RESTRICT_ADMIN],
    "Exfiltration": [E8_BACKUPS],
    "Command and Control": [E8_USER_APP_HARDENING],
    "Impact": [E8_BACKUPS],
    "Resource Development": [E8_APPLICATION_CONTROL],
    "Reconnaissance": [E8_PATCH_OS],
}


def map_to_essential_eight(technique: str, tactic: str = "") -> list[str]:
    """Map a MITRE ATT&CK technique to Essential Eight controls.

    Args:
        technique: MITRE technique string, e.g. "T1110 - Brute Force" or "T1110.001"
        tactic: MITRE tactic name as fallback, e.g. "Credential Access"

    Returns:
        List of relevant Essential Eight control names. Never empty —
        falls back to tactic-level mapping, then to a general recommendation.
    """
    # Sanitise inputs — cap length to prevent unexpectedly large string operations
    technique = (technique or "")[:200]
    tactic = (tactic or "")[:100]

    # Extract technique ID from strings like "T1110 - Brute Force" or "T1110.001 – Password Guessing"
    tech_id = ""
    for part in technique.replace("\u2013", "-").replace("\u2014", "-").split("-"):
        cleaned = part.strip()
        if cleaned.startswith("T") and len(cleaned) >= 5:
            tech_id = cleaned
            break

    # Try exact technique ID match
    if tech_id and tech_id in _TECHNIQUE_TO_E8:
        return _TECHNIQUE_TO_E8[tech_id]

    # Try parent technique (T1110.001 → T1110)
    if tech_id and "." in tech_id:
        parent = tech_id.split(".")[0]
        if parent in _TECHNIQUE_TO_E8:
            return _TECHNIQUE_TO_E8[parent]

    # Tactic-level fallback
    if tactic and tactic in _TACTIC_TO_E8:
        return _TACTIC_TO_E8[tactic]

    return [E8_APPLICATION_CONTROL]  # Safest general fallback
