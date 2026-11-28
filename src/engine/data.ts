import substancesRaw from '../../data/substances.json';
import reactionsRaw from '../../data/reactions.json';
import levelsRaw from '../../data/levels.json';
import { balanceTerms, predictPair } from './chem';

export type ReactionType =
  | '置换'
  | '中和'
  | '沉淀'
  | '产气'
  | '分解'
  | '化合'
  | '燃烧'
  | '氧化还原'
  | '复分解';

export interface Substance {
  name: string;
  formula: string;
  kind: string;
}

export type Cond = '常温' | '点燃' | '加热' | '高温' | '催化' | '通电';

export interface Reaction {
  levels: number[];
  reactants: [string, number][];
  products: [string, number][];
  type: ReactionType;
  condition: Cond;
  phenomenon: string;
  gas?: string[];
  precipitate?: string[];
  stars?: number;
  trap?: string;
}

export interface Enemy {
  name: string;
  art: string;
  hp: number;
  atk: number;
  armor: number;
  weakness: ReactionType[];
  resist: ReactionType[];
  intro: string;
}

/**
 * 多阶段 Boss 的单个阶段。字段全部来自 data/levels.json，纯数据、可序列化。
 * required 是按顺序必须打出的方程式 id（只推动「工序」，不限制其它反应）。
 */
export interface BossPhase {
  name: string;
  intro: string;
  hp: number;
  atk: number;
  armor: number;
  weakness: ReactionType[];
  resist: ReactionType[];
  required?: string[];
}

/** 四条年级线。同一关可以同时属于多条线（前 4 关对四条线相同）。 */
export type GradeLine = '初三' | '高一' | '高二' | '高三';

export const GRADE_LINES: GradeLine[] = ['初三', '高一', '高二', '高三'];

export interface Level {
  id: number;
  /** 该关出现在哪几条年级线里 */
  lines: GradeLine[];
  /** 在该线内的顺序，同一条线内不重复 */
  order: number;
  name: string;
  stage: string;
  textbook: string;
  guide: string;
  enemy: Enemy;
  /** 可选：多阶段 Boss。存在时按阶段切换血量/攻击/弱点，最后一阶段打完才判胜 */
  phases?: BossPhase[];
  shelf: string[];
  handSize: number;
  energy: number;
  balanceTime: number;
  requireBalance: boolean;
  /** 收尾门槛：必须至少一次完美配平或一次强化，才能结算胜利（第 7 关之后） */
  requireSkill?: boolean;
}

export const SUBSTANCES = substancesRaw as unknown as Record<string, Substance>;
export const REACTIONS = reactionsRaw as unknown as Record<string, Reaction>;
export const LEVELS: Level[] = Object.values(
  levelsRaw as unknown as Record<string, Level>,
).sort((a, b) => a.id - b.id);

/** 某条年级线的关卡，按线内 order 排好。 */
export function levelsOfLine(line: GradeLine): Level[] {
  return LEVELS.filter((l) => l.lines.includes(line)).sort((a, b) => a.order - b.order);
}

/** 同一条线里的下一关；已是最后一关时返回 null。 */
export function nextLevelInLine(line: GradeLine, current: Level): Level | null {
  return levelsOfLine(line).find((l) => l.order === current.order + 1) ?? null;
}

/** 反应物组合 → 反应。键把物质 id 排序后拼接，保证 (A,B) 与 (B,A) 等价。 */
const REACTION_BY_KEY = new Map<string, [string, Reaction]>();
for (const [id, r] of Object.entries(REACTIONS)) {
  const key = r.reactants
    .map(([sid]) => sid)
    .sort()
    .join('+');
  REACTION_BY_KEY.set(key, [id, r]);
}

export function substance(id: string): Substance {
  const s = SUBSTANCES[id];
  if (s) return s;
  // 规则引擎预测出的产物可能不在物质表里（比如 MgSO₄），
  // 这时退化成「用化学式当名字」，而不是让界面崩掉。
  return { name: id, formula: id, kind: '盐' };
}

/**
 * 用一组物质查询反应；不成立时返回 null。
 * 先查手写反应表（有现象、教材出处、陷阱提示），查不到再交给规则引擎推断。
 */
export function lookupReaction(ids: string[]): { id: string; reaction: Reaction } | null {
  const key = [...ids].sort().join('+');
  const hit = REACTION_BY_KEY.get(key);
  if (hit) return { id: hit[0], reaction: hit[1] };

  if (ids.length !== 2) return null;
  const first = SUBSTANCES[ids[0]];
  const second = SUBSTANCES[ids[1]];
  if (!first || !second) return null;

  const prediction = predictPair(first.formula, first.kind, second.formula, second.kind);
  if (!prediction) return null;

  const reactants = ids.slice();
  const products = prediction.products;
  const coefficients = balanceTerms(reactants, products);
  if (!coefficients) return null;

  const reaction: Reaction = {
    levels: [],
    reactants: reactants.map((id, i) => [id, coefficients[i]] as [string, number]),
    products: products.map(
      (id, i) => [id, coefficients[reactants.length + i]] as [string, number],
    ),
    type: prediction.type as ReactionType,
    condition: prediction.condition as Cond,
    phenomenon: prediction.phenomenon,
    stars: 1,
  };
  return { id: `gen:${key}`, reaction };
}

/** 该关卡内、只用试剂架就能打出的全部反应。 */
export function playableReactions(level: Level): [string, Reaction][] {
  const shelf = new Set(level.shelf);
  return Object.entries(REACTIONS).filter(
    ([, r]) => r.levels.includes(level.id) && r.reactants.every(([id]) => shelf.has(id)),
  );
}

/**
 * 这一关的「标准答案」：
 * - 有工序的 Boss 关 → 按工序顺序给（那本身就是解法）；
 * - 普通关 → 试剂架里能打、且命中弱点的反应，按高频度排序取前 3 条。
 */
export function solutionReactions(level: Level): { id: string; reaction: Reaction }[] {
  const required = (level.phases ?? []).flatMap((p) => p.required ?? []);
  if (required.length > 0) {
    return [...new Set(required)]
      .map((id) => ({ id, reaction: REACTIONS[id] }))
      .filter((x): x is { id: string; reaction: Reaction } => Boolean(x.reaction));
  }

  const weak = new Set(level.enemy.weakness);
  const hits = playableReactions(level)
    .filter(([, r]) => weak.has(r.type))
    .sort((a, b) => (b[1].stars ?? 0) - (a[1].stars ?? 0));
  const pool = hits.length > 0 ? hits : playableReactions(level);
  return pool.slice(0, 3).map(([id, reaction]) => ({ id, reaction }));
}

export function levelById(id: number): Level {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) throw new Error(`未知关卡：${id}`);
  return lv;
}
