/**
 * 反应判定回归测试。
 *
 * 这里列的是「一个学过化学的人会怎么判」——正向是必须反应，负向是必须不反应。
 * 任何一条挂了，说明规则引擎的化学常识出错，比数值问题严重得多。
 *
 * 构建：vite build --ssr scripts/chem-check.ts --outDir .sim
 * 运行：node .sim/chem-check.js
 */
import { LEVELS, lookupReaction, SUBSTANCES } from '../src/engine/data';
import { formatFormula } from '../src/engine/formula.js';

interface Case {
  pair: [string, string];
  expect: boolean;
  note?: string;
}

const CASES: Case[] = [
  // —— 金属 + 酸 ——
  { pair: ['Zn', 'HCl'], expect: true },
  { pair: ['Fe', 'HCl'], expect: true },
  { pair: ['Mg', 'HCl'], expect: true },
  { pair: ['Al', 'HCl'], expect: true },
  { pair: ['Zn', 'H2SO4'], expect: true },
  { pair: ['Cu', 'HCl'], expect: false, note: '铜在氢后面' },
  { pair: ['Ag', 'H2SO4'], expect: false },
  { pair: ['Cu', 'H2SO4'], expect: true, note: '表里的是浓硫酸加热版（高考重点），界面会显示加热条件' },

  // —— 金属 + 盐 ——
  { pair: ['Zn', 'CuSO4'], expect: true, note: '用户报的缺失项' },
  { pair: ['Fe', 'CuSO4'], expect: true },
  { pair: ['Mg', 'CuSO4'], expect: true },
  { pair: ['Al', 'CuSO4'], expect: true },
  { pair: ['Cu', 'AgNO3'], expect: true },
  { pair: ['Fe', 'AgNO3'], expect: true },
  { pair: ['Zn', 'CuCl2'], expect: true },
  { pair: ['Cu', 'FeSO4'], expect: false, note: '铜不如铁活泼' },
  { pair: ['Fe', 'ZnSO4'], expect: false, note: '铁不如锌活泼' },
  { pair: ['Zn', 'NaCl'], expect: false, note: '钠比锌活泼，置换不了' },

  // —— 中和 ——
  { pair: ['HCl', 'NaOH'], expect: true },
  { pair: ['H2SO4', 'NaOH'], expect: true },
  { pair: ['HCl', 'Ca(OH)2'], expect: true },
  { pair: ['H2SO4', 'Ba(OH)2'], expect: true },
  { pair: ['HCl', 'Cu(OH)2'], expect: true, note: '难溶碱也能中和' },

  // —— 酸 + 碳酸盐 ——
  { pair: ['HCl', 'CaCO3'], expect: true },
  { pair: ['HCl', 'Na2CO3'], expect: true },
  { pair: ['HCl', 'NaHCO3'], expect: true },
  { pair: ['H2SO4', 'CaCO3'], expect: true },

  // —— 复分解：沉淀 ——
  { pair: ['AgNO3', 'NaCl'], expect: true },
  { pair: ['AgNO3', 'HCl'], expect: true },
  { pair: ['BaCl2', 'Na2SO4'], expect: true },
  { pair: ['BaCl2', 'H2SO4'], expect: true },
  { pair: ['CuSO4', 'NaOH'], expect: true },
  { pair: ['FeCl3', 'NaOH'], expect: true },
  { pair: ['Na2CO3', 'Ca(OH)2'], expect: true },
  { pair: ['BaCl2', 'Na2CO3'], expect: true },
  { pair: ['CaCl2', 'Na2CO3'], expect: true },
  { pair: ['NaCl', 'Na2SO4'], expect: false, note: '两个都可溶，没有沉淀' },
  { pair: ['Na2SO4', 'KCl'], expect: false },
  { pair: ['H2SO4', 'NaNO3'], expect: false },

  // —— 碱性氧化物 + 酸 ——
  { pair: ['Fe2O3', 'HCl'], expect: true },
  { pair: ['CuO', 'H2SO4'], expect: true },
  { pair: ['MgO', 'HCl'], expect: true },

  // —— 酸 + 盐（强酸制弱酸 / 沉淀）——
  { pair: ['HCl', 'Na2S'], expect: true, note: '生成硫化氢' },
  { pair: ['H2SO4', 'BaCl2'], expect: true },

  // —— 氧化还原特例 ——
  { pair: ['KMnO4', 'H2S'], expect: true, note: '用户报的缺失项' },
  { pair: ['Cl2', 'NaBr'], expect: true },
  { pair: ['Cl2', 'KI'], expect: true },

  // —— 非金属还原金属氧化物 ——
  { pair: ['C', 'CuO'], expect: true, note: '碳还原氧化铜，初中重点' },
  { pair: ['C', 'Fe2O3'], expect: true },
  { pair: ['H2', 'CuO'], expect: true },
  { pair: ['H2', 'Fe2O3'], expect: true },
  { pair: ['Al', 'Fe2O3'], expect: true, note: '铝热反应' },

  // —— 酸性氧化物 + 碱 ——
  { pair: ['CO2', 'NaOH'], expect: true },
  { pair: ['SO2', 'NaOH'], expect: true },
  { pair: ['CO2', 'Ca(OH)2'], expect: true },

  // —— 金属 + 非金属 ——
  { pair: ['Zn', 'O2'], expect: true },
  { pair: ['Na', 'Cl2'], expect: true },
  { pair: ['Fe', 'S'], expect: true },
  { pair: ['Ag', 'O2'], expect: false, note: '银不与氧气反应' },

  // —— 铵盐 + 碱 ——
  { pair: ['NH4Cl', 'NaOH'], expect: true, note: '生成氨气' },

  // —— 必须判为不反应 ——
  { pair: ['C', 'HCl'], expect: false },
  { pair: ['CuO', 'H2O'], expect: false, note: '氧化铜不与水反应' },
  { pair: ['CO2', 'HCl'], expect: false },
  { pair: ['Fe', 'CuO'], expect: false, note: '两个固体不发生置换' },

  // —— 必须有解的关卡 ——
  { pair: ['Zn', 'CuSO4'], expect: true },
];

