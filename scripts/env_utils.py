"""
env_utils.py — shared .env file loader (stdlib only, no python-dotenv dependency).

Intended for use by scripts in this repository that need to load environment
variables from the project-root .env before importing third-party packages.
"""

from __future__ import annotations

import os
from pathlib import Path


def load_dotenv(env_path: Path) -> None:
    """
    Parse a .env file and inject variables into os.environ.

    Only lines of the form KEY=VALUE are processed.  Blank lines and lines
    that start with '#' are skipped.  Values are not shell-expanded.
    Already-set environment variables are NOT overwritten (matches the
    python-dotenv default behaviour).

    Matched surrounding quotes (both ``"`` or both ``'``) are stripped from
    values; mismatched or single-sided quotes are left as-is.

    Parameters
    ----------
    env_path:
        Path to the .env file.  If the file does not exist the function
        returns silently.
    """
    if not env_path.is_file():
        return

    with env_path.open(encoding="utf-8") as fh:
        for raw_line in fh:
            line = raw_line.strip()

            # Skip blank lines and comments
            if not line or line.startswith("#"):
                continue

            # Require KEY=VALUE shape
            if "=" not in line:
                continue

            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip()

            # Strip matching surrounding quotes (" or ') only when both ends
            # carry the same quote character.
            if len(value) >= 2 and value[0] in ('"', "'") and value[-1] == value[0]:
                value = value[1:-1]

            # Respect variables that the calling shell already exported
            if key and key not in os.environ:
                os.environ[key] = value
