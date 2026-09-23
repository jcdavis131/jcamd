#!/usr/bin/env python3
"""Smoke test for jcamd.com: the static site must keep pointing at live surfaces.

Stdlib only. Exit 1 with a list of failures. Run: python3 scripts/smoke.py
Checks: index.html parses, the Lab links to every live game and the hub, no link
points at a retired host, vercel.json is valid JSON, every page exists, has a
title/description/OG image, and every local /asset it references is on disk,
and every indexable page is in sitemap.xml.
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_LINKS = [
    "https://hoops.dumbmodel.com",
    "/graphify/",
]
# Hosts that no longer serve anything of ours; a link to one is a dead click.
RETIRED_HOSTS = ["hoops.jcamd.com", "bhenre.com", "arcade.dumbmodel.com", "training.jcamd.com"]
REQUIRED_PAGES = [
    "index.html", "graphify/index.html", "chips/index.html", "404.html",
    "vercel.json", "favicon.ico", "site.webmanifest", "sitemap.xml", "robots.txt",
]
# page -> public URL expected in sitemap.xml (404 is noindex, so it's excluded)
PAGES = {
    "index.html": "https://jcamd.com/",
    "chips/index.html": "https://jcamd.com/chips/",
    "graphify/index.html": "https://jcamd.com/graphify/",
    "404.html": None,
}


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
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    for rel, url in PAGES.items():
        path = ROOT / rel
        if not path.is_file():
            continue
        page = path.read_text(encoding="utf-8")
        for needle in ("<title>", 'name="description"', 'name="viewport"', 'class="skip-link"'):
            if needle not in page:
                failures.append(f"{rel}: missing {needle}")
        if url and 'property="og:image"' not in page:
            failures.append(f"{rel}: missing og:image")
        if url and f"<loc>{url}</loc>" not in sitemap:
            failures.append(f"sitemap.xml: missing {url}")
        for ref in re.findall(r'(?:href|src)="(/(?:assets/|favicon|site\.webmanifest)[^"#?]*)"', page):
            if not (ROOT / ref.lstrip("/")).is_file():
                failures.append(f"{rel}: references missing file {ref}")
        for ref in re.findall(r'content="https://jcamd\.com(/assets/[^"]+)"', page):
            if not (ROOT / ref.lstrip("/")).is_file():
                failures.append(f"{rel}: OG image missing on disk {ref}")
    if failures:
        print("smoke FAILED:\n  " + "\n  ".join(failures))
        return 1
    print(f"smoke ok: {len(hrefs)} links, {len(REQUIRED_LINKS)} required present, no retired hosts, {len(PAGES)} pages checked")
    return 0


if __name__ == "__main__":
    sys.exit(main())
