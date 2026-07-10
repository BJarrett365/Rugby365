# Premiership Wikipedia Full Audit (2026-07-08)

Audited **1** seasons against Wikipedia (standings, fixtures, playoffs, clubs table).

| Status | Count |
|--------|------:|
| ok | 0 |
| warn | 0 |
| fail | 1 |

## Season summary

| Season | Status | Champion | Table | P | Fixtures (W→DB) | Playoffs (W→DB) | Clubs | Coaches | Venues |
|--------|--------|----------|------:|--:|------------------:|----------------:|------:|--------:|-------:|
| 2025–26 | fail | ✓ | ✗ | 18 | 90→126 | 3→3 | 6 | 0/6 | 5/6 |

## Club tables (Wikipedia vs DB)

Columns: **Club**, Director of Rugby/Head Coach, Captain (wiki only — not stored in DB), Stadium, Capacity, City/Area.

### 2025–26

Issues: `Standings mismatch: wiki 10 teams P=18; db 30 teams P=9-18`; `Regular fixtures: wiki=90 db=126 (db may include legacy LiveSport rows)`; `6 coach name mismatch(es)`; `6 wiki coach(es) not in DB for season`; `1 stadium mismatch(es)`

| Club | Wiki coach | DB coach | Captain | Wiki stadium | DB stadium | Wiki cap | DB cap | Wiki city | DB city |
|------|------------|----------|---------|--------------|------------|---------:|-------:|-----------|--------|
| Bristol Bears | Pat Lam | — ⚠ | Fitz Harding | Ashton Gate | Ashton Gate | 27000 | 27000 | Bristol | Bristol |
| Gloucester Rugby | George Skivington | — ⚠ | Tomos Williams | Kingsholm | Kingsholm Stadium | 16115 | 16500 | Gloucester Gloucestershire | Gloucester |
| Harlequins | Jason Gilmore | — ⚠ | Alex Dombrandt | Twickenham Stoop | Twickenham Stoop | 14800 | 14816 | Twickenham Greater London | London |
| Newcastle Red Bulls | Stephen Jones On 16 March 2026 Dickens departed the club by mutual consent and assistant Stephen Jones took the role of interim head coach for the remainder of the season. | — ⚠ | George McGuigan | Kingston Park | Kingston Park | 10200 | 10200 | Newcastle upon Tyne Tyne and Wear | Newcastle |
| Sale Sharks | Alex Sanderson | — ⚠ | Ernst van Rhyn | CorpAcq Stadium | AJ Bell Stadium ⚠ | 12000 | 12000 | Salford Greater Manchester | Salford |
| Saracens | Mark McCall | — ⚠ | Maro Itoje | StoneX Stadium | StoneX Stadium | 10500 | 10000 | Hendon Greater London | London |

## Notes

- **Captain** is published on Wikipedia but has no dedicated DB field yet; shown for reference only.
- **Coach** comparison uses `team_coaching_staff` for the season (or current head coach when season-scoped row missing).
- **Fixture counts** may exceed Wikipedia when legacy LiveSport imports remain linked to the same `season_id`.
- Older seasons (pre-~2010) often omit coach/captain columns on Wikipedia.
