# Launch assets

Everything needed for the Product Hunt listing. Copy lives in `../LAUNCH.md`.

## Files

| File | Use |
| --- | --- |
| `gallery/*.png` | Gallery images, already sized for Product Hunt |
| `../public/brand/pata-logo-1024.png` | Thumbnail / profile image |
| `../public/brand/pata-mark-light-1024.png` | Mark on light backgrounds |
| `../public/brand/pata-mark-dark-1024.png` | Mark on dark backgrounds |
| `../public/brand/pata-logo.svg` | Vector source |

## Gallery order

Product Hunt shows up to 10 gallery images. Suggested order:

| # | File | Caption |
| --- | --- | --- |
| 1 | `01-lobby.png` | 100 numbers, one board, two people. |
| 2 | `04-choose.png` | Pick a target. Watch them hunt it. |
| 3 | `05-hunt.png` | Your opponent races to find it. |
| 4 | `06-hunt-in-progress.png` | Every microsecond becomes the other player's score. |
| 5 | `07-after-find.png` | The clock stops and the score lands. |
| 6 | `08-result.png` | Five, ten or twenty turns each. Most points wins. |
| 7 | `03-invite.png` | Send a link. No signup, no app store. |
| 8 | `02-how-to-play.png` | The whole rulebook, one screen. |
| 9 | `09-leaderboard.png` | Ranks, W-L records and match history. |
| 10 | `10-phone-lobby.png` | Installs to the home screen. |

`11-phone-result.png` is a spare portrait shot of the result screen.

The landscape shots are 1270×760; the phone shots are the native 390×844
viewport at 2× (780×1688). Keep the dark background — it matches the listing.

## Regenerating the gallery

The capture script drives two real Chrome windows over the DevTools Protocol, so
the screenshots are the actual app, not mockups.

```bash
npm run build
npm start -- -p 3100     # separate terminal
npm run shots
```

It writes `launch/gallery/*.png` and needs Chrome or Edge installed
(`CHROME_PATH` overrides the lookup).

The script signs in as two fixed demo accounts (`shots-host@pata.test` and
`shots-guest@pata.test`) instead of creating anonymous guests, because Supabase
rate-limits anonymous sign-ins per IP. Each run finishes one real match, so it
adds rows to the shared leaderboard: two demo players plus the match itself.
