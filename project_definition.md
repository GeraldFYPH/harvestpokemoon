# Harvest Pokemoon - Project Definition

This document serves as the primary onboarding source for AI assistants and developers. It defines the project's core concepts, architecture, and tracks changes to ensure continuity.

## 🌟 Project Overview
**Harvest Pokemoon** is a hybrid game that combines a **Pokémon-inspired turn-based battle system** with a **berry farming simulator**. The game features a retro Game Boy aesthetic, using a specific green-tinted color palette and pixelated graphics.

## 🏗️ Technical Stack
- **Languages**: HTML5, Vanilla CSS, JavaScript.
- **Graphics**: HTML5 Canvas (Overworld) + Semantic HTML/CSS (UI & Battles).
- **Assets**: 
  - Dynamic procedural pixel art (generated in `game.js`).
  - Animated sprites (e.g., player character in `character assets/`).
- **Typography**: Google Fonts ("Press Start 2P").

## 🧭 Core Systems
1. **Overworld Engine**: 
   - Grid-based movement with collision detection.
   - Dynamic interaction hints based on player facing direction.
   - Particle system for dust effects when running.
2. **Farming System**:
   - Multi-stage growth cycle for various berry types (Lum, Sitrus, etc.).
   - Inventory-based planting and harvesting logic.
3. **Battle System**:
   - Turn-based RPG combat mechanics.
   - Stat-based damage calculation (HP, Atk, Def).
   - State-based UI switching between overworld and combat scenes.
4. **Wild Pokémon Spawn System**:
   - Condition-based spawning defined in `SPAWN_CONDITIONS` registry.
   - Pokémon enter from outside the fence, seek a crop, and eat it over time.
   - An eating progress bar appears below the Pokémon.
   - When eating completes, the crop is destroyed and the Pokémon flees.
   - The player can intercept by pressing A near the Pokémon to trigger a battle.

## 🐾 Wild Pokémon Spawn Conditions
*This section is the source of truth for spawn conditions. Update whenever conditions change.*

| Pokémon   | Condition                                    | Spawn Chance | Resets On         |
|-----------|----------------------------------------------|--------------|-------------------|
| Bulbasaur | Player harvests ≥5 Oran Berries since reset  | 55%          | Battle or capture |
| Charmander| Player harvests ≥5 Rawst Berries since reset | 55%          | Battle or capture |

## 📜 Change Log
*Tracking of all system changes starts here.*

### [2026-03-05] - Stability Overhaul (Crash & Glitch Fixes)
- **Memory Safety**: Capped the `dustParticles` system at 100 particles to prevent memory leaks during long run sessions.
- **Visual Stability**: Implemented `ctx.save()` and `ctx.restore()` in complex drawing functions to prevent state leakage (green pixel glitches).
- **Animation Timing**: Switched to `performance.now()` with modulo for consistent sparkle animations, avoiding floating-point precision issues.
- **Canvas Robustness**: Added global state resets at the beginning of each frame to ensure a clean drawing environment.
- **Bug Fix**: Corrected invalid `ctx.ellipse` calls that were missing required arguments, specifically in the `STAGE_GROWN` crop drawing logic.
- **Visual Improvements**: Replaced procedural farm plot backgrounds with a custom texture (`map assets/emptyplot.png`).
- **QoL Features**: 
  - Added a pulsing visual "target indicator" to tiles the player is facing.
  - Implemented keyboard navigation (Arrow Keys) and A-button confirmation (Z key) for the berry planting menu.
  - Removed default selection from the berry menu to prevent accidental planting.
### [2026-03-05] - Wild Pokémon Spawn System
- Replaced the static always-visible Bulbasaur placeholder with a full condition-based spawn engine.
- Bulbasaur now spawns with 55% chance after the player harvests ≥5 Oran Berries.
- Pokémon enter from outside the fence, walk to a random crop, and eat it over ~8 seconds.
- A progress bar displays below the Pokémon while eating; crop is destroyed on completion.
- Pokémon flees off the right edge after eating; player can press A nearby to trigger battle.
- Harvest counters and spawn conditions defined in extensible `SPAWN_CONDITIONS` registry.

### [2026-03-05] - Added Charmander
- Added Charmander as a wild Pokémon spawn option.
- Charmander spawns with 55% chance after the player harvests ≥5 Rawst Berries.
- Updated encounter text and battle sprites to dynamically reflect either Bulbasaur or Charmander.
