import { lookupReaction, substance } from './data';
import type { Level, Reaction, ReactionType } from './data';
import { checkBalance } from './formula.js';

export type Accuracy = 'none' | 'perfect' | 'correct' | 'wrong' | 'skip';
export type Phase = 'select' | 'balance' | 'resolving' | 'misfire' | 'win' | 'lose';
export type LogKind = 'info' | 'hit' | 'enemy' | 'effect' | 'warn' | 'win';

export interface LogEntry {
  id: number;
  kind: LogKind;
  text: string;
}

export interface TurnResult {
  reactionKey: string;
  reaction: Reaction;
  damage: number;
  weak: boolean;
  resist: boolean;
  accuracy: Accuracy;
  effects: string[];
  comboBonus: number;
  boosted: boolean;
}

export interface BattleState {
  level: Level;
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  shield: number;
  hand: string[];
  deck: string[];
  discard: string[];
  energy: number;
  boost: boolean;
  turn: number;
  maxTurns: number;
  enemyArmor: number;
  choke: number;
  burn: number;
  bind: number;
  combo: number;
  selected: number[];
  phase: Phase;
  pendingKey: string | null;
  pending: Reaction | null;
  coefficients: number[];
  lastResult: TurnResult | null;
  /** 选错组合时记录的「不反应」信息，界面据此弹提示 */
  misfire: { names: string[] } | null;
  /** 提示功能：本关剩余次数 */
  hintsLeft: number;
  /** 当前高亮的手牌下标 */
  hint: number[];
  log: LogEntry[];
  logSeq: number;
  stats: { dealt: number; taken: number; perfect: number; turns: number };
}

export const BASE_DAMAGE = 18;
export const PLAYER_MAX_HP = 150;
/** 手牌上限：多了会把牌堆挤爆，也会让界面溢出 */
export const HAND_LIMIT = 8;
/** 每关可以点几次提示 */
export const HINTS_PER_LEVEL = 3;

const TYPE_PROFILE: Record<ReactionType, { base: number; effect: string }> = {
  置换: { base: 1.2, effect: 'corrode' },
  中和: { base: 1.0, effect: 'cleanse' },
  沉淀: { base: 1.1, effect: 'shield' },
  产气: { base: 1.3, effect: 'choke' },
  分解: { base: 1.2, effect: 'draw' },
  化合: { base: 1.5, effect: 'none' },
  燃烧: { base: 2.0, effect: 'burn' },
  氧化还原: { base: 1.6, effect: 'burn' },
  复分解: { base: 1.1, effect: 'shield' },
};

const COND_COEF: Record<string, number> = {
  常温: 1.0,
  点燃: 1.3,
  加热: 1.25,
  高温: 1.4,
  催化: 1.15,
  通电: 1.3,
};

const ACC_COEF: Record<Accuracy, number> = {
  none: 1.0,
  skip: 1.0,
  correct: 1.15,
  perfect: 1.3,
  wrong: 0.4,
};

export const EFFECT_TEXT: Record<string, string> = {
  corrode: '腐蚀：敌方护甲 -1',
  cleanse: '净化：清除自身异常',
  shield: '成壳：获得 12 点护盾',
  choke: '窒息：敌方下回合伤害 -30%',
  draw: '催化：额外抽 1 张牌',
  burn: '灼烧：敌方持续掉血 3 回合',
  none: '',
};

