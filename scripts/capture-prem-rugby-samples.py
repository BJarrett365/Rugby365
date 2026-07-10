#!/usr/bin/env python3
"""Capture PREM Rugby (Gallagher Premiership 2025/26) samples for mapping audit."""
from __future__ import annotations

import json
import os
import time
import urllib.request
from pathlib import Path

BASE = os.environ.get(
    "RUGBY_DATA_API_BASE_URL",
    "https://cms-planetrugby-players-investigator-for-barrie.hneeds.com",
)
TOKEN = os.environ.get("RUGBY_DATA_API_TOKEN", "")
OUT = Path("/Users/barriejarrett/Desktop/rugby365/docs/rugby-data-api/samples")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
MID = 5370
LID = 104


def fetch(path: str) -> tuple[int, bytes]:
    req = urllib.request.Request(BASE + path, headers={"Accept": "application/json", "User-Agent": UA})
    if TOKEN:
        req.add_header("token", TOKEN)
    if "matches" in path:
        req.add_header("timezone", "Europe/London")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return resp.status, resp.read()


def save(name: str, raw: bytes, extra=None) -> dict:
    parsed = json.loads(raw)
    meta = {
        "endpoint": name,
        "status": 200,
        "bytes": len(raw),
        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "auth": "token-header" if TOKEN else "none",
        "base_url": BASE,
        **(extra or {}),
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{name}.json").write_text(
        json.dumps({"_meta": meta, "response": parsed}, indent=2, ensure_ascii=False)[:5_000_000]
    )
    print(f"200\t{len(raw):>7}\t{name}")
    return parsed


def main() -> None:
    paths = {
        f"prem_rugby_match_{MID}_info": f"/api/v1/rugby-union/match/{MID}/info",
        f"prem_rugby_match_{MID}_detail": f"/api/v1/rugby-union/match/{MID}/detail",
        f"prem_rugby_match_{MID}_stat": f"/api/v1/rugby-union/match/{MID}/stat",
        f"prem_rugby_match_{MID}_lineup": f"/api/v1/rugby-union/match/{MID}/lineup",
        f"prem_rugby_match_{MID}_player_stat": f"/api/v1/rugby-union/match/{MID}/player-stat",
        f"prem_rugby_match_{MID}_table": f"/api/v1/rugby-union/match/{MID}/table?type=all",
        f"league_{LID}_prem_rugby_header": f"/api/v1/rugby-union/league/{LID}/header",
        f"league_{LID}_prem_rugby_matches": f"/api/v1/rugby-union/league/{LID}/matches?match_type=finished",
        f"league_{LID}_prem_rugby_teams": f"/api/v1/rugby-union/league/{LID}/teams",
        f"league_{LID}_prem_rugby_table": f"/api/v1/rugby-union/league/{LID}/table",
    }
    for name, path in paths.items():
        status, raw = fetch(path)
        assert status == 200, (name, status)
        parsed = save(name, raw, {"path": path})
        data = parsed.get("data")
        if "lineup" in name and isinstance(data, dict):
            ht = data.get("home_team") or {}
            print(
                "  lineup home",
                len(ht.get("lineup") or []),
                "subs",
                len(ht.get("substitutions") or []),
                "sample",
                (ht.get("lineup") or [None])[:1],
            )
        if "player_stat" in name and isinstance(data, dict):
            print("  types", list(data.keys()))
        if name.endswith("_detail"):
            print("  detail", json.dumps(data, ensure_ascii=False)[:400])
        if name.endswith("_teams"):
            print("  teams", json.dumps(data, ensure_ascii=False)[:500])
        if name.endswith("_header"):
            print("  header", data)
        if name.endswith("_matches") and isinstance(data, list):
            total = sum(len(d.get("matches") or []) for d in data)
            print("  days", len(data), "matches", total)


if __name__ == "__main__":
    main()
