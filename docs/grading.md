# How the report card is graded

The grade comes from a script (`skills/vibe-preflight/scripts/report-card.mjs`), not from the AI's
judgment. The AI only lists findings in `.vibe-preflight/findings.json`; the same findings
always give the same grade and a byte-identical card. A test keeps this page and the code in sync.

Score = 100 - deductions + bonus, kept between 0 and 100. Any RED finding caps the score at the
"Max score with any RED" value, so a RED always means D or worse.

| Rule | Value |
| --- | --- |
| RED deduction | 20 |
| YELLOW deduction | 5 |
| INFO deduction | 1 |
| Bonus per done-well | 1 |
| Bonus cap | 5 |
| Max score with any RED | 69 |

| Grade | Minimum score |
| --- | --- |
| A+ | 97 |
| A | 90 |
| B+ | 85 |
| B | 80 |
| C+ | 75 |
| C | 70 |
| D | 60 |
| F | 0 |

Examples: 1 RED = 69 (D). 3 YELLOW + 2 INFO + 5 done-well = 88 (B+). Nothing found + 5 done-well = 100 (A+). 13 RED = F.

## Verdict

- any RED: "Not ready for real users yet"
- score 90 or more: "Ready for real users"
- otherwise: "Almost ready: a few things worth fixing"

## Counts

- Must fix = RED findings. Worth fixing = YELLOW + INFO findings. Done well = "looks good" items.
- Category counts on the card are problems only (RED, YELLOW, INFO), not done-well items.
- Est. fix time = sum of the RED fix estimates: none, `~N min` under an hour, otherwise hours
  rounded to the nearest half hour.

## Categories

Security, Secrets, Dependencies, Cost & abuse, Unfinished code, Deployment, Agent config.
`secrets` = any key, password or token stored or exposed. Otherwise by checklist: security.md
= Security; dependencies.md = Dependencies; cost-abuse.md = Cost & abuse; unfinished-code.md =
Unfinished code; deploy-readiness, containers, platforms, dockerfile = Deployment;
agent-config.md = Agent config.

## The badge is self-reported

The badge shows the owner's last scan. Nothing verifies it.

## Rendering

The PNG is drawn by `@resvg/resvg-wasm` (WebAssembly) with a bundled font, vendored unmodified
in `skills/vibe-preflight/scripts/vendor/` so nothing is installed at scan time and the image looks the
same on every OS. The SVG has no timestamps except the scan date.

| File | Version | License | sha256 |
| --- | --- | --- | --- |
| `resvg/index_bg.wasm` | @resvg/resvg-wasm 2.6.2 | MPL-2.0 | `22bf6e9f9a100d972da0411a69c5ba504367fc1fa87b3b64e3f35e53926d2d70` |
| `fonts/JetBrainsMono-Regular.ttf` | JetBrains Mono 2.304 | OFL 1.1 | `a0bf60ef0f83c5ed4d7a75d45838548b1f6873372dfac88f71804491898d138f` |
| `fonts/JetBrainsMono-Bold.ttf` | JetBrains Mono 2.304 | OFL 1.1 | `5590990c82e097397517f275f430af4546e1c45cff408bde4255dad142479dcb` |

The npm tarball integrity (`npm view @resvg/resvg-wasm@2.6.2 dist.integrity`) is
`sha512-FqALmHI8D4o6lk/LRWDnhw95z5eO+eAa6ORjVg09YRR7BkcM6oPHU9uyC0gtQG5vpFLvgpeU4+zEAz2H8APHNw==`.

Regenerate the demo card (needs Node 18+):

```bash
d=$(mktemp -d) && mkdir "$d/.vibe-preflight" && cp test/fixtures/demo.json "$d/.vibe-preflight/findings.json" \
  && node skills/vibe-preflight/scripts/report-card.mjs "$d" && cp "$d/.vibe-preflight/report-card."* docs/demo/
```
