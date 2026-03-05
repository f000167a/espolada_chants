#!/usr/bin/env python3
"""
Fetch Espolada Hokkaido schedule from espolada.com and save as schedule.json
"""
import json, re, sys
from datetime import date
import requests
from bs4 import BeautifulSoup

URL = "https://espolada.com/match-info/fleague-schedule/"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; EspoladaScheduleBot/1.0)"}

RESULT_RE = re.compile(r"[○●△][\s\d\-]+")

def parse_date(text):
    """'6月14日（土）' -> '2025-06-14'"""
    m = re.search(r"(\d+)月(\d+)日", text)
    if not m:
        return None
    month, day = int(m.group(1)), int(m.group(2))
    # season runs June 2025 - March 2026
    year = 2025 if month >= 6 else 2026
    return f"{year}-{month:02d}-{day:02d}"

def fetch():
    res = requests.get(URL, headers=HEADERS, timeout=15)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    matches = []
    rows = soup.select("ul li, .schedule-item, tr")  # adjust selector as needed

    # Fallback: look for structured list items with date and opponent info
    # Parse the dl/dt/dd or table structure from espolada.com
    # The page uses a list structure; we'll look for date patterns
    text_blocks = soup.get_text(separator="\n").split("\n")
    text_blocks = [t.strip() for t in text_blocks if t.strip()]

    i = 0
    node = None
    while i < len(text_blocks):
        t = text_blocks[i]
        # Node number
        if re.match(r"^\d{1,2}$", t) and int(t) <= 30:
            node = int(t)
        # Date pattern
        if re.search(r"\d+月\d+日", t) and node:
            date_str = parse_date(t)
            # Look ahead for time, opponent, venue, result
            time_str = ""
            opponent = ""
            home = False
            venue = ""
            result = None

            for j in range(i+1, min(i+10, len(text_blocks))):
                tok = text_blocks[j]
                if re.match(r"\d{1,2}:\d{2}", tok):
                    time_str = tok
                elif tok in ("H", "A", "HOME", "AWAY"):
                    home = tok in ("H", "HOME")
                elif RESULT_RE.match(tok):
                    result = tok.strip()
                elif re.match(r"^\d{1,2}$", tok) and int(tok) <= 30:
                    break  # next node
                elif tok and not re.search(r"月|日|時|分|節|KO|キック", tok) and len(tok) > 2 and not opponent:
                    opponent = tok
                elif tok and not venue and len(tok) > 3 and opponent:
                    venue = tok

            if date_str and opponent:
                matches.append({
                    "node": node,
                    "date": date_str,
                    "time": time_str,
                    "opponent": opponent,
                    "home": home,
                    "venue": venue,
                    "result": result
                })
                node = None
        i += 1

    return matches

def main():
    try:
        matches = fetch()
        if not matches:
            print("No matches parsed — keeping existing schedule.json", file=sys.stderr)
            sys.exit(0)

        # Read existing to preserve season field
        try:
            with open("schedule.json") as f:
                existing = json.load(f)
        except Exception:
            existing = {"season": "2025-26", "team": "エスポラーダ北海道"}

        existing["matches"] = matches
        existing["updated"] = date.today().isoformat()

        with open("schedule.json", "w", encoding="utf-8") as f:
            json.dump(existing, f, ensure_ascii=False, indent=2)
        print(f"schedule.json updated: {len(matches)} matches")
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