const shuffle = <T,>(arr: T[]): T[] => {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export function canReact(ids: string[]): boolean {
  return ids.length > 0 && lookupReaction(ids) !== null;
}

export function handHasMove(hand: string[]): boolean {
  if (hand.some((id) => canReact([id]))) return true;
  for (let i = 0; i < hand.length; i += 1) {
    for (let j = i + 1; j < hand.length; j += 1) {
      if (canReact([hand[i], hand[j]])) return true;
    }
  }
  // 三反应物的方程式（工业流程、铁的吸氧腐蚀等）也要算进来
  for (let i = 0; i < hand.length; i += 1) {
    for (let j = i + 1; j < hand.length; j += 1) {
      for (let k = j + 1; k < hand.length; k += 1) {
        if (canReact([hand[i], hand[j], hand[k]])) return true;
      }
    }
  }
  return false;
}

function pushLog(s: BattleState, kind: LogKind, text: string): BattleState {
  const id = s.logSeq + 1;
  return {
    ...s,
    logSeq: id,
    log: [...s.log, { id, kind, text }].slice(-40),
  };
}

function drawCards(s: BattleState, n: number): BattleState {
  const hand = s.hand.slice();
  let deck = s.deck.slice();
  let discard = s.discard.slice();
  for (let i = 0; i < n; i += 1) {
    if (hand.length >= HAND_LIMIT) break;
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
    }
    const card = deck.pop();
    if (card) hand.push(card);
  }
  return { ...s, hand, deck, discard };
}

/**
 * 在给定的一组牌里找一组能反应的组合，返回下标。
 * preferWeakness 里列出的反应类型优先（提示更「有用」），同优先级下取张数最少的。
 */
function findCombo(hand: string[], preferWeakness: ReactionType[] = []): number[] | null {
  const found: { idx: number[]; weak: boolean }[] = [];
  const isWeak = (type: ReactionType) => preferWeakness.includes(type);

  for (let i = 0; i < hand.length; i += 1) {
    const one = lookupReaction([hand[i]]);
    if (one) found.push({ idx: [i], weak: isWeak(one.reaction.type) });
    for (let j = i + 1; j < hand.length; j += 1) {
      const two = lookupReaction([hand[i], hand[j]]);
      if (two) found.push({ idx: [i, j], weak: isWeak(two.reaction.type) });
      for (let k = j + 1; k < hand.length; k += 1) {
        const three = lookupReaction([hand[i], hand[j], hand[k]]);
        if (three) found.push({ idx: [i, j, k], weak: isWeak(three.reaction.type) });
      }
    }
  }

  if (found.length === 0) return null;
  found.sort((a, b) => {
    if (a.weak !== b.weak) return a.weak ? -1 : 1;
    return a.idx.length - b.idx.length;
  });
  return found[0].idx;
}

/**
 * 死手保底：手牌一张都打不出去时，把整副牌（手牌 + 牌堆 + 弃牌）重排，
 * 并且**保证**新手牌里一定含有一组能反应的组合，而不是听天由命重抽。
 */
function ensurePlayable(s: BattleState): BattleState {
  if (handHasMove(s.hand)) return s;

  const pool = shuffle([...s.deck, ...s.hand, ...s.discard]);
  const combo = findCombo(pool);
  const target = Math.min(s.level.handSize, HAND_LIMIT);

  if (!combo) {
    // 整副牌都凑不出反应——理论上不该发生（数据校验会拦），兜底原样返回
    return pushLog(s, 'warn', '整副试剂都凑不出可发生的反应，这局没法打了。');
  }

  const picked = combo.map((i) => pool[i]);
  const rest = pool.filter((_, i) => !combo.includes(i));
  const hand = [...picked];
  while (hand.length < target && rest.length > 0) {
    const card = rest.shift();
    if (card) hand.push(card);
  }

  return pushLog(
    { ...s, hand, deck: rest, discard: [], hint: [] },
    'info',
    '手牌凑不出反应，已重新整理牌堆——保证这一手有可打的组合。',
  );
}

