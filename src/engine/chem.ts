/**
 * 化学反应规则引擎。
 *
 * 之前游戏只认「手写反应表」，表里没有的配对一律判为不反应——
 * Zn + CuSO₄ 这种教科书反应都会被拒绝。这里改成：
 *
 *   1. 先把物质拆成「阳离子 + 阴离子」；
 *   2. 用金属活动性、溶解性表、酸碱反应规律推断能不能反应、生成什么；
 *   3. 系数交给通用配平器暴力求解，不再手写。
 *
 * 手写反应表仍然优先（它有现象、教材出处、陷阱提示），规则引擎只兜底。
 */
import { parseFormula } from './formula.js';

// ---------------------------------------------------------------- 离子表

export interface CationDef {
  id: string;
  /** 写化学式用的元素符号或原子团 */
  element: string;
  charge: number;
  polyatomic: boolean;
  label: string;
}

export interface AnionDef {
  id: string;
  formula: string;
  charge: number;
  polyatomic: boolean;
  label: string;
}

export const CATIONS: CationDef[] = [
  { id: 'H', element: 'H', charge: 1, polyatomic: false, label: '氢离子' },
  { id: 'Na', element: 'Na', charge: 1, polyatomic: false, label: '钠离子' },
  { id: 'K', element: 'K', charge: 1, polyatomic: false, label: '钾离子' },
  { id: 'NH4', element: 'NH4', charge: 1, polyatomic: true, label: '铵根离子' },
  { id: 'Ca', element: 'Ca', charge: 2, polyatomic: false, label: '钙离子' },
  { id: 'Mg', element: 'Mg', charge: 2, polyatomic: false, label: '镁离子' },
  { id: 'Ba', element: 'Ba', charge: 2, polyatomic: false, label: '钡离子' },
  { id: 'Al', element: 'Al', charge: 3, polyatomic: false, label: '铝离子' },
  { id: 'Zn', element: 'Zn', charge: 2, polyatomic: false, label: '锌离子' },
  { id: 'Fe2', element: 'Fe', charge: 2, polyatomic: false, label: '亚铁离子' },
  { id: 'Fe3', element: 'Fe', charge: 3, polyatomic: false, label: '铁离子' },
  { id: 'Cu', element: 'Cu', charge: 2, polyatomic: false, label: '铜离子' },
  { id: 'Ag', element: 'Ag', charge: 1, polyatomic: false, label: '银离子' },
];

export const ANIONS: AnionDef[] = [
  { id: 'Cl', formula: 'Cl', charge: 1, polyatomic: false, label: '氯离子' },
  { id: 'NO3', formula: 'NO3', charge: 1, polyatomic: true, label: '硝酸根' },
  { id: 'SO4', formula: 'SO4', charge: 2, polyatomic: true, label: '硫酸根' },
  { id: 'CO3', formula: 'CO3', charge: 2, polyatomic: true, label: '碳酸根' },
  { id: 'HCO3', formula: 'HCO3', charge: 1, polyatomic: true, label: '碳酸氢根' },
  { id: 'OH', formula: 'OH', charge: 1, polyatomic: true, label: '氢氧根' },
  { id: 'S', formula: 'S', charge: 2, polyatomic: false, label: '硫离子' },
  { id: 'CH3COO', formula: 'CH3COO', charge: 1, polyatomic: true, label: '醋酸根' },
  { id: 'ClO', formula: 'ClO', charge: 1, polyatomic: true, label: '次氯酸根' },
  { id: 'MnO4', formula: 'MnO4', charge: 1, polyatomic: true, label: '高锰酸根' },
  { id: 'SO3', formula: 'SO3', charge: 2, polyatomic: true, label: '亚硫酸根' },
  { id: 'O', formula: 'O', charge: 2, polyatomic: false, label: '氧离子' },
];

const CATION_BY_ID = new Map(CATIONS.map((c) => [c.id, c]));
const ANION_BY_ID = new Map(ANIONS.map((a) => [a.id, a]));

