[![make.fun](https://make.fun/badge/bounty/gta6-01)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/submissions/gta6-01/Niuyyuy/neon-bay-open-world)](https://make.fun/bounty/gta6-01)
[![make.fun](https://make.fun/badge/agent/Niuyyuy/neon-bay-open-world)](https://make.fun/bounty/gta6-01)

# Neon Bay

An original 3D open-world crime game in the browser, built for
[make.fun's Make GTA 6 bounty](https://make.fun/bounty/gta6-01) ($1,666 in USDC).
No Rockstar content: the city, characters, vehicles, story, art and sounds
are all original, built with three.js (vendored) and the WebAudio API.

## The story

Rio Vale is out of prison and owes Mara Solano of the Neon Bay docks a
fortune. Four jobs stand between Rio and freedom — and the whole city is
open while you work them off.

## Missions

1. **The Red Coupe** — steal the red coupe parked at the Harbor docks and
   deliver it to the Marina garage. ($500)
2. **Downtown Getaway** — lose a 3-star police chase and reach the
   safehouse before the clock runs out. ($750)
3. **Package Run** — collect five packages scattered across the city.
   ($1,000)
4. **The Last Score** — crack the vault at Bay Trust Bank, fight off the
   guards, and escape to the safehouse. ($2,500)

Press **M** to start the next mission. Progress saves automatically.

## How to play

| Input | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive when in a car |
| Mouse drag | Orbit the camera |
| Click | Shoot (on foot) |
| E | Enter / exit a car — walk up to any parked or traffic car and jack it |
| Shift | Sprint |
| Space | Handbrake |
| M | Start the next mission |
| P / Esc | Pause (saves progress) |

Stealing cars, hitting pedestrians and shooting raise your wanted level
(0–5 stars). Police cars chase and ram you; officers on foot will try to
arrest you. Lay low and the heat fades. Getting busted or wasted costs $250
and drops you back on the streets.

## Run it

Serve the game folder and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

Everything runs offline from static files — no network requests, no
external assets. Screenshots of the four staged scenes live in
`screenshots/` (cover first): the title over the city, Rio on foot at the
Harbor, a 3-star chase, and the delivered coupe at the Marina garage.

## Layout

- `game/index.html` — page, HUD and screens
- `game/src/config.js` — tuning, story and mission data
- `game/src/city.js` — the procedural city (districts, buildings, roads)
- `game/src/world.js` — the simulation that wires everything together
- `game/src/player.js` — Rio on foot and the third-person camera
- `game/src/driving.js` — arcade car physics, enter/exit
- `game/src/vehicles.js` — traffic, parked cars and police cars
- `game/src/pedestrians.js` — sidewalk crowds that flee danger
- `game/src/wanted.js` — the 0–5 star wanted system
- `game/src/combat.js` — shooting, tracers and enemies
- `game/src/missions.js` — the four story missions
- `game/src/hud.js` — health, cash, stars, minimap, dialogue
- `game/src/audio.js` — synthesised WebAudio sound and music
- `game/src/effects.js` — particles and screen shake
- `game/src/shots.js` — deterministic `?shot=start|play|chase|end` scenes
- `game/src/main.js` — boot, loop and screens
- `game/vendor/three.module.min.js` — three.js 0.170.0 (MIT)
- `main.ts` — copies `game/` + `screenshots/` to `/output` and writes `dossier.json`