export function createBattle(level: Level): BattleState {
  const deck = shuffle(level.shelf);
  const hand: string[] = [];
  for (let i = 0; i < level.handSize && deck.length > 0 && hand.length < HAND_LIMIT; i += 1) {
    const card = deck.pop();
    if (card) hand.push(card);
  }
  const base: BattleState = {
    level,
    playerHp: PLAYER_MAX_HP,
    playerMaxHp: PLAYER_MAX_HP,
    enemyHp: level.enemy.hp,
    enemyMaxHp: level.enemy.hp,
    shield: 0,
    hand,
    deck,
    discard: [],
    energy: level.energy,
    boost: false,
    turn: 1,
    maxTurns: 16 + Math.round(level.enemy.hp / 120),
    enemyArmor: level.enemy.armor,
    choke: 0,
    burn: 0,
    bind: 0,
    combo: 0,
    selected: [],
    phase: 'select',
    pendingKey: null,
    pending: null,
    coefficients: [],
    lastResult: null,
    misfire: null,
    hintsLeft: HINTS_PER_LEVEL,
    hint: [],
    log: [],
    logSeq: 0,
    stats: { dealt: 0, taken: 0, perfect: 0, turns: 0 },
  };
  return ensurePlayable(
    pushLog(base, 'info', `遭遇「${level.enemy.name}」：${level.enemy.intro}`),
  );
}

export function toggleCard(s: BattleState, index: number): BattleState {
  if (s.phase !== 'select') return s;
  if (index < 0 || index >= s.hand.length) return s;
  // 不限制选几张：有些方程式就是三四个反应物（如 4Fe + 3O2 + 6H2O），
  // 限制成 2 张会把它们全部堵死。查表逻辑本身支持任意数量。
  const selected = s.selected.includes(index)
    ? s.selected.filter((i) => i !== index)
    : [...s.selected, index];
  return { ...s, selected, hint: [] };
}

/** 消耗一次提示机会，高亮一组能反应的手牌（优先命中弱点的组合） */
export function useHint(s: BattleState): BattleState {
  if (s.phase !== 'select' || s.hintsLeft <= 0) return s;
  const combo = findCombo(s.hand, s.level.enemy.weakness);
  if (!combo) {
    return pushLog(s, 'warn', '手牌里确实没有能反应的组合了，只能先弃一回合。');
  }
  return pushLog(
    { ...s, hintsLeft: s.hintsLeft - 1, hint: combo, selected: [] },
    'info',
    `提示：高亮的 ${combo.length} 种物质之间可以发生反应（本关还剩 ${s.hintsLeft - 1} 次）。`,
  );
}

export function toggleBoost(s: BattleState): BattleState {
  if (s.phase !== 'select') return s;
  return { ...s, boost: !s.boost };
}

export function submitSelection(s: BattleState): BattleState {
  if (s.phase !== 'select' || s.selected.length === 0) return s;
  const ids = s.selected.map((i) => s.hand[i]);
  const hit = lookupReaction(ids);
  if (!hit) {
    const names = ids.map((id) => substance(id).name);
    // 不立刻结算敌方回合：先让界面把「不反应」讲清楚，玩家关掉弹窗再推进
    const next = pushLog(
      s,
      'warn',
      `「${names.join(' + ')}」之间没有可发生的反应——这一回合被浪费了。`,
    );
    return { ...next, selected: [], boost: false, phase: 'misfire', misfire: { names } };
  }
  const coeffCount = hit.reaction.reactants.length + hit.reaction.products.length;
  if (s.level.requireBalance) {
    return {
      ...s,
      pendingKey: hit.id,
      pending: hit.reaction,
      coefficients: Array.from({ length: coeffCount }, () => 1),
      phase: 'balance',
    };
  }
  return settle(s, hit.id, hit.reaction, 'none', false);
}

