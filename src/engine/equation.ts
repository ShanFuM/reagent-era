/**
 * 方程式显示：统一处理气体 ↑ 与沉淀 ↓。
 *
 * 判断顺序：
 * 1. 数据里显式标了 gas / precipitate 的，直接用
 * 2. 生成物本身是气体单质或常见气体，且不是「点燃」条件（燃烧反应不写 ↑）
 * 3. 生成物是可溶性的盐或碱，判为不溶时写 ↓
 */
import { formatFormula } from './formula.js';
import { decompose, isSoluble } from './chem';
import { SUBSTANCES } from './data';

/** 常见气体，作为没有显式标注时的兜底 */
const GAS_FORMULAS = new Set([
  'H2',
  'O2',
  'N2',
  'Cl2',
  'CO2',
  'SO2',
  'NH3',
  'H2S',
  'NO',
  'NO2',
  'HCl',
  'CH4',
]);

/** 判断某个生成物后面该不该加 ↑ / ↓ */
export function productMark(id: string, gas: string[], precipitate: string[], condition: string): string {
  if (gas.includes(id)) return '↑';
  if (precipitate.includes(id)) return '↓';

  const kind = SUBSTANCES[id]?.kind ?? '';

  // 燃烧反应与气体之间的反应不标气标
  if (condition !== '点燃' && GAS_FORMULAS.has(id) && kind !== '酸') {
    // 酸以气体形式出现（如加热浓盐酸）才标，这里只处理单质与氧化物类气体
    if (kind !== '盐' && kind !== '碱') return '↑';
  }

  if (kind === '盐' || kind === '碱') {
    const parts = decompose(id);
    if (parts && !isSoluble(parts.cation, parts.anion)) return '↓';
  }

  return '';
}

export interface EquationLike {
  reactants: [string, number][];
  products: [string, number][];
  gas?: string[];
  precipitate?: string[];
  condition: string;
}

/** 把一条反应渲染成完整方程式，生成物带 ↑ / ↓ */
export function equationText(r: EquationLike): string {
  const gas = r.gas ?? [];
  const precipitate = r.precipitate ?? [];
  const side = (terms: [string, number][], areProducts: boolean) =>
    terms
      .map(([id, n]) => {
        const coef = n > 1 ? n : '';
        const mark = areProducts ? productMark(id, gas, precipitate, r.condition) : '';
        return `${coef}${formatFormula(id)}${mark}`;
      })
      .join(' + ');
  return `${side(r.reactants, false)} = ${side(r.products, true)}`;
}
