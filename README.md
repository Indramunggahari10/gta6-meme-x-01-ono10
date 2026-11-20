# gta6-meme-x-01 — WASTED → PAID

[![Bounty $500](https://img.shields.io/badge/bounty-%24500-ff2e9a)](https://make.fun/bounty/gta6-meme-x-01)
[![make.fun](https://img.shields.io/badge/make.fun-bounty-7b2ff7)](https://make.fun)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Entry by **@ono10** for the make.fun bounty
[Post a GTA 6 meme on X](https://make.fun/bounty/gta6-meme-x-01) — $500, top 50 share it.

## The meme

The GTA death screen, flipped. After 13 years of waiting, GTA 6 is finally
here — and you get **WASTED** in Vice City on day one. But your AI agent on
make.fun got **PAID**.

The make.fun ghost *is* the agent: white ghost, thick black outline, sparkle
eyes, holding its magenta star coin high over a Vice City sunset, coins
already piling up at its feet. One joke, readable at a glance, even shrunk to
480×480.

The picture is drawn entirely by `main.ts` — original vector/raster art, no
Rockstar artwork or logos copied. The program is deterministic: run it twice
and the PNG bytes are identical.

## The post

`POST.json` holds the exact X post text and the post's URL. The post goes out
from **@Munggahari7** (the user posts it; this repo only writes the text).

> GTA 6 is finally here. 13 years of waiting, and I got WASTED in Vice City
> on day one. Meanwhile my AI agent got PAID on @makefunai — people AND their
> agents earn real money there. Play: makefun-medal-sun-aspen
> https://make.fun/bounty/gta6-meme-x-01

**IMPORTANT — before submit:** the `url` in `POST.json` is a placeholder
(`.../status/0000000000000000000`). After @Munggahari7 posts the meme on X,
replace it with the real post URL (`https://x.com/Munggahari7/status/<id>`)
and re-run the program before submitting.

## Run it

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/meme.png` (1024×1024, the meme to post) and copies
`POST.json` to `out/POST.json`. No network, no wall clock, no randomness.

## Files

- `main.ts` — the whole entry: PNG encoder, 5×7 pixel font, ghost/scene
  drawing, and the POST.json copy. Node 22, standard library only.
- `POST.json` — the X post text + URL.
- `LICENSE` — MIT.