export function cation(id: string): CationDef {
  const c = CATION_BY_ID.get(id);
  if (!c) throw new Error(`未知阳离子 ${id}`);
  return c;
}

export function anion(id: string): AnionDef {
  const a = ANION_BY_ID.get(id);
  if (!a) throw new Error(`未知阴离子 ${id}`);
  return a;
}

const gcdNum = (a: number, b: number): number => (b === 0 ? a : gcdNum(b, a % b));

/** 由阴阳离子拼出化学式，例如 Zn²⁺ + NO₃⁻ → Zn(NO3)2 */
export function composeSalt(c: CationDef, a: AnionDef): string {
  const g = gcdNum(c.charge, a.charge);
  const nCat = a.charge / g;
  const nAn = c.charge / g;
  const catPart =
    c.polyatomic && nCat > 1 ? `(${c.element})${nCat}` : `${c.element}${nCat > 1 ? nCat : ''}`;
  const anPart =
    a.polyatomic && nAn > 1 ? `(${a.formula})${nAn}` : `${a.formula}${nAn > 1 ? nAn : ''}`;
  return catPart + anPart;
}

/** 化学式 → 阴阳离子。用「枚举所有离子组合」反查，避免逐条手写。 */
const SALT_INDEX = new Map<string, { cation: CationDef; anion: AnionDef }>();
for (const c of CATIONS) {
  for (const a of ANIONS) {
    const formula = composeSalt(c, a);
    if (!SALT_INDEX.has(formula)) SALT_INDEX.set(formula, { cation: c, anion: a });
  }
}

export function decompose(formula: string): { cation: CationDef; anion: AnionDef } | null {
  return SALT_INDEX.get(formula) ?? null;
}

// ---------------------------------------------------------------- 化学常识

/** 金属活动性顺序，数字越小越活泼；氢排在 10 */
export const METAL_ACTIVITY: Record<string, number> = {
  K: 1,
  Ca: 2,
  Na: 3,
  Mg: 4,
  Al: 5,
  Zn: 6,
  Fe: 7,
  Sn: 8,
  Pb: 9,
  Cu: 11,
  Hg: 12,
  Ag: 13,
};

export const HYDROGEN_ACTIVITY = 10;

/** 金属在置换反应里生成的离子（铁按 +2 处理，这是最常见的考点） */
export const METAL_ION: Record<string, string> = {
  K: 'K',
  Ca: 'Ca',
  Na: 'Na',
  Mg: 'Mg',
  Al: 'Al',
  Zn: 'Zn',
  Fe: 'Fe2',
  Cu: 'Cu',
  Ag: 'Ag',
};

const STRONG_ACIDS = new Set(['HCl', 'H2SO4', 'HNO3', 'HBr', 'HI']);
const WEAK_ACID_ANIONS = new Set(['CO3', 'HCO3', 'S', 'SO3', 'CH3COO', 'ClO', 'OH']);

/** 溶解性表：判断生成物是不是沉淀 */
export function isSoluble(c: CationDef, a: AnionDef): boolean {
  switch (a.id) {
    case 'NO3':
    case 'ClO':
    case 'CH3COO':
    case 'MnO4':
    case 'HCO3':
      return true;
    case 'Cl':
      return c.id !== 'Ag';
    case 'SO4':
      return c.id !== 'Ba' && c.id !== 'Ca' && c.id !== 'Ag';
    case 'CO3':
    case 'SO3':
      return c.id === 'Na' || c.id === 'K' || c.id === 'NH4';
    case 'OH':
      return c.id === 'Na' || c.id === 'K' || c.id === 'Ba' || c.id === 'Ca';
    case 'S':
      return c.id === 'Na' || c.id === 'K' || c.id === 'NH4';
    default:
      return true;
  }
}

// ---------------------------------------------------------------- 物质分类

