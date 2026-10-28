"""High-confidence secret scan. Report filenames only; never print matching values."""
import base64
import json
import re
import subprocess
import sys
from pathlib import Path

PATTERNS = [re.compile(rb"AIza[0-9A-Za-z_-]{35}"), re.compile(rb"(?:sk-proj-|sb_secret_)[0-9A-Za-z_-]{20,}"),
            re.compile(rb"\bre_[0-9A-Za-z_]{24,}\b"),
            re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")]
JWT = re.compile(rb"eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+")


def contains_secret(data):
    if any(pattern.search(data) for pattern in PATTERNS):
        return True
    for match in JWT.finditer(data):
        try:
            payload = match.group().split(b".")[1]
            if json.loads(base64.urlsafe_b64decode(payload + b"=" * (-len(payload) % 4))).get("role") == "service_role":
                return True
        except (ValueError, UnicodeDecodeError):
            pass
    return False


def main():
    findings = set()
    # Scan tracked working files, reachable historical blobs and built frontend assets.
    files = subprocess.check_output(["git", "ls-files", "-z"]).split(b"\0")
    for raw in filter(None, files):
        path = Path(raw.decode("utf8"))
        if path.is_file() and contains_secret(path.read_bytes()): findings.add(str(path))
        if path.name.startswith(".env") and not path.name.endswith(".example"): findings.add(str(path))
    objects = subprocess.check_output(["git", "rev-list", "--objects", "--all"]).splitlines()
    for raw in objects:
        parts = raw.split(b" ", 1)
        if len(parts) != 2: continue
        sha, path = parts
        if subprocess.check_output(["git", "cat-file", "-t", sha]).strip() != b"blob": continue
        if contains_secret(subprocess.check_output(["git", "cat-file", "blob", sha])):
            findings.add("history:" + path.decode("utf8", errors="replace"))
    for path in Path("frontend/dist").rglob("*"):
        if path.is_file() and contains_secret(path.read_bytes()): findings.add(str(path))
    if findings:
        print("Possible secret exposure; inspect privately and rotate confirmed credentials:")
        for name in sorted(findings): print(name)
        return 1
    print("No high-confidence credentials found in tracked files, reachable history or frontend build.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
