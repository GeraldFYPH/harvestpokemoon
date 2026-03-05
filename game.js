// ══════════════════════════════════════════════
//  SPRITE SHEET CONFIG
//  Sheet: player1sprites.png  — 3 cols × 4 rows, 128×128 px per frame
//  Row 0=Down  Row 1=Up  Row 2=Left  Row 3=Right
//  Col 0=Idle  Col 1=Walk1  Col 2=Walk2
//
//  Controls:
//    Arrow Keys / WASD  → move
//    Shift (hold)       → run
//    Z / Space          → interact / plant / harvest  (A)
//    X                  → back / cancel               (B)
// ══════════════════════════════════════════════
const FRAME_W = 128;
const FRAME_H = 128;
const DIR_ROW = { down: 0, up: 1, left: 2, right: 3 };
const WALK_SPEED = 2;
const RUN_SPEED = 4;

const playerSheet = new Image();
playerSheet.src = 'character assets/player1sprites.png';
let sheetReady = false;
playerSheet.onload = () => { sheetReady = true; };
playerSheet.onerror = () => { console.warn('player1sprites.png not found — using fallback.'); };

const bulbasaurSheet = new Image();
bulbasaurSheet.src = 'pokemon assets/overworld/bulbasaur.png';
let bulbasaurReady = false;
bulbasaurSheet.onload = () => { bulbasaurReady = true; };
bulbasaurSheet.onerror = () => { console.warn('bulbasaur.png not found — using fallback.'); };

const farmTileImg = new Image();
farmTileImg.src = 'map assets/emptyplot.png';
let farmPlotReady = false;
farmTileImg.onload = () => { farmPlotReady = true; };

// ══════════════════════════════════════════════
//  BERRY DATA
// ══════════════════════════════════════════════
// growTime = seconds per growth stage (4 stages: seed→seedling→grown→ready)
// color    = accent color used in procedural art placeholder
// yield    = how many berries harvested
const BERRIES = [
  { id: 'cheri', name: 'Cheri Berry', color: '#e03030', growTime: 10, yield: 2 },
  { id: 'chesto', name: 'Chesto Berry', color: '#4040d0', growTime: 15, yield: 2 },
  { id: 'oran', name: 'Oran Berry', color: '#1888e8', growTime: 12, yield: 3 },
  { id: 'pecha', name: 'Pecha Berry', color: '#f080c0', growTime: 10, yield: 2 },
  { id: 'rawst', name: 'Rawst Berry', color: '#30b830', growTime: 12, yield: 2 },
  { id: 'aspear', name: 'Aspear Berry', color: '#f0f040', growTime: 10, yield: 2 },
  { id: 'leppa', name: 'Leppa Berry', color: '#e06018', growTime: 18, yield: 4 },
  { id: 'persim', name: 'Persim Berry', color: '#c860c8', growTime: 14, yield: 3 },
  { id: 'lum', name: 'Lum Berry', color: '#50c050', growTime: 24, yield: 1 },
  { id: 'sitrus', name: 'Sitrus Berry', color: '#f8c840', growTime: 20, yield: 3 },
];

// Player's berry inventory  { berryId: count }
const berryBag = {};
BERRIES.forEach(b => { berryBag[b.id] = 3; }); // start with 3 of each for testing

// ── Growth stages ──────────────────────────────
// 0=empty  1=seed  2=seedling  3=grown  4=ready
const STAGE_EMPTY = 0;
const STAGE_SEED = 1;
const STAGE_SEEDLING = 2;
const STAGE_GROWN = 3;
const STAGE_READY = 4;

// farmPlots: key = "tx,ty", value = { berryId, stage, plantedAt, stageStartAt }
const farmPlots = {};

function getFarmKey(tx, ty) { return `${tx},${ty}`; }

function plantBerry(tx, ty, berryId) {
  const now = Date.now();
  farmPlots[getFarmKey(tx, ty)] = {
    berryId,
    stage: STAGE_SEED,
    stageStartAt: now,
  };
  berryBag[berryId] = Math.max(0, (berryBag[berryId] || 0) - 1);
  updateFarmHUD();
  saveGame();
}

function harvestPlot(tx, ty) {
  const key = getFarmKey(tx, ty);
  const plot = farmPlots[key];
  if (!plot || plot.stage !== STAGE_READY) return false;
  const berry = BERRIES.find(b => b.id === plot.berryId);
  const amt = berry ? berry.yield : 2;
  berryBag[plot.berryId] = (berryBag[plot.berryId] || 0) + amt;
  // Harvest tracking for spawn conditions
  if (plot.berryId === 'oran') spawnTrackers.bulbasaur.oranHarvestCount += amt;
  if (plot.berryId === 'rawst') spawnTrackers.charmander.rawstHarvestCount += amt;
  farmPlots[key] = { berryId: null, stage: STAGE_EMPTY, stageStartAt: Date.now() };
  updateFarmHUD();
  saveGame();
  setTimeout(checkSpawnConditions, 2000 + Math.random() * 3000); // 2-5s delay after harvest
  return true;
}

function updateFarmGrowth() {
  const now = Date.now();
  let changed = false;
  Object.entries(farmPlots).forEach(([key, plot]) => {
    if (!plot.berryId || plot.stage === STAGE_READY || plot.stage === STAGE_EMPTY) return;
    const berry = BERRIES.find(b => b.id === plot.berryId);
    if (!berry) return;
    const elapsed = (now - plot.stageStartAt) / 1000; // seconds
    if (elapsed >= berry.growTime) {
      plot.stage++;
      plot.stageStartAt = now;
      changed = true;
    }
  });
  if (changed) saveGame();
}

// ══════════════════════════════════════════════
//  PIXEL ART HELPERS
// ══════════════════════════════════════════════
function drawPixelArt(ctx, pixels, x, y, scale = 1) {
  pixels.forEach(([px, py, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + px * scale, y + py * scale, scale, scale);
  });
}