export type Species =
  | { kind: 'metal'; element: string; ionization: CationDef; activity: number }
  | { kind: 'nonmetal'; element: string }
  | { kind: 'acid'; anion: AnionDef }
  | { kind: 'base'; cation: CationDef; soluble: boolean }
  | { kind: 'salt'; cation: CationDef; anion: AnionDef; soluble: boolean }
  | { kind: 'basicOxide'; cation: CationDef }
  | { kind: 'acidicOxide'; anion: AnionDef }
  | { kind: 'other' };

/** 酸性氧化物对应的酸根：CO₂→CO₃²⁻、SO₂→SO₃²⁻、SO₃→SO₄²⁻ */
const ACIDIC_OXIDE_ANION: Record<string, string> = {
  CO2: 'CO3',
  SO2: 'SO3',
  SO3: 'SO4',
};

/** 能还原金属氧化物的非金属单质 */
const REDUCING_NONMETALS = new Set(['C', 'H2']);

export function classify(formula: string, substanceKind: string): Species {
  if (substanceKind === '单质') {
    const act = METAL_ACTIVITY[formula];
    if (act !== undefined) {
      const ionId = METAL_ION[formula];
      const ion = ionId ? CATION_BY_ID.get(ionId) : undefined;
      if (ion) return { kind: 'metal', element: formula, ionization: ion, activity: act };
    }
    // 非金属单质：碳、氢气能作还原剂，氧气/氯气能作氧化剂
    return { kind: 'nonmetal', element: formula };
  }

  if (substanceKind === '氧化物') {
    const acidicAnion = ACIDIC_OXIDE_ANION[formula];
    if (acidicAnion) return { kind: 'acidicOxide', anion: anion(acidicAnion) };
  }

  const parts = decompose(formula);

  if (substanceKind === '酸' && parts && parts.cation.id === 'H') {
    return { kind: 'acid', anion: parts.anion };
  }

  if (substanceKind === '碱' && parts && parts.anion.id === 'OH') {
    return {
      kind: 'base',
      cation: parts.cation,
      soluble: isSoluble(parts.cation, parts.anion),
    };
  }

  if (substanceKind === '盐' && parts && parts.anion.id !== 'O') {
    return {
      kind: 'salt',
      cation: parts.cation,
      anion: parts.anion,
      soluble: isSoluble(parts.cation, parts.anion),
    };
  }

  if (substanceKind === '氧化物' && parts && parts.anion.id === 'O') {
    const basic = !['C', 'S', 'N', 'P'].includes(parts.cation.element);
    if (basic) return { kind: 'basicOxide', cation: parts.cation };
  }

  return { kind: 'other' };
}

// ---------------------------------------------------------------- 预测

export interface Prediction {
  products: string[];
  type: string;
  condition: string;
  phenomenon: string;
}

const H = cation('H');

/** 由金属单质 + 非氧化性酸生成盐和氢气 */
function metalWithAcid(metal: Extract<Species, { kind: 'metal' }>, acid: Extract<Species, { kind: 'acid' }>): Prediction | null {
  if (acid.anion.id === 'NO3') return null; // 硝酸有强氧化性，不放氢气
  if (metal.activity >= HYDROGEN_ACTIVITY) return null;
  const salt = composeSalt(metal.ionization, acid.anion);
  return {
    products: [salt, 'H2'],
    type: '置换',
    condition: '常温',
    phenomenon: `${metal.element}溶解，产生大量气泡`,
  };
}

/** 活动性强的金属把活动性弱的金属从盐溶液里置换出来 */
function metalWithSalt(
  metal: Extract<Species, { kind: 'metal' }>,
  salt: Extract<Species, { kind: 'salt' }>,
): Prediction | null {
  if (!salt.soluble) return null;
  const displacedActivity = METAL_ACTIVITY[salt.cation.element];
  if (displacedActivity === undefined) return null; // 铵盐等不参与
  if (metal.activity >= displacedActivity) return null;
  if (metal.activity <= 3) return null; // 钾钙钠先跟水反应
  const newSalt = composeSalt(metal.ionization, salt.anion);
  return {
    products: [newSalt, salt.cation.element],
    type: '置换',
    condition: '常温',
    phenomenon: `${metal.element}表面析出${salt.cation.element}`,
  };
}

