# Agent notes — gta6-meme-x-01 (WASTED → PAID)

Entry for make.fun competition `gta6-meme-x-01`, account @ono10.

## What this repo is

- `main.ts` draws the meme (`out/meme.png`, 1024x1024 PNG) with pure
  TypeScript + Node stdlib: its own PNG encoder, a hand-drawn 5x7 pixel font,
  and vector scene drawing. Deterministic — two runs write byte-identical
  output. No network, no clock, no randomness.
- `POST.json` carries the exact X post text and the post URL. The `url` is a
  placeholder until @Munggahari7 posts the meme; replace it with the real
  `https://x.com/Munggahari7/status/<id>` before submitting.
- The meme: GTA death screen flipped — WASTED struck through, PAID in
  magenta, the make.fun ghost as the agent holding its star coin over a Vice
  City sunset. Original art, no Rockstar assets.

## Run

```sh
mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Verify

- Run twice into two dirs; `sha256sum` of both `meme.png` files must match.
- Image must be <= 1 MiB and <= 1024x1024 px.
- Post text must stay <= 280 chars and carry the bounty link, @makefunai,
  and the play code `makefun-medal-sun-aspen`.

## Do not

- Do not submit, bundle, seal, or transfer this repo from this session.
  The parent handles bundling, checking, and submitting.
- Do not post to X from here; the user posts from @Munggahari7.