// ── Procedural farm tile art ───────────────────
// Draws a tilled soil square with optional crop stage overlay
function drawFarmTile(sx, sy, tw, th, plot) {
  ctx.save();
  // Base: tilled soil
  if (farmPlotReady) {
    ctx.drawImage(farmTileImg, sx, sy, tw, th);
  } else {
    // Fallback: tilled soil — dark brown furrows
    ctx.fillStyle = '#5c3a1e';
    ctx.fillRect(sx, sy, tw, th);
    // Furrow lines
    ctx.fillStyle = '#3d2510';
    for (let row = 0; row < 3; row++) {
      const fy = sy + Math.round((row / 3) * th + th * 0.1);
      ctx.fillRect(sx + 2, fy, tw - 4, Math.max(2, Math.round(th * 0.08)));
    }
  }
  // Light soil highlights
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(sx + 3, sy + 3, Math.round(tw * 0.2), Math.round(th * 0.1));
  ctx.fillRect(sx + Math.round(tw * 0.6), sy + Math.round(th * 0.55), Math.round(tw * 0.2), Math.round(th * 0.1));

  if (!plot || plot.stage === STAGE_EMPTY) return;

  const berry = BERRIES.find(b => b.id === plot.berryId);
  const bc = berry ? berry.color : '#ffffff';
  const cx = sx + Math.round(tw / 2);
  const cy = sy + Math.round(th / 2);
  const unit = Math.round(Math.min(tw, th) / 8);

  if (plot.stage === STAGE_SEED) {
    // Small mound + tiny sprout nub
    ctx.fillStyle = '#7a5230';
    ctx.beginPath();
    ctx.ellipse(cx, cy + unit, unit * 2, unit, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40a020';
    ctx.fillRect(cx - unit / 2, cy - unit, Math.max(2, unit), unit * 2);
  }

  if (plot.stage === STAGE_SEEDLING) {
    // Stem with two small leaves
    ctx.fillStyle = '#40a020';
    ctx.fillRect(cx - Math.max(1, unit / 2), cy - unit * 2, Math.max(2, unit), unit * 3);
    // Left leaf
    ctx.fillStyle = '#58c030';
    ctx.beginPath();
    ctx.ellipse(cx - unit * 2, cy - unit, unit * 1.5, unit * 0.8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    // Right leaf
    ctx.beginPath();
    ctx.ellipse(cx + unit * 2, cy - unit * 1.5, unit * 1.5, unit * 0.8, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (plot.stage === STAGE_GROWN) {
    // Fuller plant — stem + bigger leaves + small unripe berry
    ctx.fillStyle = '#30882a';
    ctx.fillRect(cx - Math.max(1, unit / 2), cy - unit * 3, Math.max(2, unit), unit * 4);
    ctx.fillStyle = '#50b038';
    // Three leaves
    [[-2.5, -2.5, -0.5], [2.5, -2, 0.5], [0, -3.5, 0]].forEach(([lx, ly, angle]) => {
      ctx.save();
      ctx.translate(cx + unit * lx, cy + unit * ly);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, unit * 2, unit * 1, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    // Tiny unripe berry (desaturated version of berry color)
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(cx + unit, cy - unit * 3, unit * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  if (plot.stage === STAGE_READY) {
    // Full plant with coloured ripe berries
    // Vines
    ctx.strokeStyle = '#30882a';
    ctx.lineWidth = Math.max(2, unit * 0.6);
    ctx.beginPath();
    ctx.moveTo(cx, cy + unit);
    ctx.quadraticCurveTo(cx - unit * 2, cy - unit, cx - unit * 1.5, cy - unit * 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + unit);
    ctx.quadraticCurveTo(cx + unit * 2, cy, cx + unit * 2, cy - unit * 2.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - unit * 3.5);
    ctx.stroke();
    // Leaves
    ctx.fillStyle = '#50b038';
    [[-1.5, -1.5], [2, -1], [0.5, -3]].forEach(([lx, ly]) => {
      ctx.beginPath();
      ctx.ellipse(cx + unit * lx, cy + unit * ly, unit * 1.8, unit * 0.9, lx * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    // Ripe berries
    const berryPositions = [[-1.5, -3.5], [2, -2.8], [0, -4], [1, -1.5]];
    berryPositions.forEach(([bx, by]) => {
      const brx = cx + unit * bx;
      const bry = cy + unit * by;
      ctx.fillStyle = bc;
      ctx.beginPath();
      ctx.arc(brx, bry, unit * 0.9, 0, Math.PI * 2);
      ctx.fill();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(brx - unit * 0.25, bry - unit * 0.25, unit * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Sparkle animation
    const t = (performance.now() % 100000) / 400;
    const sparkles = [
      [cx - unit * 2.5, cy - unit * 4],
      [cx + unit * 2.5, cy - unit * 3],
      [cx, cy - unit * 5],
    ];
    sparkles.forEach(([spx, spy], i) => {
      const phase = Math.sin(t + i * 2.1);
      const alpha = Math.max(0, phase);
      const radius = unit * 0.5 * (0.5 + alpha * 0.5);
      if (alpha < 0.1) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      // 4-point star
      ctx.fillStyle = '#ffffff';
      ctx.translate(spx, spy);
      ctx.rotate(t * 0.5 + i);
      for (let arm = 0; arm < 4; arm++) {
        ctx.save();
        ctx.rotate((arm * Math.PI) / 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-radius * 0.3, -radius * 0.3);
        ctx.lineTo(0, -radius * 2);
        ctx.lineTo(radius * 0.3, -radius * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

// ── Battle sprite pixel art ────────────────────
const SPRITES = {
  wildPoke: (() => {
    const p = [];
    for (let x = 2; x <= 5; x++) for (let y = 0; y <= 1; y++) p.push([x, y, '#40a080']);
    for (let x = 1; x <= 6; x++) for (let y = 2; y <= 5; y++) p.push([x, y, '#78c850']);
    for (let x = 2; x <= 5; x++) for (let y = 6; y <= 7; y++) p.push([x, y, '#78c850']);
    p.push([2, 3, '#c02020'], [5, 3, '#c02020'], [3, 5, '#202020'], [4, 5, '#202020']);
    return p;
  })(),
  bulbasaur: (() => {
    const p = [];
    for (let x = 2; x <= 13; x++) for (let y = 6; y <= 13; y++) p.push([x, y, '#78c850']);
    for (let x = 5; x <= 10; x++) for (let y = 8; y <= 12; y++) p.push([x, y, '#a0e070']);
    for (let x = 3; x <= 12; x++) for (let y = 1; y <= 7; y++) p.push([x, y, '#78c850']);
    for (let x = 4; x <= 11; x++) p.push([x, 0, '#78c850']);
    p.push([5, 3, '#c02020'], [10, 3, '#c02020'], [5, 4, '#902010'], [10, 4, '#902010']);
    p.push([3, 8, '#5aa040'], [3, 9, '#5aa040'], [12, 8, '#5aa040'], [12, 9, '#5aa040']);
    for (let x = 5; x <= 10; x++) for (let y = 0; y <= 3; y++) p.push([x, y, '#40a080']);
    for (let x = 6; x <= 9; x++) p.push([x, 0, '#60c0a0']);
    for (let y = 13; y <= 15; y++) p.push([3, y, '#78c850'], [4, y, '#78c850'], [11, y, '#78c850'], [12, y, '#78c850']);
    p.push([2, 15, '#5a9040'], [3, 15, '#5a9040'], [4, 15, '#5a9040'], [11, 15, '#5a9040'], [12, 15, '#5a9040'], [13, 15, '#5a9040']);
    return p;
  })(),
  charmanderBack: (() => {
    const p = [];
    for (let y = 10; y <= 14; y++) p.push([13, y, '#f08030'], [14, y, '#f08030']);
    p.push([14, 14, '#f08030'], [15, 14, '#f08030'], [15, 13, '#f0a000']);
    p.push([14, 15, '#f0d000'], [15, 15, '#f0a000'], [15, 16, '#f06000']);
    for (let x = 4; x <= 11; x++) for (let y = 5; y <= 12; y++) p.push([x, y, '#f08030']);
    for (let x = 5; x <= 10; x++) for (let y = 7; y <= 11; y++) p.push([x, y, '#f5c870']);
    for (let x = 4; x <= 11; x++) for (let y = 0; y <= 5; y++)  p.push([x, y, '#f08030']);
    p.push([4, 13, '#f08030'], [5, 13, '#f08030'], [4, 14, '#c05020'], [5, 14, '#c05020']);
    p.push([10, 13, '#f08030'], [11, 13, '#f08030'], [10, 14, '#c05020'], [11, 14, '#c05020']);
    return p;
  })(),
  charmanderFront: (() => {
    const p = [];
    for (let x = 2; x <= 5; x++) for (let y = 0; y <= 1; y++) p.push([x, y, '#d05030']);
    for (let x = 1; x <= 6; x++) for (let y = 2; y <= 5; y++) p.push([x, y, '#f08030']);
    for (let x = 2; x <= 5; x++) for (let y = 6; y <= 7; y++) p.push([x, y, '#f08030']);
    p.push([2, 3, '#202020'], [5, 3, '#202020'], [3, 5, '#f5c870'], [4, 5, '#f5c870']);
    return p;
  })(),
};

function drawBattleSprites() {
  const ec = document.getElementById('enemy-sprite');
  const ectx = ec.getContext('2d');
  ectx.clearRect(0, 0, ec.width, ec.height);
  const enemySprite = (wildPokemon.species === 'charmander') ? SPRITES.charmanderFront : SPRITES.bulbasaur;
  drawPixelArt(ectx, enemySprite, 8, 6, 6);
  const pc = document.getElementById('player-back-sprite');
  const pctx = pc.getContext('2d');
  pctx.clearRect(0, 0, pc.width, pc.height);
  drawPixelArt(pctx, SPRITES.charmanderBack, 4, 2, 6);
}

// ══════════════════════════════════════════════
//  OVERWORLD ENGINE
// ══════════════════════════════════════════════
const canvas = document.getElementById('overworld');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

const LOGIC_W = 340;
const LOGIC_H = 280;
const TILE = 16;
const MAP_W = 20;
const MAP_H = 18;

// Tile IDs:  0=grass  1=tall-grass  2=path  3=tree  4=farm-plot
const MAP = [
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
  [3, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 2, 4, 4, 4, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 2, 4, 4, 4, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 1, 1, 0, 0, 2, 4, 4, 4, 0, 2, 0, 0, 0, 1, 1, 0, 0, 0, 3],
  [3, 1, 1, 0, 0, 0, 0, 2, 0, 0, 2, 0, 0, 0, 1, 1, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 2, 2, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
  [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
];

// Pre-populate farmPlots entries for all farm tiles so they have a state
for (let ty = 0; ty < MAP_H; ty++) {
  for (let tx = 0; tx < MAP_W; tx++) {
    if (MAP[ty][tx] === 4) {
      farmPlots[getFarmKey(tx, ty)] = { berryId: null, stage: STAGE_EMPTY, stageStartAt: 0 };
    }
  }
}

const TILE_COLORS = { 0: '#5a9e3b', 1: '#4a8530', 2: '#c8a96e', 3: '#2d6e20', 4: '#5c3a1e' };

// ── Player ─────────────────────────────────────
const player = {
  tx: 10, ty: 9, px: 10 * TILE, py: 9 * TILE,
  targetTX: 10, targetTY: 9, targetPX: 10 * TILE, targetPY: 9 * TILE,
  moving: false, running: false, dir: 'down',
};

// ── Wild Pokémon Spawn System ─────────────────
// Dynamic state — replaced the static always-visible placeholder
const wildPokemon = {
  active: false,          // Is a Pokémon currently on the map?
  species: null,          // e.g. 'bulbasaur'
  px: 0, py: 0,          // Current pixel position
  targetPX: 0, targetPY: 0,
  state: 'idle',          // 'entering' | 'seeking' | 'eating' | 'fleeing'
  targetCropKey: null,    // farmPlots key of the crop being targeted
  eatProgress: 0,         // 0.0 – 1.0
  eatDuration: 8000,      // ms to fully eat one crop
  eatStartTime: 0,
  speed: 0.8,
  fleeSpeed: 3.5,
  dir: 'down',       // Current facing direction for sprite row selection
};

// ── Spawn Condition Registry ──────────────────
// Add new entries here when new Pokémon conditions are designed.
const spawnTrackers = {
  bulbasaur: { oranHarvestCount: 0 },
  charmander: { rawstHarvestCount: 0 },
};

const SPAWN_CONDITIONS = [
  {
    species: 'bulbasaur',
    // CONDITION: harvest ≥5 Oran Berries since last encounter
    check: () => spawnTrackers.bulbasaur.oranHarvestCount >= 5,
    onReset: () => { spawnTrackers.bulbasaur.oranHarvestCount = 0; },
    spawnChance: 0.55,   // 55% chance once threshold met
  },
  {
    species: 'charmander',
    // CONDITION: harvest ≥5 Rawst Berries since last encounter
    check: () => spawnTrackers.charmander.rawstHarvestCount >= 5,
    onReset: () => { spawnTrackers.charmander.rawstHarvestCount = 0; },
    spawnChance: 0.55,
  },
  // Future Pokémon conditions go here
];

function getReadyCrops() {
  return Object.entries(farmPlots).filter(([, p]) =>
    p.berryId && p.stage > STAGE_SEED
  );
}

function spawnWildPokemon(species) {
  const crops = getReadyCrops();
  console.log(`[Spawn] Attempting to spawn ${species}. Ready crops: ${crops.length}`);
  if (crops.length === 0) return; // No crops to eat — bail

  const [cropKey] = crops[Math.floor(Math.random() * crops.length)];
  const [ctxStr, ctyStr] = cropKey.split(',');
  const ctx2 = parseInt(ctxStr), cty2 = parseInt(ctyStr);

  // Enter from the left edge of the map, random row inside fence
  const entryPX = -TILE;
  const entryPY = (5 + Math.floor(Math.random() * 6)) * TILE;

  wildPokemon.active = true;
  wildPokemon.species = species;
  wildPokemon.px = entryPX;
  wildPokemon.py = entryPY;
  wildPokemon.targetCropKey = cropKey;
  wildPokemon.targetPX = ctx2 * TILE;
  wildPokemon.targetPY = cty2 * TILE;
  wildPokemon.state = 'entering';
  wildPokemon.eatProgress = 0;
  wildPokemon.speed = 0.8;
}

function checkSpawnConditions() {
  if (wildPokemon.active) return; // Already a Pokémon on the map
  for (const cond of SPAWN_CONDITIONS) {
    if (cond.check() && Math.random() < cond.spawnChance) {
      spawnWildPokemon(cond.species);
      break;
    }
  }
}

function updateWildPokemon() {
  if (!wildPokemon.active) return;
  const wp = wildPokemon;

  if (wp.state === 'entering' || wp.state === 'seeking') {
    const dx = wp.targetPX - wp.px, dy = wp.targetPY - wp.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= wp.speed + 0.5) {
      wp.px = wp.targetPX;
      wp.py = wp.targetPY;
      if (wp.state === 'entering' || wp.state === 'seeking') {
        wp.state = 'eating';
        wp.eatStartTime = performance.now();
        wp.eatProgress = 0;
      }
    } else {
      // Update direction based on primary axis of movement
      if (Math.abs(dx) >= Math.abs(dy)) {
        wp.dir = dx > 0 ? 'right' : 'left';
      } else {
        wp.dir = dy > 0 ? 'down' : 'up';
      }
      wp.px += (dx / dist) * wp.speed;
      wp.py += (dy / dist) * wp.speed;
    }
  }

  if (wp.state === 'eating') {
    wp.eatProgress = Math.min(1, (performance.now() - wp.eatStartTime) / wp.eatDuration);
    if (wp.eatProgress >= 1) {
      // Crop is eaten — destroy it
      if (wp.targetCropKey && farmPlots[wp.targetCropKey]) {
        farmPlots[wp.targetCropKey] = { berryId: null, stage: STAGE_EMPTY, stageStartAt: Date.now() };
        saveGame();
      }
      // Start fleeing off the right edge
      wp.state = 'fleeing';
      wp.targetPX = (MAP_W + 2) * TILE;
      wp.targetPY = wp.py;
      wp.speed = wp.fleeSpeed;
    }
  }

  if (wp.state === 'fleeing') {
    const dx = wp.targetPX - wp.px;
    if (Math.abs(dx) <= wp.speed + 0.5) {
      wp.active = false;
      wp.state = 'idle';
    } else {
      wp.dir = 'right';
      wp.px += wp.speed;
    }
  }
}

function drawWildPokemon(camX, camY) {
  if (!wildPokemon.active) return;
  const wp = wildPokemon;
  const sx = Math.floor((wp.px - camX) * scaleX);
  const sy = Math.floor((wp.py - camY) * scaleY);

  ctx.save();

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(sx + Math.round(6 * scaleX), sy + Math.round(10 * scaleY), Math.round(7 * scaleX), Math.round(3 * scaleY), 0, 0, Math.PI * 2);
  ctx.fill();

  // Animated sprite
  if (wp.species === 'bulbasaur' && bulbasaurReady) {
    const row = DIR_ROW[wp.dir] ?? 0;
    // Same time-based walk animation as the player: strictly walk1 ↔ walk2.
    const moving = (wp.state === 'entering' || wp.state === 'seeking' || wp.state === 'fleeing');
    let col = 0;
    if (moving) {
      col = (Math.floor(Date.now() / 160) % 2 === 0) ? 1 : 2;
    }
    const drawW = Math.round(TILE * 2 * scaleX);
    const drawH = Math.round(TILE * 2 * scaleY);
    const offsetX = Math.round((drawW - TILE * scaleX) / 2);
    ctx.drawImage(
      bulbasaurSheet,
      col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H,
      sx - offsetX, sy - Math.round(TILE * scaleY), drawW, drawH
    );
  } else if (wp.species === 'charmander') {
    const ps = Math.round(2.5 * Math.min(scaleX, scaleY));
    drawPixelArt(ctx, SPRITES.charmanderFront, sx, sy + Math.round(scaleY), ps);
  } else {
    // Fallback: draw the procedural wildPoke sprite
    const ps = Math.round(2.5 * Math.min(scaleX, scaleY));
    drawPixelArt(ctx, SPRITES.wildPoke, sx, sy + Math.round(scaleY), ps);
  }

  // Attention sparkle while not eating and not fleeing
  if (wp.state === 'entering' || wp.state === 'seeking') {
    if (Math.floor(Date.now() / 300) % 2 === 0) {
      ctx.fillStyle = '#ffff80';
      ctx.fillRect(sx + Math.round(14 * scaleX), sy - Math.round(2 * scaleY), Math.round(2 * scaleX), Math.round(2 * scaleY));
    }
  }

  // Progress bar while eating
  if (wp.state === 'eating') {
    const bw = Math.round(20 * scaleX);
    const bh = Math.round(4 * scaleY);
    const bx = sx - Math.round(2 * scaleX);
    const by = sy + Math.round(18 * scaleY);
    ctx.fillStyle = '#0f380f';
    ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
    ctx.fillStyle = '#c00000';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#30c030';
    ctx.fillRect(bx, by, Math.round(bw * wp.eatProgress), bh);
  }

  ctx.restore();
}

// ── Canvas / scale ─────────────────────────────
const SCREEN_W = 960;
const SCREEN_H = 720;
let scaleX = SCREEN_W / LOGIC_W;
let scaleY = SCREEN_H / LOGIC_H;

function resizeCanvas() {
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  scaleX = SCREEN_W / LOGIC_W;
  scaleY = SCREEN_H / LOGIC_H;
  ctx.imageSmoothingEnabled = false;
  const screen = document.getElementById('screen');
  const fit = Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H, 1);
  screen.style.transform = fit < 1 ? `scale(${fit})` : '';
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function updateCamera() {
  return {
    camX: player.px + TILE / 2 - LOGIC_W / 2,
    camY: player.py + TILE / 2 - LOGIC_H / 2,
  };
}

function tileBlocked(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return MAP[ty][tx] === 3;
}

// ══════════════════════════════════════════════
//  TILE DRAWING
// ══════════════════════════════════════════════
function drawTile(tx, ty, camX, camY) {
  const type = MAP[ty]?.[tx] ?? 0;
  const sx = Math.floor((tx * TILE - camX) * scaleX);
  const sy = Math.floor((ty * TILE - camY) * scaleY);
  const tw = Math.ceil(TILE * scaleX) + 1;
  const th = Math.ceil(TILE * scaleY) + 1;

  // Farm plot — handled separately with full art
  if (type === 4) {
    const plot = farmPlots[getFarmKey(tx, ty)] || null;
    drawFarmTile(sx, sy, tw, th, plot);
    return;
  }

  ctx.fillStyle = TILE_COLORS[type] || '#5a9e3b';
  ctx.fillRect(sx, sy, tw, th);

  if (type === 0 || type === 1) {
    ctx.fillStyle = type === 0 ? '#4a8530' : '#3a7020';
    if ((tx + ty) % 3 === 0) {
      ctx.fillRect(sx + Math.round(3 * scaleX), sy + Math.round(4 * scaleY), Math.round(2 * scaleX), Math.round(3 * scaleY));
      ctx.fillRect(sx + Math.round(9 * scaleX), sy + Math.round(6 * scaleY), Math.round(2 * scaleX), Math.round(4 * scaleY));
    }
    if ((tx * 2 + ty) % 4 === 0) ctx.fillRect(sx + Math.round(6 * scaleX), sy + Math.round(2 * scaleY), Math.round(scaleX), Math.round(3 * scaleY));
  }
  if (type === 3) {
    ctx.fillStyle = '#1a4a10';
    ctx.fillRect(sx + Math.round(2 * scaleX), sy + Math.round(2 * scaleY), Math.round((TILE - 4) * scaleX), Math.round((TILE - 4) * scaleY));
    ctx.fillStyle = '#2d6e20';
    ctx.fillRect(sx + Math.round(4 * scaleX), sy, Math.round((TILE - 8) * scaleX), Math.round(6 * scaleY));
  }
}

// ── Player sprite ──────────────────────────────
function drawPlayerSprite(psx, psy) {
  if (sheetReady) {
    const row = DIR_ROW[player.dir] ?? 0;
    // Check if player is moving OR holding a directional key (to prevent 1-frame flashes to idle between tiles)
    const isHoldingMoveKey = keys['ArrowUp'] || keys['w'] || keys['W'] ||
      keys['ArrowDown'] || keys['s'] || keys['S'] ||
      keys['ArrowLeft'] || keys['a'] || keys['A'] ||
      keys['ArrowRight'] || keys['d'] || keys['D'];

    let col = 0;
    if (player.moving || (isHoldingMoveKey && gameState === 'overworld')) {
      col = (Math.floor(Date.now() / 160) % 2 === 0) ? 1 : 2;
    }
    const drawW = Math.round(TILE * 2 * scaleX);
    const drawH = Math.round(TILE * 2 * scaleY);
    const offsetX = Math.round((drawW - TILE * scaleX) / 2);
    ctx.drawImage(playerSheet, col * FRAME_W, row * FRAME_H, FRAME_W, FRAME_H,
      psx - offsetX, psy - Math.round(TILE * scaleY), drawW, drawH);
  }
}

// ── Dust particles ─────────────────────────────
const dustParticles = [];
function spawnDust(x, y) {
  if (dustParticles.length > 100) return; // Cap particles to prevent memory issues
  for (let i = 0; i < 2; i++) {
    dustParticles.push({
      x: x + (Math.random() - 0.5) * 8 * scaleX, y: y + 14 * scaleY,
      vx: (Math.random() - 0.5) * scaleX * 1.5, vy: -Math.random() * scaleY * 0.8, life: 1.0,
    });
  }
}
function updateDrawDust(psx, psy) {
  if (player.moving && player.running && Math.random() < 0.5) spawnDust(psx, psy);
  for (let i = dustParticles.length - 1; i >= 0; i--) {
    const d = dustParticles[i];
    d.x += d.vx; d.y += d.vy; d.life -= 0.08;
    if (d.life <= 0) { dustParticles.splice(i, 1); continue; }
    ctx.globalAlpha = d.life * 0.5;
    ctx.fillStyle = '#c8a96e';
    const r = Math.max(1, Math.round(3 * d.life * Math.min(scaleX, scaleY)));
    ctx.fillRect(d.x - r, d.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

// ══════════════════════════════════════════════
//  OVERWORLD DRAW
// ══════════════════════════════════════════════
function drawOverworld() {
  // Reset key canvas states to prevent "sticky" glitches
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#000000';

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const { camX, camY } = updateCamera();

  const startTX = Math.floor(camX / TILE) - 1, startTY = Math.floor(camY / TILE) - 1;
  const endTX = startTX + Math.ceil(LOGIC_W / TILE) + 3, endTY = startTY + Math.ceil(LOGIC_H / TILE) + 3;

  for (let ty = startTY; ty < endTY; ty++) for (let tx = startTX; tx < endTX; tx++) {
    if (ty >= 0 && ty < MAP_H && tx >= 0 && tx < MAP_W) drawTile(tx, ty, camX, camY);
    else {
      ctx.fillStyle = '#2d6e20';
      ctx.fillRect(Math.floor((tx * TILE - camX) * scaleX), Math.floor((ty * TILE - camY) * scaleY),
        Math.ceil(TILE * scaleX) + 1, Math.ceil(TILE * scaleY) + 1);
    }
  }

  // Facing tile for interaction indicators and hints
  const faceX = player.tx + (player.dir === 'right' ? 1 : player.dir === 'left' ? -1 : 0);
  const faceY = player.ty + (player.dir === 'down' ? 1 : player.dir === 'up' ? -1 : 0);

  // Draw target indicator for farm plots
  if (MAP[faceY]?.[faceX] === 4) {
    const tsx = Math.floor((faceX * TILE - camX) * scaleX);
    const tsy = Math.floor((faceY * TILE - camY) * scaleY);
    const pulse = Math.sin(performance.now() / 200) * 0.15 + 0.25;
    ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
    ctx.fillRect(tsx, tsy, Math.ceil(TILE * scaleX), Math.ceil(TILE * scaleY));
  }

  // Wild Pokémon
  drawWildPokemon(camX, camY);

  // Player shadow + dust + sprite
  const psx = Math.floor((player.px - camX) * scaleX);
  const psy = Math.floor((player.py - camY) * scaleY);
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(psx + Math.round(6 * scaleX), psy + Math.round(10 * scaleY), Math.round(7 * scaleX), Math.round(3 * scaleY), 0, 0, Math.PI * 2);
  ctx.fill();
  updateDrawDust(psx, psy);
  drawPlayerSprite(psx, psy);

  // Run badge
  if (player.running) {
    const bx = Math.round(8 * scaleX), by = Math.round(8 * scaleY);
    ctx.fillStyle = '#0f380f';
    ctx.fillRect(bx, by, Math.round(42 * scaleX), Math.round(13 * scaleY));
    ctx.fillStyle = '#c8ff00';
    ctx.font = `bold ${Math.round(7 * Math.min(scaleX, scaleY))}px "Press Start 2P"`;
    ctx.fillText('>> RUN', bx + Math.round(3 * scaleX), by + Math.round(10 * scaleY));
  }

  // Interact hints

  // Wild pokémon hint
  if (wildPokemon.active && wildPokemon.state !== 'fleeing') {
    const wptx = Math.floor(wildPokemon.px / TILE);
    const wpty = Math.floor(wildPokemon.py / TILE);
    const dist = Math.abs(player.tx - wptx) + Math.abs(player.ty - wpty);
    if (dist <= 2) drawHint(psx, psy, 'A: BATTLE');
  }

  // Farm plot hint
  if (MAP[faceY]?.[faceX] === 4) {
    const plot = farmPlots[getFarmKey(faceX, faceY)];
    if (plot) {
      if (plot.stage === STAGE_EMPTY) drawHint(psx, psy, 'A: PLANT');
      if (plot.stage === STAGE_READY) drawHint(psx, psy, 'A: HARVEST');
      if (plot.stage === STAGE_SEED) drawHint(psx, psy, 'SEED...');
      if (plot.stage === STAGE_SEEDLING) drawHint(psx, psy, 'SPROUTING...');
      if (plot.stage === STAGE_GROWN) drawHint(psx, psy, 'GROWING...');
    }
  }
}

function drawHint(psx, psy, text) {
  const hx = psx - Math.round(8 * scaleX), hy = psy - Math.round(22 * scaleY);
  const fw = Math.round(80 * scaleX), fh = Math.round(14 * scaleY);
  ctx.fillStyle = '#0f380f';
  ctx.fillRect(hx, hy, fw, fh);
  ctx.fillStyle = '#9bbc0f';
  ctx.font = `${Math.round(6 * Math.min(scaleX, scaleY))}px "Press Start 2P"`;
  ctx.fillText(text, hx + Math.round(4 * scaleX), hy + Math.round(10 * scaleY));
}

// ══════════════════════════════════════════════
//  FARM HUD
// ══════════════════════════════════════════════
function updateFarmHUD() {
  const list = document.getElementById('farm-hud-list');
  list.innerHTML = '';
  BERRIES.forEach(b => {
    const count = berryBag[b.id] || 0;
    if (count === 0) return;
    const row = document.createElement('div');
    row.className = 'farm-hud-row';
    row.innerHTML = `${b.name.replace(' Berry', '')} <span>x${count}</span>`;
    list.appendChild(row);
  });
}
updateFarmHUD();

// ══════════════════════════════════════════════
//  BERRY MENU UI
// ══════════════════════════════════════════════
let pendingFarmTX = null, pendingFarmTY = null;
let selectedBerryIndex = -1;
let berryButtons = [];

function updateBerrySelection() {
  berryButtons.forEach((btn, i) => {
    if (i === selectedBerryIndex) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
}

function cruiseBerryMenu(delta) {
  if (berryButtons.length === 0) return;
  if (selectedBerryIndex === -1) {
    selectedBerryIndex = delta > 0 ? 0 : berryButtons.length - 1;
  } else {
    selectedBerryIndex = (selectedBerryIndex + delta + berryButtons.length) % berryButtons.length;
  }
  updateBerrySelection();
}

function openBerryMenu(tx, ty) {
  pendingFarmTX = tx;
  pendingFarmTY = ty;
  selectedBerryIndex = -1;
  berryButtons = [];
  const list = document.getElementById('berry-list');
  list.innerHTML = '';
  BERRIES.forEach((b, i) => {
    const count = berryBag[b.id] || 0;
    const btn = document.createElement('button');
    btn.className = 'berry-choice-btn';
    btn.innerHTML = `${b.name}<span class="berry-count">x${count}</span>`;
    btn.tabIndex = -1; // Keep focus off buttons for clean keyboard nav
    btn.disabled = count === 0;
    btn.addEventListener('click', () => {
      const tx = pendingFarmTX;
      const ty = pendingFarmTY;
      closeBerryMenu();
      plantBerry(tx, ty, b.id);
    });
    list.appendChild(btn);
    berryButtons.push(btn);
  });
  document.getElementById('berry-menu').classList.add('active');
  gameState = 'berry-menu';
}

function closeBerryMenu() {
  document.getElementById('berry-menu').classList.remove('active');
  gameState = 'overworld';
  pendingFarmTX = null;
  pendingFarmTY = null;
  selectedBerryIndex = -1;
  berryButtons = [];
}

document.getElementById('berry-cancel-btn').addEventListener('click', closeBerryMenu);

// ══════════════════════════════════════════════
//  INPUT
// ══════════════════════════════════════════════
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();

  if (gameState === 'berry-menu') {
    if (e.key === 'ArrowRight') cruiseBerryMenu(1);
    if (e.key === 'ArrowLeft') cruiseBerryMenu(-1);
    if (e.key === 'ArrowDown') cruiseBerryMenu(5);
    if (e.key === 'ArrowUp') cruiseBerryMenu(-5);
  }

  if (e.key === 'z' || e.key === 'Z' || e.key === ' ') handleAPress();
  if (e.key === 'x' || e.key === 'X') handleBPress();
  if (e.key === 'Escape') handleBPress();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

document.getElementById('btn-a').addEventListener('click', handleAPress);
document.getElementById('btn-b').addEventListener('click', handleBPress);

function handleAPress() {
  if (gameState === 'berry-menu') {
    if (selectedBerryIndex >= 0 && berryButtons[selectedBerryIndex]) {
      if (!berryButtons[selectedBerryIndex].disabled) {
        berryButtons[selectedBerryIndex].click();
      }
    }
    return;
  }
  if (gameState === 'battle') return;

  if (gameState === 'overworld') {
    // Check wild pokémon
    if (wildPokemon.active && wildPokemon.state !== 'fleeing') {
      const wptx = Math.floor(wildPokemon.px / TILE);
      const wpty = Math.floor(wildPokemon.py / TILE);
      const dist = Math.abs(player.tx - wptx) + Math.abs(player.ty - wpty);
      if (dist <= 2) { startBattle(); return; }
    }
    // Check farm plot in facing direction
    const faceX = player.tx + (player.dir === 'right' ? 1 : player.dir === 'left' ? -1 : 0);
    const faceY = player.ty + (player.dir === 'down' ? 1 : player.dir === 'up' ? -1 : 0);
    if (MAP[faceY]?.[faceX] === 4) {
      const plot = farmPlots[getFarmKey(faceX, faceY)];
      if (plot) {
        if (plot.stage === STAGE_EMPTY) { openBerryMenu(faceX, faceY); return; }
        if (plot.stage === STAGE_READY) { harvestPlot(faceX, faceY); return; }
      }
    }
  }
}

function handleBPress() {
  if (gameState === 'berry-menu') { closeBerryMenu(); return; }
  if (document.getElementById('moves-menu').style.display === 'flex') showActions();
}

// ══════════════════════════════════════════════
//  MOVEMENT
// ══════════════════════════════════════════════
let gameState = 'overworld';

function processMovement() {
  if (gameState !== 'overworld') return;
  player.running = !!keys['Shift'];
  const speed = player.running ? RUN_SPEED : WALK_SPEED;

  if (player.moving) {
    const dx = player.targetPX - player.px, dy = player.targetPY - player.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= speed) {
      player.px = player.targetPX; player.py = player.targetPY;
      player.tx = player.targetTX; player.ty = player.targetTY;
      player.moving = false;
    } else {
      player.px += (dx / dist) * speed;
      player.py += (dy / dist) * speed;
    }
    return;
  }

  let dx = 0, dy = 0, dir = player.dir;
  if (keys['ArrowUp'] || keys['w'] || keys['W']) { dy = -1; dir = 'up'; }
  else if (keys['ArrowDown'] || keys['s'] || keys['S']) { dy = 1; dir = 'down'; }
  else if (keys['ArrowLeft'] || keys['a'] || keys['A']) { dx = -1; dir = 'left'; }
  else if (keys['ArrowRight'] || keys['d'] || keys['D']) { dx = 1; dir = 'right'; }

  if (dx || dy) {
    player.dir = dir;
    const ntx = player.tx + dx, nty = player.ty + dy;
    const blockedByPoke = ntx === wildPokemon.tx && nty === wildPokemon.ty && wildPokemon.visible;
    if (!tileBlocked(ntx, nty) && !blockedByPoke) {
      player.targetTX = ntx; player.targetTY = nty;
      player.targetPX = ntx * TILE; player.targetPY = nty * TILE;
      player.moving = true;
    }
  }
}

// ══════════════════════════════════════════════
//  BATTLE SYSTEM
// ══════════════════════════════════════════════
const battle = {
  playerHP: 20, playerMaxHP: 20, enemyHP: 18, enemyMaxHP: 18,
  playerAtk: 6, enemyAtk: 5, turn: 'player', busy: false,
  moves: [
    { name: 'EMBER', power: 8, pp: 10, type: 'fire' },
    { name: 'SCRATCH', power: 5, pp: 15, type: 'normal' },
    { name: 'GROWL', power: 0, pp: 20, type: 'normal', effect: 'lower_atk' },
    { name: 'TAIL WHIP', power: 0, pp: 20, type: 'normal', effect: 'lower_def' },
  ],
};

function startBattle() {
  gameState = 'battle';
  battle.playerHP = battle.playerMaxHP; battle.enemyHP = battle.enemyMaxHP;
  battle.turn = 'player'; battle.busy = false;
  const trans = document.getElementById('battle-transition');
  trans.style.display = 'block';
  setTimeout(() => {
    trans.style.display = 'none';
    document.getElementById('overworld').style.display = 'none';
    document.getElementById('battle-screen').style.display = 'flex';
    document.getElementById('farm-hud').style.display = 'none';
    const wildName = wildPokemon.species ? wildPokemon.species.toUpperCase() : 'POKÉMON';
    document.getElementById('enemy-name').textContent = wildName;
    drawBattleSprites();
    updateHPBars();
    showBattleMsg(`A wild ${wildName} appeared!`, () => {
      showBattleMsg('Go! CHARMANDER!', () => showBattleMsg('What will CHARMANDER do?', showActions));
    });
  }, 700);
}

function endBattle(won) {
  hideBattleUI();

  // Reset spawn conditions for whichever species was encountered
  const cond = SPAWN_CONDITIONS.find(c => c.species === wildPokemon.species);
  if (cond) cond.onReset();

  showBattleMsg(won ? 'You defeated the wild Pokémon!\nGained 24 EXP!' : 'CHARMANDER fainted!', () => {
    setTimeout(() => {
      document.getElementById('battle-screen').style.display = 'none';
      document.getElementById('overworld').style.display = 'block';
      document.getElementById('farm-hud').style.display = 'block';
      gameState = 'overworld';
      wildPokemon.active = false;
      wildPokemon.state = 'idle';
      if (!won) {
        player.tx = 10; player.ty = 9;
        player.px = player.tx * TILE; player.py = player.ty * TILE;
        battle.playerHP = battle.playerMaxHP;
      }
    }, 1200);
  });
}

function updateHPBars() {
  const ePct = Math.max(0, (battle.enemyHP / battle.enemyMaxHP) * 100);
  const eBar = document.getElementById('enemy-hp-bar');
  eBar.style.width = ePct + '%';
  eBar.className = 'hp-bar ' + (ePct > 50 ? 'hp-high' : ePct > 25 ? 'hp-mid' : 'hp-low');
  const pPct = Math.max(0, (battle.playerHP / battle.playerMaxHP) * 100);
  const pBar = document.getElementById('player-hp-bar');
  pBar.style.width = pPct + '%';
  pBar.className = 'hp-bar ' + (pPct > 50 ? 'hp-high' : pPct > 25 ? 'hp-mid' : 'hp-low');
  document.getElementById('player-hp-text').textContent = battle.playerHP + '/' + battle.playerMaxHP;
}

let _twTimer = null;
function showBattleMsg(msg, cb) {
  if (_twTimer) clearInterval(_twTimer);
  const el = document.getElementById('battle-msg');
  hideBattleUI(); el.textContent = ''; let i = 0;
  _twTimer = setInterval(() => {
    el.textContent += msg[i++];
    if (i >= msg.length) { clearInterval(_twTimer); _twTimer = null; if (cb) setTimeout(cb, 600); }
  }, 35);
}
function hideBattleUI() {
  document.getElementById('battle-actions').style.display = 'none';
  document.getElementById('moves-menu').style.display = 'none';
}
function showActions() {
  document.getElementById('battle-msg').textContent = 'What will CHARMANDER do?';
  document.getElementById('battle-actions').style.display = 'flex';
  document.getElementById('moves-menu').style.display = 'none';
  setActionBtnsDisabled(false);
}
function showMoves() {
  document.getElementById('battle-actions').style.display = 'none';
  document.getElementById('moves-menu').style.display = 'flex';
  document.getElementById('battle-msg').textContent = 'Choose a move:';
}
function setActionBtnsDisabled(d) {
  document.querySelectorAll('.battle-btn').forEach(b => b.disabled = d);
  document.querySelectorAll('.move-btn').forEach(b => b.disabled = d);
}

document.getElementById('fight-btn').addEventListener('click', () => { if (!battle.busy) showMoves(); });
document.getElementById('back-btn').addEventListener('click', showActions);
['move1-btn', 'move2-btn', 'move3-btn', 'move4-btn'].forEach((id, i) => {
  document.getElementById(id).addEventListener('click', () => { if (!battle.busy) useMove(i); });
});
document.getElementById('run-btn').addEventListener('click', () => {
  if (battle.busy) return;
  hideBattleUI(); battle.busy = true;
  showBattleMsg('Got away safely!', () => {
    setTimeout(() => {
      document.getElementById('battle-screen').style.display = 'none';
      document.getElementById('overworld').style.display = 'block';
      document.getElementById('farm-hud').style.display = 'block';
      gameState = 'overworld'; battle.busy = false;
    }, 800);
  });
});

function useMove(idx) {
  if (battle.busy) return;
  battle.busy = true; hideBattleUI(); setActionBtnsDisabled(true);
  const move = battle.moves[idx]; let dmg = 0;
  if (move.power > 0) { dmg = Math.max(1, Math.floor(move.power + Math.random() * 3 - 1)); battle.enemyHP = Math.max(0, battle.enemyHP - dmg); }
  if (move.effect === 'lower_atk') battle.enemyAtk = Math.max(1, battle.enemyAtk - 1);
  updateHPBars();
  const es = document.getElementById('enemy-sprite');
  if (dmg > 0) { es.classList.add('hit-flash'); setTimeout(() => es.classList.remove('hit-flash'), 450); }
  showBattleMsg(dmg > 0 ? `CHARMANDER used ${move.name}!\nDealt ${dmg} damage!` : `CHARMANDER used ${move.name}!`, () => {
    if (battle.enemyHP <= 0) { showBattleMsg('BULBASAUR fainted!', () => endBattle(true)); return; }
    setTimeout(enemyTurn, 400);
  });
}

function enemyTurn() {
  const dmg = Math.max(1, Math.floor(battle.enemyAtk + Math.random() * 3 - 1));
  battle.playerHP = Math.max(0, battle.playerHP - dmg); updateHPBars();
  const ps = document.getElementById('player-back-sprite');
  ps.classList.add('shake'); setTimeout(() => ps.classList.remove('shake'), 350);
  const mn = ['TACKLE', 'VINE WHIP'][Math.floor(Math.random() * 2)];
  showBattleMsg(`BULBASAUR used ${mn}!\nDealt ${dmg} damage!`, () => {
    battle.busy = false;
    if (battle.playerHP <= 0) { showBattleMsg('CHARMANDER fainted!', () => endBattle(false)); return; }
    showActions();
  });
}

// ══════════════════════════════════════════════
//  MAIN LOOP
// ══════════════════════════════════════════════
drawBattleSprites();

// Farm growth updates every second
setInterval(updateFarmGrowth, 1000);

function gameLoop() {
  if (gameState === 'overworld' || gameState === 'berry-menu') {
    updateWildPokemon();
    processMovement();
    drawOverworld();
  }
  requestAnimationFrame(gameLoop);
}

gameLoop();

// ══════════════════════════════════════════════
//  SAVE SYSTEM
// ══════════════════════════════════════════════
function saveGame() {
  const saveData = {
    berryBag: berryBag,
    farmPlots: farmPlots,
    player: { tx: player.tx, ty: player.ty }
  };
  localStorage.setItem('harvest_pokemoon_save', JSON.stringify(saveData));
}

function loadGame() {
  const raw = localStorage.getItem('harvest_pokemoon_save');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (data.berryBag) Object.assign(berryBag, data.berryBag);
    if (data.farmPlots) Object.assign(farmPlots, data.farmPlots);
    if (data.player) {
      player.tx = data.player.tx;
      player.ty = data.player.ty;
      player.px = player.tx * 16;
      player.py = player.ty * 16;
      player.targetTX = player.tx;
      player.targetTY = player.ty;
      player.targetPX = player.px;
      player.targetPY = player.py;
    }
    updateFarmHUD();
  } catch (e) {
    console.error("Failed to load save", e);
  }
}

loadGame();