function acidWithBase(
  acid: Extract<Species, { kind: 'acid' }>,
  base: Extract<Species, { kind: 'base' }>,
): Prediction {
  const salt = composeSalt(base.cation, acid.anion);
  return {
    products: [salt, 'H2O'],
    type: '中和',
    condition: '常温',
    phenomenon: '无明显现象，放热',
  };
}

function acidWithCarbonate(
  acid: Extract<Species, { kind: 'acid' }>,
  salt: Extract<Species, { kind: 'salt' }>,
): Prediction | null {
  if (salt.anion.id !== 'CO3' && salt.anion.id !== 'HCO3') return null;
  const newSalt = composeSalt(salt.cation, acid.anion);
  return {
    products: [newSalt, 'H2O', 'CO2'],
    type: '产气',
    condition: '常温',
    phenomenon: '剧烈冒泡，产生能使石灰水变浑浊的气体',
  };
}

/** 强酸制弱酸 / 生成沉淀：酸 + 盐 → 新酸 + 新盐 */
function acidWithSalt(
  acid: Extract<Species, { kind: 'acid' }>,
  salt: Extract<Species, { kind: 'salt' }>,
): Prediction | null {
  const precipitates = !isSoluble(salt.cation, acid.anion);
  const newAcidAnion = salt.anion;
  const weakAcid = WEAK_ACID_ANIONS.has(newAcidAnion.id);
  const acidIsStrong = STRONG_ACIDS.has(composeSalt(H, acid.anion));
  if (!precipitates && !(weakAcid && acidIsStrong)) return null;
  if (salt.anion.id === 'CO3' || salt.anion.id === 'HCO3') return null; // 交给碳酸盐规则
  const newSalt = composeSalt(salt.cation, acid.anion);
  const newAcid = composeSalt(H, salt.anion);
  return {
    products: [newSalt, newAcid],
    type: precipitates ? '沉淀' : '产气',
    condition: '常温',
    phenomenon: precipitates ? '立即出现沉淀' : '产生有刺激性气味的气体',
  };
}

/** 碱 + 盐 → 新碱 + 新盐，条件是生成沉淀 */
function baseWithSalt(
  base: Extract<Species, { kind: 'base' }>,
  salt: Extract<Species, { kind: 'salt' }>,
): Prediction | null {
  if (!base.soluble || !salt.soluble) return null;
  const newBaseSoluble = isSoluble(salt.cation, anion('OH'));
  const newSaltSoluble = isSoluble(base.cation, salt.anion);
  if (newBaseSoluble && newSaltSoluble) return null;
  const newBase = composeSalt(salt.cation, anion('OH'));
  const newSalt = composeSalt(base.cation, salt.anion);
  return {
    products: [newBase, newSalt],
    type: '沉淀',
    condition: '常温',
    phenomenon: '生成沉淀',
  };
}

/** 盐 + 盐 → 两种新盐，条件是生成沉淀 */
function saltWithSalt(
  a: Extract<Species, { kind: 'salt' }>,
  b: Extract<Species, { kind: 'salt' }>,
): Prediction | null {
  if (!a.soluble || !b.soluble) return null;
  const s1 = !isSoluble(a.cation, b.anion);
  const s2 = !isSoluble(b.cation, a.anion);
  if (!s1 && !s2) return null;
  const p1 = composeSalt(a.cation, b.anion);
  const p2 = composeSalt(b.cation, a.anion);
  return {
    products: [p1, p2],
    type: '沉淀',
    condition: '常温',
    phenomenon: '生成沉淀',
  };
}

