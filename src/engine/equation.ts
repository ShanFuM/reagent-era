/**
 * 方程式显示：统一处理气体 ↑ 与沉淀 ↓。
 *
 * 判断顺序：
 * 1. 数据里显式标了 gas / precipitate 的，直接用
 * 2. 生成物是常见气体，且不是「点燃」条件（燃烧反应不写 ↑）
 * 3. 只有反应体系里有溶液成分（酸/碱/盐）时，才按溶解性写 ↓
 *    —— 否则 CaO + CO₂ = CaCO₃ 这种固气反应也会被错标成沉淀
 */
import { formatFormula } from './formula.js';
import { decompose, isSoluble } from './chem';
import { SUBSTANCES } from './data';

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
  'CH4',
]);

export interface EquationLike {
  reactants: [string, number][];
  products: [string, number][];
  gas?: string[];
  precipitate?: string[];
  condition: string;
}

/** 反应体系里是否有溶液成分（酸 / 碱 / 盐） */
function hasSolutionSpecies(r: EquationLike): boolean {
  return r.reactants.some(([id]) => {
    const kind = SUBSTANCES[id]?.kind ?? '';
    return kind === '酸' || kind === '碱' || kind === '盐';
  });
}

/** 判断某个生成物后面该不该加 ↑ / ↓ */
export function productMark(r: EquationLike, id: string): string {
  const gas = r.gas ?? [];
  const precipitate = r.precipitate ?? [];
  if (gas.includes(id)) return '↑';
  if (precipitate.includes(id)) return '↓';

  const kind = SUBSTANCES[id]?.kind ?? '';

  if (r.condition !== '点燃' && GAS_FORMULAS.has(id) && (kind === '单质' || kind === '氧化物' || kind === '气体')) {
    return '↑';
  }

  if ((kind === '盐' || kind === '碱') && hasSolutionSpecies(r)) {
    const parts = decompose(id);
    if (parts && !isSoluble(parts.cation, parts.anion)) return '↓';
  }

  return '';
}

/** 把一条反应渲染成完整方程式，生成物带 ↑ / ↓ */
export function equationText(r: EquationLike): string {
  const side = (terms: [string, number][], areProducts: boolean) =>
    terms
      .map(([id, n]) => {
        const coef = n > 1 ? n : '';
        const mark = areProducts ? productMark(r, id) : '';
        return `${coef}${formatFormula(id)}${mark}`;
      })
      .join(' + ');
  return `${side(r.reactants, false)} = ${side(r.products, true)}`;
}