let failed = 0;
const lines: string[] = [];

for (const testCase of CASES) {
  const [a, b] = testCase.pair;
  const sa = SUBSTANCES[a];
  const sb = SUBSTANCES[b];
  if (!sa || !sb) {
    lines.push(`✗ ${a} + ${b} —— 物质表里没有 ${!sa ? a : b}`);
    failed += 1;
    continue;
  }
  const hit = lookupReaction([a, b]);
  const got = hit !== null;
  if (got !== testCase.expect) {
    failed += 1;
    lines.push(
      `✗ ${a} + ${b} 期望${testCase.expect ? '反应' : '不反应'}，实际${got ? '反应' : '不反应'}${
        testCase.note ? `（${testCase.note}）` : ''
      }`,
    );
    continue;
  }
  if (hit) {
    const eq = [
      ...hit.reaction.reactants.map(([id, n]) => `${n > 1 ? n : ''}${formatFormula(id)}`),
    ].join(' + ');
    const rhs = hit.reaction.products
      .map(([id, n]) => `${n > 1 ? n : ''}${formatFormula(id)}`)
      .join(' + ');
    lines.push(`✓ ${a} + ${b} → ${eq} = ${rhs}`);
  } else {
    lines.push(`✓ ${a} + ${b} → 不反应`);
  }
}

// 多反应物方程式（3 个及以上）必须能查出来——手牌选择已经不设上限了
const MULTI: string[][] = [
  ['Al2O3', 'NaOH', 'H2O'],
  ['Fe', 'O2', 'H2O'],
  ['Na2CO3', 'CO2', 'H2O'],
];
for (const ids of MULTI) {
  const hit = lookupReaction(ids);
  if (!hit) {
    failed += 1;
    lines.push(`✗ ${ids.join(' + ')} 应该能反应，但判定为不反应`);
    continue;
  }
  const eq = hit.reaction.reactants
    .map(([id, n]) => `${n > 1 ? n : ''}${formatFormula(id)}`)
    .join(' + ');
  const rhs = hit.reaction.products
    .map(([id, n]) => `${n > 1 ? n : ''}${formatFormula(id)}`)
    .join(' + ');
  lines.push(`✓ ${ids.join(' + ')} → ${eq} = ${rhs}`);
}

// 每一关的试剂架里，必须存在至少一条「可打出且能打弱点」的反应
for (const level of LEVELS) {
  const shelf = level.shelf;
  let playable = 0;
  let hitting = 0;
  for (let i = 0; i < shelf.length; i += 1) {
    for (let j = i + 1; j < shelf.length; j += 1) {
      const hit = lookupReaction([shelf[i], shelf[j]]);
      if (!hit) continue;
      playable += 1;
      if (level.enemy.weakness.includes(hit.reaction.type as never)) hitting += 1;
    }
  }
  if (playable < 3) {
    failed += 1;
    lines.push(`✗ 第 ${level.id} 关只有 ${playable} 条可打出的反应`);
  }
  lines.push(`· 第 ${level.id} 关：可打出 ${playable} 条，其中命中弱点 ${hitting} 条`);
}

// 反应库规模：所有物质两两组合里有多少组能反应（衡量「自由多样」的指标）
const names = Object.keys(SUBSTANCES);
let reactingPairs = 0;
let totalPairs = 0;
for (let i = 0; i < names.length; i += 1) {
  for (let j = i + 1; j < names.length; j += 1) {
    totalPairs += 1;
    if (lookupReaction([names[i], names[j]])) reactingPairs += 1;
  }
}
const percent = ((reactingPairs / totalPairs) * 100).toFixed(1);
lines.push(`· 反应库规模：${reactingPairs} / ${totalPairs} 组物质组合可以反应（${percent}%）`);

console.log(lines.join('\n'));
console.log(failed === 0 ? '\n✓ 反应判定全部通过' : `\n✗ ${failed} 项未通过`);
if (failed > 0) process.exit(1);