/** 碱性氧化物 + 酸 → 盐 + 水 */
function basicOxideWithAcid(
  oxide: Extract<Species, { kind: 'basicOxide' }>,
  acid: Extract<Species, { kind: 'acid' }>,
): Prediction {
  const salt = composeSalt(oxide.cation, acid.anion);
  return {
    products: [salt, 'H2O'],
    type: '复分解',
    condition: '常温',
    phenomenon: '固体溶解，溶液变色',
  };
}

/** 碳 / 氢气在高温下还原金属氧化物（碳还原氧化铜是初中重点） */
function reducerWithOxide(
  red: Extract<Species, { kind: 'nonmetal' }>,
  oxide: Extract<Species, { kind: 'basicOxide' }>,
): Prediction | null {
  if (!REDUCING_NONMETALS.has(red.element)) return null;
  const activity = METAL_ACTIVITY[oxide.cation.element];
  if (activity === undefined || activity < 6) return null; // 钾钙钠镁铝还原不了
  const metal = oxide.cation.element;
  const byCarbon = red.element === 'C';
  return {
    products: byCarbon ? [metal, 'CO2'] : [metal, 'H2O'],
    type: '氧化还原',
    condition: byCarbon ? '高温' : '加热',
    phenomenon: byCarbon
      ? '黑色粉末逐渐变红，生成的气体使澄清石灰水变浑浊'
      : '黑色粉末变红，试管口有水滴生成',
  };
}

/** 酸性氧化物 + 可溶性碱 → 盐 + 水 */
function acidicOxideWithBase(
  oxide: Extract<Species, { kind: 'acidicOxide' }>,
  base: Extract<Species, { kind: 'base' }>,
): Prediction | null {
  if (!base.soluble) return null;
  const salt = composeSalt(base.cation, oxide.anion);
  const insoluble = !isSoluble(base.cation, oxide.anion);
  return {
    products: [salt, 'H2O'],
    type: insoluble ? '沉淀' : '复分解',
    condition: '常温',
    phenomenon: insoluble ? '气体被吸收，生成白色沉淀' : '气体被吸收，溶液碱性减弱',
  };
}

/** 金属 + 氧气 → 金属氧化物 */
function metalWithOxygen(
  metal: Extract<Species, { kind: 'metal' }>,
  nonmetal: Extract<Species, { kind: 'nonmetal' }>,
): Prediction | null {
  if (nonmetal.element !== 'O2') return null;
  if (metal.element === 'Fe') return null; // 铁燃烧生成 Fe₃O₄，交给手写表
  if (metal.activity > 11) return null; // 铜之后不与氧气反应
  const oxide = composeSalt(metal.ionization, anion('O'));
  return {
    products: [oxide],
    type: '化合',
    condition: '点燃',
    phenomenon: '剧烈燃烧，生成固体氧化物',
  };
}

/** 金属 + 氯气 → 金属氯化物 */
function metalWithChlorine(
  metal: Extract<Species, { kind: 'metal' }>,
  nonmetal: Extract<Species, { kind: 'nonmetal' }>,
): Prediction | null {
  if (nonmetal.element !== 'Cl2') return null;
  if (metal.element === 'Fe') return null; // 铁生成 FeCl₃，交给手写表
  if (metal.activity > 11) return null;
  const salt = composeSalt(metal.ionization, anion('Cl'));
  return {
    products: [salt],
    type: '化合',
    condition: '点燃',
    phenomenon: '剧烈燃烧，生成棕黄色的烟',
  };
}

/** 铵盐 + 可溶性碱 → 新盐 + 氨气 + 水 */
function ammoniumWithBase(
  base: Extract<Species, { kind: 'base' }>,
  salt: Extract<Species, { kind: 'salt' }>,
): Prediction | null {
  if (salt.cation.id !== 'NH4') return null;
  if (!base.soluble) return null;
  const newSalt = composeSalt(base.cation, salt.anion);
  return {
    products: [newSalt, 'NH3', 'H2O'],
    type: '产气',
    condition: '加热',
    phenomenon: '产生有刺激性气味的气体，使湿润的红色石蕊试纸变蓝',
  };
}

