const PokeBattleEngine = (() => {
  const RULESET = {
    generation: 'generation-vii',
    versionGroup: 'ultra-sun-ultra-moon',
    label: 'Gen VII (Ultra Sun / Ultra Moon)'
  };

  const API_ROOT = 'https://pokeapi.co/api/v2/';
  const CACHE_KEY = 'harvest_pokemoon_pokeapi_cache_v2';
  const BATTLE_DATA_KEY = 'harvest_pokemoon_battle_data_v2';
  const STATUS_IDS = new Set(['burn', 'paralysis', 'freeze', 'poison', 'badly-poisoned', 'sleep']);
  const SELF_TARGETS = new Set(['user', 'user-or-ally', 'users-field']);
  const SLEEP_USABLE_MOVES = new Set(['sleep-talk', 'snore']);
  const THAWING_MOVES = new Set(['flame-wheel', 'sacred-fire', 'flare-blitz', 'fusion-flare', 'scald', 'steam-eruption']);

  const FALLBACK_RULES = {
    statusDurations: {
      sleep: { min: 2, max: 4 },
      confusion: { min: 2, max: 5 }
    },
    ailmentOverrides: {
      'poison-powder': 'poison',
      'poison-gas': 'poison',
      'toxic': 'badly-poisoned',
      'will-o-wisp': 'burn',
      'stun-spore': 'paralysis',
      'thunder-wave': 'paralysis',
      'glare': 'paralysis',
      'sleep-powder': 'sleep',
      'spore': 'sleep',
      'sing': 'sleep',
      'hypnosis': 'sleep',
      'lovely-kiss': 'sleep',
      'dark-void': 'sleep',
      'grass-whistle': 'sleep',
      'supersonic': 'confusion',
      'confuse-ray': 'confusion',
      'sweet-kiss': 'confusion',
      'swagger': 'confusion',
      'teeter-dance': 'confusion'
    },
    selfStatMoves: new Set([
      'close-combat',
      'superpower',
      'draco-meteor',
      'leaf-storm',
      'overheat',
      'psycho-boost',
      'v-create',
      'hammer-arm'
    ])
  };

  const memoryCache = {};
  const battleDataCache = loadStore(BATTLE_DATA_KEY);
  const apiCache = loadStore(CACHE_KEY);

  function loadStore(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || '{}');
    } catch (err) {
      console.warn('Failed to read local cache', err);
      return {};
    }
  }

  function saveStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn('Failed to persist local cache', err);
    }
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function randomInt(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function capitalizeName(name) {
    return (name || '')
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function displayMoveName(name) {
    return (name || '').replace(/-/g, ' ').toUpperCase();
  }

  function loadApiResource(pathOrUrl) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${API_ROOT}${pathOrUrl}`;
    if (memoryCache[url]) return Promise.resolve(clone(memoryCache[url]));
    if (apiCache[url]) {
      memoryCache[url] = apiCache[url];
      return Promise.resolve(clone(apiCache[url]));
    }

    return fetch(url)
      .then(res => {
        if (!res.ok) {
          throw new Error(`PokeAPI request failed: ${url} (${res.status})`);
        }
        return res.json();
      })
      .then(data => {
        memoryCache[url] = data;
        apiCache[url] = data;
        saveStore(CACHE_KEY, apiCache);
        return clone(data);
      });
  }

  function findEnglishEffect(entries) {
    return (entries || []).find(entry => entry.language && entry.language.name === 'en') || null;
  }

  function resolvePastMoveValue(moveData, fieldName) {
    const override = (moveData.past_values || []).find(value =>
      value.version_group &&
      value.version_group.name === RULESET.versionGroup &&
      value[fieldName] !== null &&
      value[fieldName] !== undefined
    );
    return override ? override[fieldName] : moveData[fieldName];
  }

  function normalizeAilment(moveData) {
    const ailment = moveData.meta && moveData.meta.ailment ? moveData.meta.ailment.name : null;
    if (ailment && ailment !== 'none') return ailment;
    return FALLBACK_RULES.ailmentOverrides[moveData.name] || null;
  }

  function normalizeMove(moveData) {
    const effectEntry = findEnglishEffect(moveData.effect_entries);
    const ailment = normalizeAilment(moveData);
    const ailmentChance = moveData.meta && moveData.meta.ailment_chance ? moveData.meta.ailment_chance : 0;
    const statChance = moveData.meta && moveData.meta.stat_chance ? moveData.meta.stat_chance : 0;
    const flinchChance = moveData.meta && moveData.meta.flinch_chance ? moveData.meta.flinch_chance : 0;
    const moveTarget = moveData.target ? moveData.target.name : 'selected-pokemon';
    const category = moveData.damage_class ? moveData.damage_class.name : 'status';

    return {
      id: moveData.name,
      name: displayMoveName(moveData.name),
      displayName: capitalizeName(moveData.name),
      power: resolvePastMoveValue(moveData, 'power'),
      maxPP: resolvePastMoveValue(moveData, 'pp') || 1,
      accuracy: resolvePastMoveValue(moveData, 'accuracy'),
      priority: moveData.priority || 0,
      type: moveData.type ? moveData.type.name : 'normal',
      damageClass: category,
      target: moveTarget,
      ailment,
      ailmentChance,
      statChance,
      flinchChance,
      statChanges: (moveData.stat_changes || []).map(change => ({
        stat: change.stat.name,
        change: change.change
      })),
      drain: moveData.meta ? moveData.meta.drain || 0 : 0,
      healing: moveData.meta ? moveData.meta.healing || 0 : 0,
      minTurns: moveData.meta ? moveData.meta.min_turns || null : null,
      maxTurns: moveData.meta ? moveData.meta.max_turns || null : null,
      effectChance: resolvePastMoveValue(moveData, 'effect_chance') || 0,
      effectText: effectEntry ? effectEntry.short_effect : '',
      flags: (moveData.flags || []).map(flag => flag.name)
    };
  }

  async function getMove(moveNameOrUrl) {
    const moveData = await loadApiResource(moveNameOrUrl.startsWith('http') ? moveNameOrUrl : `move/${moveNameOrUrl}`);
    return normalizeMove(moveData);
  }

  async function getTypeData(typeNameOrUrl) {
    return loadApiResource(typeNameOrUrl.startsWith('http') ? typeNameOrUrl : `type/${typeNameOrUrl}`);
  }

  function getTypeRelations(typeData) {
    const pastMatch = (typeData.past_damage_relations || []).find(entry =>
      entry.generation && entry.generation.name === RULESET.generation
    );
    return pastMatch ? pastMatch.damage_relations : typeData.damage_relations;
  }

  async function getDamageMultiplier(moveType, targetTypes) {
    const typeData = await getTypeData(moveType);
    const relations = getTypeRelations(typeData);
    const doubleSet = new Set(relations.double_damage_to.map(entry => entry.name));
    const halfSet = new Set(relations.half_damage_to.map(entry => entry.name));
    const noneSet = new Set(relations.no_damage_to.map(entry => entry.name));

    return targetTypes.reduce((multiplier, targetType) => {
      if (noneSet.has(targetType)) return 0;
      if (doubleSet.has(targetType)) return multiplier * 2;
      if (halfSet.has(targetType)) return multiplier * 0.5;
      return multiplier;
    }, 1);
  }

  function calculateStat(base, level, iv = 15, ev = 0, isHP = false) {
    if (isHP) {
      return Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100) + level + 10;
    }
    return Math.floor(((base * 2 + iv + Math.floor(ev / 4)) * level) / 100) + 5;
  }

  function buildCalculatedStats(baseStats, level, ivs = {}, evs = {}) {
    return {
      hp: calculateStat(baseStats.hp, level, ivs.hp || 15, evs.hp || 0, true),
      attack: calculateStat(baseStats.attack, level, ivs.attack || 15, evs.attack || 0),
      defense: calculateStat(baseStats.defense, level, ivs.defense || 15, evs.defense || 0),
      'special-attack': calculateStat(baseStats['special-attack'], level, ivs['special-attack'] || 15, evs['special-attack'] || 0),
      'special-defense': calculateStat(baseStats['special-defense'], level, ivs['special-defense'] || 15, evs['special-defense'] || 0),
      speed: calculateStat(baseStats.speed, level, ivs.speed || 15, evs.speed || 0)
    };
  }

  async function getPokemonBattleData(species, level = 5) {
    const cacheKey = `${species.toLowerCase()}:${level}:${RULESET.versionGroup}`;
    if (battleDataCache[cacheKey]) return clone(battleDataCache[cacheKey]);

    const pokemonData = await loadApiResource(`pokemon/${species.toLowerCase()}`);
    const baseStats = {};
    pokemonData.stats.forEach(entry => {
      baseStats[entry.stat.name] = entry.base_stat;
    });

    const versionMoves = pokemonData.moves
      .map(moveEntry => {
        const relevantDetails = moveEntry.version_group_details
          .filter(detail =>
            detail.version_group &&
            detail.version_group.name === RULESET.versionGroup &&
            detail.move_learn_method &&
            detail.move_learn_method.name === 'level-up'
          )
          .sort((a, b) => a.level_learned_at - b.level_learned_at);

        if (relevantDetails.length === 0) return null;
        const detail = relevantDetails[relevantDetails.length - 1];
        return {
          move: moveEntry.move,
          levelLearnedAt: detail.level_learned_at
        };
      })
      .filter(Boolean)
      .filter(entry => entry.levelLearnedAt <= level);

    const latestMoveByName = {};
    versionMoves.forEach(entry => {
      const prev = latestMoveByName[entry.move.name];
      if (!prev || prev.levelLearnedAt <= entry.levelLearnedAt) {
        latestMoveByName[entry.move.name] = entry;
      }
    });

    const selectedMoves = Object.values(latestMoveByName)
      .sort((a, b) => {
        if (a.levelLearnedAt === b.levelLearnedAt) return a.move.name.localeCompare(b.move.name);
        return a.levelLearnedAt - b.levelLearnedAt;
      })
      .slice(-4);

    const normalizedMoves = selectedMoves.length > 0
      ? await Promise.all(selectedMoves.map(entry => getMove(entry.move.url)))
      : [await getMove('tackle')];

    const calculatedStats = buildCalculatedStats(baseStats, level);
    const abilities = (pokemonData.abilities || [])
      .sort((a, b) => a.slot - b.slot)
      .map(entry => ({
        name: entry.ability.name,
        displayName: capitalizeName(entry.ability.name),
        isHidden: entry.is_hidden,
        slot: entry.slot
      }));

    const normalized = {
      id: pokemonData.name,
      name: pokemonData.name.toUpperCase(),
      displayName: capitalizeName(pokemonData.name),
      level,
      types: pokemonData.types
        .sort((a, b) => a.slot - b.slot)
        .map(entry => entry.type.name),
      abilities,
      activeAbility: abilities.find(entry => !entry.isHidden) || abilities[0] || null,
      baseStats,
      calculatedStats,
      sprites: {
        front: pokemonData.sprites.versions['generation-v']['black-white'].animated.front_default || pokemonData.sprites.front_default,
        back: pokemonData.sprites.versions['generation-v']['black-white'].animated.back_default || pokemonData.sprites.back_default
      },
      moves: normalizedMoves
    };

    battleDataCache[cacheKey] = normalized;
    saveStore(BATTLE_DATA_KEY, battleDataCache);
    return clone(normalized);
  }

  function stageMultiplier(stage) {
    if (stage >= 0) return (2 + stage) / 2;
    return 2 / (2 + Math.abs(stage));
  }

  function createBattler(side, pokemonData, options = {}) {
    const ivs = options.ivs || {};
    const evs = options.evs || {};
    const stats = buildCalculatedStats(pokemonData.baseStats, pokemonData.level, ivs, evs);

    return {
      side,
      species: pokemonData.id,
      name: pokemonData.name,
      displayName: pokemonData.displayName,
      level: pokemonData.level,
      types: clone(pokemonData.types),
      abilities: clone(pokemonData.abilities),
      activeAbility: clone(pokemonData.activeAbility),
      baseStats: clone(pokemonData.baseStats),
      stats,
      maxHP: stats.hp,
      currentHP: stats.hp,
      sprites: clone(pokemonData.sprites),
      status: null,
      volatile: {
        confusion: null
      },
      statStages: {
        attack: 0,
        defense: 0,
        'special-attack': 0,
        'special-defense': 0,
        speed: 0,
        accuracy: 0,
        evasion: 0
      },
      moves: pokemonData.moves.map(move => ({
        ...clone(move),
        currentPP: move.maxPP
      }))
    };
  }

  function createBattleState(playerData, enemyData) {
    return {
      ruleset: clone(RULESET),
      winner: null,
      turnNumber: 1,
      battlers: {
        player: createBattler('player', playerData, { ivs: { hp: 31, attack: 31, defense: 31, 'special-attack': 31, 'special-defense': 31, speed: 31 } }),
        enemy: createBattler('enemy', enemyData)
      }
    };
  }

  function getBattlerPair(state, side) {
    return side === 'player'
      ? { actor: state.battlers.player, target: state.battlers.enemy }
      : { actor: state.battlers.enemy, target: state.battlers.player };
  }

  function getStatusLabel(statusId) {
    const labels = {
      burn: 'BRN',
      paralysis: 'PAR',
      freeze: 'FRZ',
      poison: 'PSN',
      'badly-poisoned': 'TOX',
      sleep: 'SLP',
      confusion: 'CONF'
    };
    return labels[statusId] || '';
  }

  function getVisibleStatuses(battler) {
    return {
      major: battler.status ? getStatusLabel(battler.status.id) : '',
      volatile: battler.volatile.confusion ? getStatusLabel('confusion') : ''
    };
  }

  function getEffectiveStat(battler, statName) {
    const baseValue = battler.stats[statName];
    const stage = battler.statStages[statName] || 0;
    let value = Math.floor(baseValue * stageMultiplier(stage));

    if (statName === 'speed' && battler.status && battler.status.id === 'paralysis') {
      value = Math.floor(value * 0.5);
    }

    if (statName === 'attack' && battler.status && battler.status.id === 'burn') {
      value = Math.floor(value * 0.5);
    }

    return Math.max(1, value);
  }

  function pushMessage(events, text) {
    events.push({ type: 'message', text });
  }

  function captureBattleFrame(state) {
    return clone({
      player: state.battlers.player,
      enemy: state.battlers.enemy
    });
  }

  function pushSync(events, state, side, reason) {
    events.push({ type: 'sync', side, reason, frame: captureBattleFrame(state) });
  }

  function pushAnimation(events, side, animation) {
    events.push({ type: 'animation', side, animation });
  }

  function applyHP(state, events, battler, nextHP, reason) {
    battler.currentHP = Math.max(0, Math.min(battler.maxHP, nextHP));
    pushSync(events, state, battler.side, reason);
  }

  function isFainted(battler) {
    return battler.currentHP <= 0;
  }

  function buildAction(battler, moveIndex) {
    const usableMoves = battler.moves.filter(move => move.currentPP > 0);
    if (usableMoves.length === 0) {
      return {
        move: {
          id: 'struggle',
          name: 'STRUGGLE',
          displayName: 'Struggle',
          power: 50,
          maxPP: 1,
          currentPP: 1,
          accuracy: null,
          priority: 0,
          type: 'normal',
          damageClass: 'physical',
          target: 'selected-pokemon',
          ailment: null,
          ailmentChance: 0,
          statChance: 0,
          flinchChance: 0,
          statChanges: [],
          drain: 0,
          healing: 0,
          minTurns: null,
          maxTurns: null,
          effectChance: 0,
          effectText: '',
          flags: []
        },
        index: -1,
        isStruggle: true
      };
    }

    const move = battler.moves[moveIndex];
    if (!move || move.currentPP <= 0) return null;
    return { move, index: moveIndex, isStruggle: false };
  }

  function chooseEnemyMoveIndex(enemy) {
    const candidates = enemy.moves
      .map((move, index) => ({ move, index }))
      .filter(entry => entry.move.currentPP > 0);

    if (candidates.length === 0) return -1;
    return candidates[randomInt(0, candidates.length - 1)].index;
  }

  function compareActions(a, b, state) {
    if (a.move.priority !== b.move.priority) return b.move.priority - a.move.priority;

    const aSpeed = getEffectiveStat(state.battlers[a.side], 'speed');
    const bSpeed = getEffectiveStat(state.battlers[b.side], 'speed');
    if (aSpeed !== bSpeed) return bSpeed - aSpeed;

    return Math.random() < 0.5 ? -1 : 1;
  }

  function getSelfHitDamage(battler) {
    const attack = getEffectiveStat(battler, 'attack');
    const defense = getEffectiveStat(battler, 'defense');
    const rawDamage = ((((2 * battler.level / 5) + 2) * 40 * (attack / defense)) / 50) + 2;
    return Math.max(1, Math.floor(rawDamage));
  }

  function applyConfusionStatus(target, move) {
    return {
      id: 'confusion',
      turnsRemaining: randomInt(
        move.minTurns || FALLBACK_RULES.statusDurations.confusion.min,
        move.maxTurns || FALLBACK_RULES.statusDurations.confusion.max
      )
    };
  }

  function applyMajorStatus(target, statusId, move) {
    if (statusId === 'sleep') {
      return {
        id: statusId,
        turnsRemaining: randomInt(
          move.minTurns || FALLBACK_RULES.statusDurations.sleep.min,
          move.maxTurns || FALLBACK_RULES.statusDurations.sleep.max
        )
      };
    }

    if (statusId === 'badly-poisoned') {
      return {
        id: statusId,
        toxicCounter: 1
      };
    }

    return { id: statusId };
  }

  async function isMoveTypeImmune(move, target) {
    if (!move.type) return false;
    return (await getDamageMultiplier(move.type, target.types)) === 0;
  }

  async function canApplyStatus(state, source, target, move, statusId) {
    if (!statusId) return false;

    if (statusId === 'confusion') {
      return !target.volatile.confusion && !isFainted(target);
    }

    if (target.status || isFainted(target)) return false;

    if (move.flags.includes('powder') && target.types.includes('grass')) return false;
    if (move.damageClass === 'status' && await isMoveTypeImmune(move, target)) return false;

    if (statusId === 'burn' && target.types.includes('fire')) return false;
    if (statusId === 'paralysis' && target.types.includes('electric')) return false;
    if (statusId === 'freeze' && target.types.includes('ice')) return false;
    if ((statusId === 'poison' || statusId === 'badly-poisoned') && (target.types.includes('poison') || target.types.includes('steel'))) {
      return false;
    }

    return true;
  }

  function resolveAilmentChance(move) {
    if (!move.ailment) return 0;
    if (move.ailmentChance) return move.ailmentChance;
    if (move.damageClass === 'status') return 100;
    if (move.effectChance) return move.effectChance;
    return 0;
  }

  function applyStageChange(state, events, battler, statName, delta) {
    const current = battler.statStages[statName] || 0;
    const next = Math.max(-6, Math.min(6, current + delta));
    const actualDelta = next - current;
    battler.statStages[statName] = next;
    if (actualDelta === 0) {
      pushMessage(events, `${battler.name}'s ${capitalizeName(statName)} won't go any ${delta > 0 ? 'higher' : 'lower'}!`);
      return;
    }

    const label = capitalizeName(statName);
    if (actualDelta > 1) pushMessage(events, `${battler.name}'s ${label} rose sharply!`);
    else if (actualDelta === 1) pushMessage(events, `${battler.name}'s ${label} rose!`);
    else if (actualDelta < -1) pushMessage(events, `${battler.name}'s ${label} harshly fell!`);
    else pushMessage(events, `${battler.name}'s ${label} fell!`);
    pushSync(events, state, battler.side, 'stat-stage');
  }

  function resolveStatChangeTarget(move, actor, target) {
    if (SELF_TARGETS.has(move.target)) return actor;
    if (FALLBACK_RULES.selfStatMoves.has(move.id)) return actor;
    if (move.damageClass !== 'status' && move.statChance === 0 && move.statChanges.length > 0) return actor;
    return target;
  }

  function resolveStatEffectChance(move) {
    if (move.statChanges.length === 0) return 0;
    if (move.statChance) return move.statChance;
    if (move.damageClass === 'status') return 100;
    if (SELF_TARGETS.has(move.target) || FALLBACK_RULES.selfStatMoves.has(move.id)) return 100;
    return 0;
  }

  async function runBeforeMoveChecks(state, actor, target, move, events) {
    if (actor.status && actor.status.id === 'sleep') {
      actor.status.turnsRemaining -= 1;
      if (actor.status.turnsRemaining <= 0) {
        actor.status = null;
        pushSync(events, state, actor.side, 'wake-up');
        pushMessage(events, `${actor.name} woke up!`);
      } else if (!SLEEP_USABLE_MOVES.has(move.id)) {
        pushMessage(events, `${actor.name} is fast asleep!`);
        pushSync(events, state, actor.side, 'sleep-turn');
        return false;
      }
    }

    if (actor.status && actor.status.id === 'freeze') {
      const thawed = THAWING_MOVES.has(move.id) || Math.random() < 0.2;
      if (thawed) {
        actor.status = null;
        pushSync(events, state, actor.side, 'thaw');
        pushMessage(events, `${actor.name} thawed out!`);
      } else {
        pushMessage(events, `${actor.name} is frozen solid!`);
        return false;
      }
    }

    if (actor.status && actor.status.id === 'paralysis' && Math.random() < 0.25) {
      pushMessage(events, `${actor.name} is paralyzed! It can't move!`);
      return false;
    }

    if (actor.volatile.confusion) {
      actor.volatile.confusion.turnsRemaining -= 1;
      if (actor.volatile.confusion.turnsRemaining <= 0) {
        actor.volatile.confusion = null;
        pushSync(events, state, actor.side, 'confusion-ended');
        pushMessage(events, `${actor.name} snapped out of confusion!`);
      } else {
        pushMessage(events, `${actor.name} is confused!`);
        if (Math.random() < (1 / 3)) {
          const selfDamage = getSelfHitDamage(actor);
          applyHP(state, events, actor, actor.currentHP - selfDamage, 'confusion-self-hit');
          pushAnimation(events, actor.side, 'self-hit');
          pushMessage(events, `It hurt itself in its confusion!`);
          if (isFainted(actor)) {
            pushMessage(events, `${actor.name} fainted!`);
            state.winner = target.side;
          }
          return false;
        }
      }
    }

    return true;
  }

  async function calculateDamage(move, actor, target) {
    if (!move.power || move.damageClass === 'status') {
      return { amount: 0, multiplier: 1 };
    }

    const attackStat = move.damageClass === 'special'
      ? getEffectiveStat(actor, 'special-attack')
      : getEffectiveStat(actor, 'attack');
    const defenseStat = move.damageClass === 'special'
      ? getEffectiveStat(target, 'special-defense')
      : getEffectiveStat(target, 'defense');

    let damage = ((((2 * actor.level / 5) + 2) * move.power * (attackStat / defenseStat)) / 50) + 2;
    const stab = actor.types.includes(move.type) ? 1.5 : 1;
    const multiplier = await getDamageMultiplier(move.type, target.types);
    const randomFactor = 0.85 + (Math.random() * 0.15);
    damage *= stab * multiplier * randomFactor;

    return {
      amount: multiplier === 0 ? 0 : Math.max(1, Math.floor(damage)),
      multiplier
    };
  }

  async function applyMoveEffects(state, actor, target, move, events, damageResult) {
    if (move.healing > 0) {
      const recovered = Math.max(1, Math.floor(actor.maxHP * (move.healing / 100)));
      if (actor.currentHP < actor.maxHP) {
        applyHP(state, events, actor, actor.currentHP + recovered, 'heal');
        pushMessage(events, `${actor.name} regained health!`);
      }
    }

    if (move.drain > 0 && damageResult.amount > 0) {
      const recovered = Math.max(1, Math.floor(damageResult.amount * (move.drain / 100)));
      applyHP(state, events, actor, actor.currentHP + recovered, 'drain-heal');
      pushMessage(events, `${actor.name} restored a little HP!`);
    }

    if (move.ailment) {
      const recipient = SELF_TARGETS.has(move.target) ? actor : target;
      const ailmentChance = resolveAilmentChance(move);
      if (Math.random() * 100 < ailmentChance && await canApplyStatus(state, actor, recipient, move, move.ailment)) {
        if (move.ailment === 'confusion') {
          recipient.volatile.confusion = applyConfusionStatus(recipient, move);
          pushSync(events, state, recipient.side, 'confusion-applied');
          pushMessage(events, `${recipient.name} became confused!`);
        } else if (STATUS_IDS.has(move.ailment)) {
          recipient.status = applyMajorStatus(recipient, move.ailment, move);
          pushSync(events, state, recipient.side, 'major-status-applied');
          const verb = move.ailment === 'sleep' ? 'fell asleep' : `was ${move.ailment === 'badly-poisoned' ? 'badly poisoned' : move.ailment}`;
          pushMessage(events, `${recipient.name} ${verb}!`);
        }
      }
    }

    if (move.statChanges.length > 0) {
      const chance = resolveStatEffectChance(move);
      if (chance > 0 && Math.random() * 100 < chance) {
        const recipient = resolveStatChangeTarget(move, actor, target);
        move.statChanges.forEach(change => {
          applyStageChange(state, events, recipient, change.stat, change.change);
        });
      }
    }
  }

  function handleFreezeOnHit(state, events, target, move) {
    if (!target.status || target.status.id !== 'freeze') return;
    const thawsTarget = move.type === 'fire' || THAWING_MOVES.has(move.id);
    if (!thawsTarget) return;
    target.status = null;
    pushSync(events, state, target.side, 'thawed-by-hit');
    pushMessage(events, `${target.name} thawed out!`);
  }

  async function resolveMove(state, actor, target, action, events) {
    const move = action.move;
    const canAct = await runBeforeMoveChecks(state, actor, target, move, events);
    if (!canAct || state.winner) return;

    if (!action.isStruggle) {
      actor.moves[action.index].currentPP -= 1;
      pushSync(events, state, actor.side, 'pp-spent');
    }

    pushMessage(events, `${actor.name} used ${move.name}!`);

    if (move.damageClass === 'status' && await isMoveTypeImmune(move, target) && !SELF_TARGETS.has(move.target)) {
      pushMessage(events, `It doesn't affect ${target.name}...`);
      return;
    }

    if (move.accuracy !== null && move.accuracy !== undefined && Math.random() * 100 > move.accuracy) {
      pushMessage(events, 'The move missed!');
      return;
    }

    const damageResult = await calculateDamage(move, actor, target);
    if (move.damageClass !== 'status') {
      if (damageResult.multiplier === 0) {
        pushMessage(events, `It doesn't affect ${target.name}...`);
        return;
      }

      applyHP(state, events, target, target.currentHP - damageResult.amount, 'move-damage');
      pushAnimation(events, target.side, 'hit');
      handleFreezeOnHit(state, events, target, move);

      if (damageResult.multiplier > 1) pushMessage(events, `It's super effective!`);
      else if (damageResult.multiplier > 0 && damageResult.multiplier < 1) pushMessage(events, `It's not very effective...`);

      await applyMoveEffects(state, actor, target, move, events, damageResult);

      if (action.isStruggle && !isFainted(actor)) {
        const recoil = Math.max(1, Math.floor(actor.maxHP / 4));
        applyHP(state, events, actor, actor.currentHP - recoil, 'struggle-recoil');
        pushAnimation(events, actor.side, 'self-hit');
        pushMessage(events, `${actor.name} was damaged by recoil!`);
      }

      if (isFainted(target)) {
        pushMessage(events, `${target.name} fainted!`);
        state.winner = actor.side;
      } else if (isFainted(actor)) {
        pushMessage(events, `${actor.name} fainted!`);
        state.winner = target.side;
      }
      return;
    }

    await applyMoveEffects(state, actor, target, move, events, damageResult);
  }

  function getEndTurnDamage(battler) {
    if (!battler.status) return 0;
    if (battler.status.id === 'burn') return Math.max(1, Math.floor(battler.maxHP / 16));
    if (battler.status.id === 'poison') return Math.max(1, Math.floor(battler.maxHP / 8));
    if (battler.status.id === 'badly-poisoned') {
      const damage = Math.max(1, Math.floor((battler.maxHP * battler.status.toxicCounter) / 16));
      battler.status.toxicCounter += 1;
      return damage;
    }
    return 0;
  }

  async function applyEndOfTurnEffects(state, events) {
    const order = ['player', 'enemy'];
    for (const side of order) {
      if (state.winner) return;
      const battler = state.battlers[side];
      const opponent = side === 'player' ? state.battlers.enemy : state.battlers.player;
      if (isFainted(battler)) continue;

      const damage = getEndTurnDamage(battler);
      if (!damage) continue;

      applyHP(state, events, battler, battler.currentHP - damage, 'end-turn-status');
      const label = battler.status.id === 'burn'
        ? 'is hurt by its burn!'
        : battler.status.id === 'badly-poisoned'
          ? 'is hurt by poison!'
          : 'is hurt by poison!';
      pushMessage(events, `${battler.name} ${label}`);

      if (isFainted(battler)) {
        pushMessage(events, `${battler.name} fainted!`);
        state.winner = opponent.side;
        return;
      }
    }
  }

  async function executeRound(state, playerMoveIndex) {
    const events = [];
    const enemyMoveIndex = chooseEnemyMoveIndex(state.battlers.enemy);
    const playerAction = buildAction(state.battlers.player, playerMoveIndex);
    const enemyAction = buildAction(state.battlers.enemy, enemyMoveIndex);

    if (!playerAction) {
      pushMessage(events, 'That move has no PP left!');
      return { events, winner: state.winner };
    }

    const actionQueue = [
      { side: 'player', ...playerAction },
      { side: 'enemy', ...enemyAction }
    ].sort((a, b) => compareActions(a, b, state));

    for (const action of actionQueue) {
      if (state.winner) break;
      const { actor, target } = getBattlerPair(state, action.side);
      if (isFainted(actor) || isFainted(target)) continue;
      await resolveMove(state, actor, target, action, events);
    }

    if (!state.winner) {
      await applyEndOfTurnEffects(state, events);
    }

    state.turnNumber += 1;
    return { events, winner: state.winner };
  }

  function getMoveSummary(move) {
    return `${move.type.toUpperCase()}  ${move.currentPP}/${move.maxPP} PP`;
  }

  return {
    RULESET,
    FALLBACK_RULES,
    calculateStat,
    createBattleState,
    executeRound,
    getMove,
    getMoveSummary,
    getPokemonBattleData,
    getVisibleStatuses
  };
})();

window.PokeBattleEngine = PokeBattleEngine;
