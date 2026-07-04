# 🔥 Firebox Maze

A 3D maze rescue game built with three.js. Drive an armor mobile with a spinning
drill through 10 Minecraft-style block mazes. Bump the friendly guard to get the
key, free the people from the jail, and escape through the glowing portal —
while dodging fire blocks, zombies, and (on level 10) a creeper.

## Play it

The game is plain static files — no build step. Serve the folder over HTTP:

```
python3 -m http.server 8000     # or: npx serve
```

then open http://localhost:8000/ on desktop or phone.

## How to play

- **Move**: WASD / arrow keys, or the touch joystick on phones
- **Shoot**: Space, click, or the 💥 button on phones
- **Drill**: always spinning — drive into cracked brown blocks to smash through,
  or into monsters to pop them
- **🎒 Garage** (or `B`): choose your weapon (⚡ Blaster / 💧 Water Cannon /
  💥 Boom Cannon), armor (🏎️ Speedy / 🛡️ Knight / 🦾 Mega Tank), and car color
- **Goal**: bump the guard → grab the key → open the jail → drive into the portal
- Fire blocks burn you (Water Cannon puts them out; Mega Tank is fireproof)
- Progress auto-saves in the browser — the title screen lets you continue or
  replay any unlocked level

## Dev

- `js/` — ES modules (config, maze gen, world builder, vehicle, enemies,
  weapons, particles, UI, audio, save)
- `vendor/` — vendored three.js (`three.module.js` + `three.core.js`)
- `tools/shot.mjs` — Playwright screenshot/driving harness:
  `node tools/shot.mjs out.png --click "#btn-play" --hold ArrowUp 900 --eval "FB.startLevel(10)"`
- Sounds are synthesized with WebAudio; textures are generated on canvas —
  no asset files.