/**
 * 给定两种物质，推断是否反应以及生成物。
 * 返回 null 表示「在中学化学范围内不反应」。
 */
export function predictPair(aFormula: string, aKind: string, bFormula: string, bKind: string): Prediction | null {
  const a = classify(aFormula, aKind);
  const b = classify(bFormula, bKind);

  const pairs: [Species, Species][] = [
    [a, b],
    [b, a],
  ];

  for (const [x, y] of pairs) {
    if (x.kind === 'metal' && y.kind === 'nonmetal') {
      const burnt = metalWithOxygen(x, y) ?? metalWithChlorine(x, y);
      if (burnt) return burnt;
    }
    if (x.kind === 'nonmetal' && y.kind === 'basicOxide') return reducerWithOxide(x, y);
    if (x.kind === 'acidicOxide' && y.kind === 'base') return acidicOxideWithBase(x, y);
    if (x.kind === 'base' && y.kind === 'salt' && y.cation.id === 'NH4')
      return ammoniumWithBase(x, y);
    if (x.kind === 'metal' && y.kind === 'acid') return metalWithAcid(x, y);
    if (x.kind === 'metal' && y.kind === 'salt') return metalWithSalt(x, y);
    if (x.kind === 'acid' && y.kind === 'base') return acidWithBase(x, y);
    if (x.kind === 'acid' && y.kind === 'salt') {
      const carbonate = acidWithCarbonate(x, y);
      if (carbonate) return carbonate;
      return acidWithSalt(x, y);
    }
    if (x.kind === 'base' && y.kind === 'salt') return baseWithSalt(x, y);
    if (x.kind === 'salt' && y.kind === 'salt') return saltWithSalt(x, y);
    if (x.kind === 'basicOxide' && y.kind === 'acid') return basicOxideWithAcid(x, y);
  }

  return null;
}

// ---------------------------------------------------------------- 配平

const balanceCache = new Map<string, number[] | null>();

/**
 * 暴力求最小整数系数。中学方程式最多 2 个反应物 + 3 个生成物，搜索空间很小。
 * 返回按 [反应物..., 生成物...] 顺序的系数；无解返回 null。
 */
export function balanceTerms(reactants: string[], products: string[]): number[] | null {
  const key = `${reactants.join('+')}>${products.join('+')}`;
  const cached = balanceCache.get(key);
  if (cached !== undefined) return cached;

  const formulas = [...reactants, ...products];
  const vectors = formulas.map((f) => parseFormula(f).atoms);
  const elements = [...new Set(vectors.flatMap((v) => Object.keys(v)))];
  const n = formulas.length;

  if (n > 6) {
    balanceCache.set(key, null);
    return null;
  }

  const maxCoeff = 8;
  const total = maxCoeff ** n;
  const coeffs = new Array<number>(n).fill(1);

  const check = (): number[] | null => {
    for (const el of elements) {
      let sum = 0;
      for (let i = 0; i < n; i += 1) {
        const count = vectors[i][el] ?? 0;
        if (count === 0) continue;
        const sign = i < reactants.length ? 1 : -1;
        sum += sign * count * coeffs[i];
        if (Math.abs(sum) > 100000) return null;
      }
      if (sum !== 0) return null;
    }
    return coeffs.slice();
  };

  for (let code = 0; code < total; code += 1) {
    let rest = code;
    for (let i = 0; i < n; i += 1) {
      coeffs[i] = (rest % maxCoeff) + 1;
      rest = Math.floor(rest / maxCoeff);
    }
    const found = check();
    if (!found) continue;
    const g = found.reduce((acc, c) => gcdNum(acc, c), 0);
    if (g === 1) {
      balanceCache.set(key, found);
      return found;
    }
  }

  balanceCache.set(key, null);
  return null;
}
