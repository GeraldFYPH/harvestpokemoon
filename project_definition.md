# Harvest Pokemoon - Project Definition

This document is the working source of truth for the current game scope, architecture, and repo workflow.

## Project Overview
Harvest Pokemoon is a browser game that combines:

- A top-down farming overworld rendered on an HTML5 canvas.
- Berry planting, growth, harvesting, and inventory management.
- Wild Pokemon events that target crops on the farm.
- A turn-based battle screen backed by live PokeAPI data and a local battle rules engine.

The current playable loop is:

1. Move around the farm and plant berries.
2. Let crops progress through growth stages.
3. Harvest berries to increase inventory and trigger wild Pokemon conditions.
4. Intercept wild Pokemon before they finish eating a crop.
5. Battle the spawned Pokemon in a separate combat scene.

## Technical Stack
- HTML5 for layout and static entrypoint.
- Vanilla CSS for the UI, battle scene, overlays, and HUD styling.
- Vanilla JavaScript for the overworld, farming simulation, save system, and battle orchestration.
- HTML5 Canvas for the overworld and sprite drawing.
- PokeAPI v2 for Pokemon, move, and type data used by the battle engine.
- GitHub Pages deployment via `.github/workflows/static.yml` on pushes to `main`.

## Repo Structure
- `index.html`: main page shell, battle UI, berry menu, overlays, and action buttons.
- `game.js`: overworld loop, farming systems, wild spawn logic, battle scene integration, save/load, and HUD updates.
- `battle-engine.js`: PokeAPI-backed battle data normalization and round execution logic.
- `style.css`: retro UI styling for overworld overlays, battle scene, move menu, HUD, and transitions.
- `character assets/`, `pokemon assets/`, `map assets/`: sprite and tile assets.

## Current Systems

### Overworld
- Grid-based movement with keyboard controls and touch A/B buttons.
- Walking and running speeds.
- Collision-aware navigation.
- Interaction prompts based on the tile or entity in front of the player.
- Animated sprite handling with fallback warnings if assets are missing.

### Farming
- Ten berry types are currently defined: Cheri, Chesto, Oran, Pecha, Rawst, Aspear, Leppa, Persim, Lum, and Sitrus.
- Each berry has its own grow time, color accent, and harvest yield.
- Farm plots progress through five states: empty, seed, seedling, grown, and ready.
- Planting consumes inventory.
- Harvesting adds the configured berry yield back into the berry bag.
- A top-left "Berry Bag" HUD shows live inventory counts.
- Farm state and player tile position are persisted in `localStorage` under `harvest_pokemoon_save`.

### Wild Pokemon Spawn System
- Spawn rules are centralized in `SPAWN_CONDITIONS` in `game.js`.
- Active spawn trackers currently exist for:
  - Bulbasaur, triggered after harvesting at least 5 Oran berries since its last reset.
  - Charmander, triggered after harvesting at least 5 Rawst berries since its last reset.
- Current code uses `spawnChance: 1`, so a satisfied condition always spawns if no wild Pokemon is already active.
- Wild Pokemon select an available planted crop that is past the seed stage.
- Spawn flow:
  1. Enter from outside the farm area.
  2. Path toward a target crop.
  3. Eat for about 8 seconds with a visible progress bar.
  4. Destroy the crop if not interrupted.
  5. Flee after eating or transition into battle if intercepted.
- A crop that is currently targeted cannot be harvested until the player defeats or clears the wild Pokemon event.

### Battle System
- The battle system was refactored into `battle-engine.js`.
- The engine uses a Gen VII / Ultra Sun / Ultra Moon ruleset label and loads live data from PokeAPI.
- Pokemon battle data is normalized and cached in `localStorage`:
  - `harvest_pokemoon_pokeapi_cache_v2`
  - `harvest_pokemoon_battle_data_v2`
- Battle setup currently uses the player as Charmander and the enemy as the active wild Pokemon species.
- The engine supports:
  - Level-based stat calculation.
  - Up to four learned level-up moves from the selected ruleset.
  - Move PP tracking.
  - Type effectiveness.
  - Stat stage changes.
  - Major status conditions and confusion.
  - End-of-turn status damage.
  - Battle state syncing back into the UI after move resolution.
- The battle UI includes status tags, HP bars, move summaries, a transition flash, and move/back navigation.

### Persistence and Deployment
- Local save data currently stores berry inventory, farm plot state, and player tile position.
- PokeAPI responses and normalized battle data are cached locally to reduce repeated fetches.
- Pushing to `main` triggers the existing GitHub Pages deployment workflow in `.github/workflows/static.yml`.

## Current Workflow

### Development Workflow
1. Update the relevant game files for the requested change.
2. Verify behavior locally when feasible.
3. Update this document if the project scope, systems, balance, or workflow changed.

### Git Workflow
For this repository, every user-requested code or documentation update should end with git steps unless the user explicitly says not to:

1. Review the changed files with `git status`.
2. Stage the relevant files.
3. Create a concise commit message that matches the change.
4. Push the commit to `origin main`.

Notes:
- The remote currently points to `git@github.com:GeraldFYPH/harvestpokemoon.git`.
- Pushing may still require network approval or valid git credentials in the current environment.
- If a push is blocked by sandbox/network policy, request approval and then retry.
- Do not rewrite history unless the user explicitly asks for it.

## Change Log

### [2026-03-09] Battle Engine Refactor
- Added `battle-engine.js` as a dedicated battle rules module.
- Replaced the older lightweight battle flow with a PokeAPI-backed combat engine.
- Normalized Pokemon, move, type, sprite, and ability data against a Gen VII / Ultra Sun / Ultra Moon ruleset.
- Added local caching for raw API responses and normalized battle data.
- Updated the battle UI to show move summaries and visible status tags.

### [2026-03-09] Battle Sync And Spawn Fixes
- Corrected battle state sync handling so UI updates reflect post-action state more reliably.
- Tightened farm spawn checks to align wild encounters with the current crop state.

### [2026-03-05] Stability And UX Improvements
- Capped the dust particle system to avoid runaway memory growth.
- Added `ctx.save()` and `ctx.restore()` protection around complex rendering paths.
- Switched animation timing to `performance.now()`-based flow for stable sparkle timing.
- Reset canvas state at the start of frames to prevent visual state leakage.
- Fixed crop drawing issues caused by invalid `ctx.ellipse` usage.
- Replaced procedural plot backgrounds with `map assets/emptyplot.png`.
- Added a pulsing target indicator on the tile the player is facing.
- Added keyboard navigation and confirmation support in the berry planting menu.
- Removed the default berry menu selection to avoid accidental planting.

### [2026-03-05] Wild Pokemon Crop Event System
- Replaced the static overworld placeholder with condition-based wild Pokemon events.
- Added Bulbasaur and Charmander as crop-driven wild encounters.
- Added crop targeting, eating progress, crop destruction, and flee behavior.
- Added interception-based battle entry from the overworld.