export function previewDamage(
  s: BattleState,
  reaction: Reaction,
  accuracy: Accuracy,
  perfectBonus = false,
): number {
  const profile = TYPE_PROFILE[reaction.type];
  const cond = COND_COEF[reaction.condition] ?? 1;
  const acc = ACC_COEF[accuracy] * (perfectBonus && accuracy === 'perfect' ? 1.1 : 1);
  const weak = s.level.enemy.weakness.includes(reaction.type);
  const resist = s.level.enemy.resist.includes(reaction.type);
  const weakMult = weak ? 2 : resist ? 0.5 : 1;
  const comboBonus = Math.min(s.combo, 5) * 0.1;
  const boostMult = s.boost && s.energy > 0 ? 1.25 : 1;
  const armorMult = Math.max(0.4, 1 - s.enemyArmor * 0.12);
  const raw =
    BASE_DAMAGE * profile.base * cond * acc * weakMult * (1 + comboBonus) * boostMult * armorMult;
  return Math.max(1, Math.round(raw));
}

function settle(
  s: BattleState,
  key: string,
  reaction: Reaction,
  accuracy: Accuracy,
  perfect: boolean,
): BattleState {
  const boosted = s.boost && s.energy > 0;
  const damage = previewDamage(s, reaction, accuracy, perfect);
  const weak = s.level.enemy.weakness.includes(reaction.type);
  const resist = s.level.enemy.resist.includes(reaction.type);
  const profile = TYPE_PROFILE[reaction.type];
  const comboBonus = Math.min(s.combo, 5) * 0.1;

  const usedIds = s.selected.map((i) => s.hand[i]);
  const hand = s.hand.filter((_id, i) => !s.selected.includes(i));
  const discard = [...s.discard, ...usedIds];

  let next: BattleState = {
    ...s,
    hand,
    discard,
    energy: boosted ? s.energy - 1 : s.energy,
    boost: false,
    selected: [],
    hint: [],
    enemyHp: Math.max(0, s.enemyHp - damage),
    combo: weak ? s.combo + 1 : 0,
    stats: {
      ...s.stats,
      dealt: s.stats.dealt + damage,
      perfect: s.stats.perfect + (perfect ? 1 : 0),
    },
    lastResult: {
      reactionKey: key,
      reaction,
      damage,
      weak,
      resist,
      accuracy,
      effects: [profile.effect],
      comboBonus,
      boosted,
    },
    phase: 'resolving',
    pendingKey: null,
    pending: null,
    coefficients: [],
  };

  const accText =
    accuracy === 'perfect'
      ? '完美配平！'
      : accuracy === 'correct'
        ? '配平正确。'
        : accuracy === 'skip'
          ? '跳过了配平。'
          : '';
  next = pushLog(
    next,
    'hit',
    `${reaction.type}反应${accText} 造成 ${damage} 点伤害${weak ? '（命中弱点 ×2）' : resist ? '（被抗性削弱）' : ''}`,
  );
  if (reaction.phenomenon) next = pushLog(next, 'effect', reaction.phenomenon);

  // 附加效果
  switch (profile.effect) {
    case 'burn':
      next = { ...next, burn: 3 };
      next = pushLog(next, 'effect', '敌方进入灼烧状态。');
      break;
    case 'choke':
      next = { ...next, choke: 2 };
      next = pushLog(next, 'effect', '敌方窒息，下回合伤害降低。');
      break;
    case 'shield':
      next = { ...next, shield: next.shield + 12 };
      next = pushLog(next, 'effect', '你获得 12 点护盾。');
      break;
    case 'corrode':
      if (next.enemyArmor > 0) {
        next = { ...next, enemyArmor: next.enemyArmor - 1 };
        next = pushLog(next, 'effect', '敌方护甲被腐蚀 -1。');
      }
      break;
    case 'draw':
      next = drawCards(next, 1);
      break;
    default:
      break;
  }

  if (next.enemyHp <= 0) {
    next = { ...next, phase: 'win' };
    next = pushLog(next, 'win', `${next.level.enemy.name} 被彻底分解。`);
  }
  return next;
}

