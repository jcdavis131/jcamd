#!/usr/bin/env python3
"""Smoke test for jcamd.com: the static site must keep pointing at live surfaces.

Stdlib only. Exit 1 with a list of failures. Run: python3 scripts/smoke.py
Checks: index.html parses, the Lab links to every live game and the hub, no link
points at a retired host, vercel.json is valid JSON, /graphify and /family exist.
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_LINKS = [
    "https://dumbmodel.com/",
    "https://hoops.dumbmodel.com/",
    "https://pitch.dumbmodel.com/",
    "https://gridiron.dumbmodel.com/",
    "https://equities.dumbmodel.com/",
    "https://unified.dumbmodel.com/",
    "/graphify/",
    "/family/",
]
# Hosts that no longer serve anything of ours; a link to one is a dead click.
RETIRED_HOSTS = ["hoops.jcamd.com", "bhenre.com", "arcade.dumbmodel.com", "training.jcamd.com"]
REQUIRED_PAGES = ["index.html", "graphify/index.html", "family/index.html", "vercel.json"]


class _Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.hrefs: list[str] = []
        self.errors: list[str] = []

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            for k, v in attrs:
                if k == "href" and v:
                    self.hrefs.append(v)


def main() -> int:
    failures: list[str] = []
    for rel in REQUIRED_PAGES:
        if not (ROOT / rel).is_file():
            failures.append(f"missing {rel}")
    try:
        json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        failures.append(f"vercel.json invalid: {e}")
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    parser = _Links()
    parser.feed(html)
    hrefs = set(parser.hrefs)
    for link in REQUIRED_LINKS:
        if link not in hrefs:
            failures.append(f"index.html: missing link {link}")
    for host in RETIRED_HOSTS:
        if re.search(rf"https?://{re.escape(host)}", html):
            failures.append(f"index.html: links to retired host {host}")
    if html.count("<a ") != html.count("</a>"):
        failures.append("index.html: unbalanced <a> tags")
    if failures:
        print("smoke FAILED:\n  " + "\n  ".join(failures))
        return 1
    print(f"smoke ok: {len(hrefs)} links, {len(REQUIRED_LINKS)} required present, no retired hosts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
