#!/usr/bin/env bash
# Capture Rugby Data API sample responses for mapping audit.
# Server-side only. Token from RUGBY_DATA_API_TOKEN (never logged).
set -euo pipefail
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin:${PATH}"

BASE_URL="${RUGBY_DATA_API_BASE_URL:-https://cms-planetrugby-players-investigator-for-barrie.hneeds.com}"
TOKEN="${RUGBY_DATA_API_TOKEN:-}"
OUT="${1:-/Users/barriejarrett/Desktop/rugby365/docs/rugby-data-api/samples}"
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
mkdir -p "$OUT"

AUTH_MODE="none"
if [[ -n "$TOKEN" ]]; then AUTH_MODE="token-header"; fi

capture() {
  local name="$1"
  local path="$2"
  shift 2
  local tmp
  tmp="$(mktemp)"
  local args=(-sS -o "$tmp" -w '%{http_code}' --max-time 60 -A "$UA" -H 'Accept: application/json')
  if [[ -n "$TOKEN" ]]; then
    args+=(-H "token: ${TOKEN}")
  fi
  local code
  code="$(curl "${args[@]}" "$@" "${BASE_URL}${path}")"
  /usr/bin/python3 - "$name" "$path" "$code" "$tmp" "$OUT" "$AUTH_MODE" "$BASE_URL" <<'PY'
import json, sys, pathlib, time
name, path, code, tmp, out, auth, base = sys.argv[1:8]
raw = pathlib.Path(tmp).read_bytes()
text = raw.decode("utf-8", "replace")
try:
    parsed = json.loads(text)
except Exception:
    parsed = {"_raw_preview": text[:4000]}
meta = {
    "endpoint": name,
    "method": "GET",
    "base_url": base,
    "path": path,
    "status": int(code),
    "bytes": len(raw),
    "captured_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "auth": auth,
    "user_agent": "browser",
}
pathlib.Path(out, f"{name}.json").write_text(
    json.dumps({"_meta": meta, "response": parsed}, indent=2, ensure_ascii=False)[:5_000_000]
)
print(f"{code}\t{len(raw):>7}\t{name}")
PY
  rm -f "$tmp"
}

echo "base=${BASE_URL}"
echo "auth=${AUTH_MODE}"

capture countries_list "/api/v1/rugby-union/countries/list"
capture country_leagues "/api/v1/rugby-union/country/leagues?q="
capture news_leagues "/api/v1/rugby-union/news/leagues"
capture search_bath "/api/v1/rugby-union/search?q=bath"
capture teams "/api/v1/rugby-union/teams"
capture matches_2026-07-08 "/api/v1/rugby-union/matches?type=all&date=2026-07-08" -H "difference: 0" -H "timezone: Europe/London"
capture matches_count_2026-07-08 "/api/v1/rugby-union/matches/count?date=2026-07-08"
capture match_7581_info "/api/v1/rugby-union/match/7581/info"
capture match_7581_detail "/api/v1/rugby-union/match/7581/detail"
capture match_7581_stat "/api/v1/rugby-union/match/7581/stat"
capture match_7565_player_stat "/api/v1/rugby-union/match/7565/player-stat"
capture match_7581_lineup "/api/v1/rugby-union/match/7581/lineup"
capture match_7581_table "/api/v1/rugby-union/match/7581/table?type=all"
capture league_193_matches "/api/v1/rugby-union/league/193/matches?match_type=finished" -H "timezone: Europe/London"
capture league_193_header "/api/v1/rugby-union/league/193/header"
capture league_193_table "/api/v1/rugby-union/league/193/table"
capture league_193_teams "/api/v1/rugby-union/league/193/teams"
capture league_193_news "/api/v1/rugby-union/league/193/news"
capture team_243_matches "/api/v1/rugby-union/team/243/matches?type=finished" -H "timezone: Europe/London"
capture team_243_header "/api/v1/rugby-union/team/243/header"
capture team_243_news "/api/v1/rugby-union/team/243/news"

/usr/bin/python3 - "$OUT" <<'PY'
import json, pathlib, sys
out = pathlib.Path(sys.argv[1])
index = []
for p in sorted(out.glob("*.json")):
    if p.name.startswith("_"): continue
    data = json.loads(p.read_text())
    meta = data.get("_meta", {})
    resp = data.get("response")
    keys = list(resp.keys()) if isinstance(resp, dict) else type(resp).__name__
    index.append({
        "name": meta.get("endpoint", p.stem),
        "status": meta.get("status"),
        "bytes": meta.get("bytes"),
        "file": p.name,
        "top_keys": keys,
        "auth": meta.get("auth"),
    })
(out / "_index.json").write_text(json.dumps(index, indent=2))
ok = sum(1 for i in index if i.get("status") == 200)
print(f"index: {ok}/{len(index)} HTTP 200")
PY