export function confirmBalance(s: BattleState, coefficients: number[], perfect: boolean): BattleState {
  if (s.phase !== 'balance' || !s.pending || !s.pendingKey) return s;
  const ordered = coefficients.map((n) => Math.max(1, Math.round(n)));
  const left = s.pending.reactants.map(([id], i) => ({ formula: id, n: ordered[i] }));
  const offset = s.pending.reactants.length;
  const right = s.pending.products.map(([id], i) => ({
    formula: id,
    n: ordered[offset + i],
  }));
  const correct = isCorrectBalance(left, right);
  return settle(
    s,
    s.pendingKey,
    s.pending,
    correct ? (perfect ? 'perfect' : 'correct') : 'wrong',
    correct && perfect,
  );
}

function isCorrectBalance(
  left: { formula: string; n: number }[],
  right: { formula: string; n: number }[],
): boolean {
  const res = checkBalance(left, right) as { balanced: boolean };
  if (!res.balanced) return false;
  const nums = [...left.map((t) => t.n), ...right.map((t) => t.n)];
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const all = nums.reduce((a, b) => gcd(a, b), 0);
  return all === 1;
}

export function skipBalance(s: BattleState): BattleState {
  if (s.phase !== 'balance' || !s.pending || !s.pendingKey) return s;
  return settle(s, s.pendingKey, s.pending, 'skip', false);
}

export function enemyTurn(s: BattleState): BattleState {
  let next = s;
  if (next.enemyHp <= 0) return next;

  if (next.bind > 0) {
    next = { ...next, bind: next.bind - 1 };
    return pushLog(next, 'enemy', '敌方被束缚，无法行动。');
  }

  const raw = next.level.enemy.atk * (next.choke > 0 ? 0.7 : 1);
  const dmg = Math.max(1, Math.round(raw));
  const absorbed = Math.min(next.shield, dmg);
  const through = dmg - absorbed;
  next = {
    ...next,
    shield: Math.max(0, next.shield - absorbed),
    playerHp: Math.max(0, next.playerHp - through),
    choke: Math.max(0, next.choke - 1),
    stats: { ...next.stats, taken: next.stats.taken + through },
  };
  next = pushLog(
    next,
    'enemy',
    `${next.level.enemy.name} 反击，造成 ${through} 点伤害${absorbed > 0 ? `（护盾抵挡 ${absorbed}）` : ''}。`,
  );
  if (next.playerHp <= 0) {
    next = { ...next, phase: 'lose' };
    next = pushLog(next, 'warn', '实验失败——你被反噬了。');
  }
  return next;
}

export function endTurn(s: BattleState): BattleState {
  let next = s;
  if (next.phase === 'win' || next.phase === 'lose') return next;

  if (next.burn > 0) {
    const burnDmg = 6;
    next = {
      ...next,
      enemyHp: Math.max(0, next.enemyHp - burnDmg),
      burn: next.burn - 1,
      stats: { ...next.stats, dealt: next.stats.dealt + burnDmg },
    };
    next = pushLog(next, 'effect', `灼烧持续伤害 ${burnDmg} 点。`);
    if (next.enemyHp <= 0) {
      next = { ...next, phase: 'win' };
      return pushLog(next, 'win', `${next.level.enemy.name} 被烧尽了。`);
    }
  }

  next = enemyTurn(next);
  if (next.phase === 'lose') return next;

  next = drawCards(next, 2);
  next = {
    ...next,
    turn: next.turn + 1,
    selected: [],
    hint: [],
    phase: 'select',
    stats: { ...next.stats, turns: next.stats.turns + 1 },
  };
  if (next.turn > next.maxTurns) {
    next = { ...next, phase: 'lose' };
    next = pushLog(next, 'warn', '回合耗尽——试剂用完了。');
  }
  return ensurePlayable(next);
}

export function advance(s: BattleState): BattleState {
  if (s.phase !== 'resolving') return s;
  return endTurn(s);
}

/** 玩家看完「这两种物质不反应」的提示后继续；这一回合照常被浪费 */
export function resolveMisfire(s: BattleState): BattleState {
  if (s.phase !== 'misfire') return s;
  return endTurn({ ...s, misfire: null });
}
