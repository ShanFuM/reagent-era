#!/usr/bin/env node
/**
 * 一次性工具：批量导入候选方程式。
 * - 校验配平（原子守恒 + 最简整数比）
 * - 只保留生成物都存在于物质表的条目（缺物质就跳过并报告）
 * - 自动计算 levels：所有「试剂架里同时含有全部反应物」的关卡
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFormula, checkBalance, gcdAll } from '../src/engine/formula.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const substances = readJSON('data/substances.json');
const reactions = readJSON('data/reactions.json');
const levels = readJSON('data/levels.json');

/** [反应物[[id,系数]...], 生成物[[id,系数]...], 其它字段] */
const CANDIDATES = [
  // —— 氧化还原 ——
  [
    [['KMnO4', 2], ['H2O2', 3]],
    [['MnO2', 2], ['O2', 3], ['KOH', 2], ['H2O', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '紫红色褪去，产生大量气泡，生成黑色沉淀',
      gas: ['O2'],
      precipitate: ['MnO2'],
      stars: 3,
      trap: '过氧化氢既作还原剂又自身分解；酸性介质中高锰酸根会生成 Mn²⁺ 而不是 MnO₂',
    },
  ],
  [
    [['H2S', 1], ['HNO3', 2]],
    [['S', 1], ['NO2', 2], ['H2O', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '产生红棕色气体，溶液变浑浊',
      gas: ['NO2'],
      precipitate: ['S'],
      stars: 3,
      trap: '浓硝酸把硫离子氧化成硫单质；稀硝酸则生成 NO',
    },
  ],
  [
    [['Na2S', 2], ['SO2', 1], ['H2O', 2]],
    [['S', 3], ['NaOH', 4]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '溶液中析出淡黄色沉淀，碱性增强',
      precipitate: ['S'],
      stars: 3,
      trap: '归中反应：−2 价硫与 +4 价硫归到 0 价',
    },
  ],
  [
    [['Cl2', 1], ['H2S', 1]],
    [['S', 1], ['HCl', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '黄绿色褪去，析出淡黄色沉淀',
      precipitate: ['S'],
      stars: 2,
    },
  ],
  [
    [['H2O2', 1], ['SO2', 1]],
    [['H2SO4', 1]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '刺激性气味消失，溶液酸性增强',
      stars: 2,
      trap: '过氧化氢把 +4 价硫氧化到 +6 价',
    },
  ],
  [
    [['FeCl3', 2], ['KI', 2]],
    [['FeCl2', 2], ['I2', 1], ['KCl', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '溶液变棕黄色，淀粉变蓝',
      stars: 3,
      trap: 'Fe³⁺ 的氧化性强于 I₂，所以能把碘离子氧化成碘单质',
    },
  ],
  [
    [['FeCl3', 2], ['H2S', 1]],
    [['FeCl2', 2], ['S', 1], ['HCl', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '棕黄色变浅绿，析出淡黄色沉淀',
      precipitate: ['S'],
      stars: 2,
    },
  ],
  [
    [['C', 1], ['H2SO4', 2]],
    [['CO2', 1], ['SO2', 2], ['H2O', 2]],
    {
      type: '氧化还原',
      condition: '加热',
      phenomenon: '碳被氧化，产生两种气体',
      gas: ['CO2', 'SO2'],
      stars: 3,
      trap: '浓硫酸的强氧化性；稀硫酸不与碳反应',
    },
  ],
  [
    [['Mg', 2], ['CO2', 1]],
    [['MgO', 2], ['C', 1]],
    {
      type: '氧化还原',
      condition: '点燃',
      phenomenon: '镁在二氧化碳中继续燃烧，瓶壁出现黑色颗粒',
      stars: 2,
      trap: '二氧化碳能支持活泼金属燃烧，不能用它灭火',
    },
  ],
  [
    [['Na2O2', 2], ['HCl', 4]],
    [['NaCl', 4], ['H2O', 2], ['O2', 1]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '淡黄色固体溶解，产生气泡',
      gas: ['O2'],
      stars: 2,
    },
  ],
  // —— 复分解与中和 ——
  [
    [['Fe(OH)3', 1], ['HCl', 3]],
    [['FeCl3', 1], ['H2O', 3]],
    {
      type: '中和',
      condition: '常温',
      phenomenon: '红褐色沉淀溶解，溶液变棕黄',
      stars: 2,
    },
  ],
  [
    [['Cu(OH)2', 1]],
    [['CuO', 1], ['H2O', 1]],
    {
      type: '分解',
      condition: '加热',
      phenomenon: '蓝色沉淀变黑',
      stars: 2,
      trap: '难溶碱受热分解为金属氧化物和水',
    },
  ],
  [
    [['NaHCO3', 1], ['NaOH', 1]],
    [['Na2CO3', 1], ['H2O', 1]],
    {
      type: '复分解',
      condition: '常温',
      phenomenon: '无明显现象',
      stars: 2,
      trap: '碳酸氢钠与碱反应生成正盐，这是「酸式盐转正盐」的典型',
    },
  ],
  [
    [['CH3COOH', 1], ['NaOH', 1]],
    [['CH3COONa', 1], ['H2O', 1]],
    {
      type: '中和',
      condition: '常温',
      phenomenon: '放热，无明显外观变化',
      stars: 2,
      trap: '弱酸与强碱中和，产物是强碱弱酸盐，溶液显碱性',
    },
  ],
  [
    [['AlCl3', 1], ['NaOH', 4]],
    [['Na[Al(OH)4]', 1], ['NaCl', 3]],
    {
      type: '复分解',
      condition: '常温',
      phenomenon: '先出现白色沉淀，碱过量后沉淀溶解',
      stars: 3,
      trap: '氢氧化铝溶于过量强碱；用氨水则沉淀不会溶解',
    },
  ],
  // —— 第二批：氧化还原与元素化合物 ——
  [
    [['KMnO4', 2], ['H2S', 5], ['H2SO4', 3]],
    [['K2SO4', 1], ['MnSO4', 2], ['S', 5], ['H2O', 8]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '紫红色褪去，析出淡黄色沉淀',
      precipitate: ['S'],
      stars: 3,
      trap: '酸性介质中 MnO₄⁻ 被还原为 Mn²⁺，不是 MnO₂',
    },
  ],
  [
    [['KMnO4', 2], ['SO2', 5], ['H2O', 2]],
    [['K2SO4', 1], ['MnSO4', 2], ['H2SO4', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '紫红色褪去，刺激性气味消失',
      stars: 3,
      trap: '+4 价硫被氧化到 +6 价',
    },
  ],
  [
    [['S', 1], ['H2SO4', 2]],
    [['SO2', 3], ['H2O', 2]],
    {
      type: '氧化还原',
      condition: '加热',
      phenomenon: '硫被浓硫酸氧化，产生刺激性气味气体',
      gas: ['SO2'],
      stars: 3,
      trap: '浓硫酸的强氧化性；稀硫酸不与硫反应',
    },
  ],
  [
    [['H2S', 1], ['H2SO4', 1]],
    [['S', 1], ['SO2', 1], ['H2O', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '产生刺激性气味气体并析出淡黄色沉淀',
      gas: ['SO2'],
      precipitate: ['S'],
      stars: 3,
      trap: '同种元素 −2 价与 +6 价归中到 0 价',
    },
  ],
  [
    [['C', 1], ['HNO3', 4]],
    [['CO2', 1], ['NO2', 4], ['H2O', 2]],
    {
      type: '氧化还原',
      condition: '加热',
      phenomenon: '碳被氧化，产生红棕色气体',
      gas: ['CO2', 'NO2'],
      stars: 3,
      trap: '浓硝酸的强氧化性，自身被还原为 NO₂',
    },
  ],
  [
    [['S', 1], ['HNO3', 6]],
    [['H2SO4', 1], ['NO2', 6], ['H2O', 2]],
    {
      type: '氧化还原',
      condition: '加热',
      phenomenon: '硫被氧化，产生红棕色气体',
      gas: ['NO2'],
      stars: 3,
    },
  ],
  [
    [['Fe', 1], ['HNO3', 4]],
    [['Fe(NO3)3', 1], ['NO', 1], ['H2O', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '铁溶解，产生无色气体，遇空气变红棕',
      gas: ['NO'],
      stars: 3,
      trap: '稀硝酸生成 NO；铁过量时会生成 Fe²⁺',
    },
  ],
  [
    [['Cl2', 1], ['Na2SO3', 1], ['H2O', 1]],
    [['Na2SO4', 1], ['HCl', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '黄绿色褪去，溶液酸性增强',
      stars: 2,
    },
  ],
  [
    [['Cl2', 1], ['Na2S', 1]],
    [['NaCl', 2], ['S', 1]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '黄绿色褪去，析出淡黄色沉淀',
      precipitate: ['S'],
      stars: 3,
    },
  ],
  [
    [['Br2', 1], ['KI', 2]],
    [['KBr', 2], ['I2', 1]],
    {
      type: '置换',
      condition: '常温',
      phenomenon: '溶液变棕黄，淀粉变蓝',
      stars: 2,
      trap: '氧化性 Br₂ > I₂，所以溴能把碘置换出来',
    },
  ],
  [
    [['Na2SO3', 2], ['O2', 1]],
    [['Na2SO4', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '亚硫酸钠被空气氧化为硫酸钠',
      stars: 2,
      trap: '亚硫酸钠需密封保存，久置会被氧化',
    },
  ],
  [
    [['Na2SO3', 1], ['H2SO4', 1]],
    [['Na2SO4', 1], ['SO2', 1], ['H2O', 1]],
    {
      type: '产气',
      condition: '常温',
      phenomenon: '产生有刺激性气味的气体',
      gas: ['SO2'],
      stars: 2,
      trap: '实验室制取二氧化硫的常用方法',
    },
  ],
  [
    [['SO2', 1], ['Cl2', 1], ['H2O', 2]],
    [['H2SO4', 1], ['HCl', 2]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '两种气体同时褪色，溶液酸性增强',
      stars: 3,
      trap: '二氧化硫的还原性；氯水与二氧化硫不能同时用于漂白',
    },
  ],
  [
    [['Na2O2', 1], ['SO2', 1]],
    [['Na2SO4', 1]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '淡黄色固体变为白色',
      stars: 2,
    },
  ],
  [
    [['Cu2(OH)2CO3', 1]],
    [['CuO', 2], ['H2O', 1], ['CO2', 1]],
    {
      type: '分解',
      condition: '加热',
      phenomenon: '绿色固体变黑，管口有水珠，产生使石灰水变浑浊的气体',
      gas: ['CO2'],
      stars: 2,
      trap: '铜绿受热分解，这就是「铜器生锈」的产物',
    },
  ],
  [
    [['NH4Cl', 1], ['NaOH', 1]],
    [['NaCl', 1], ['NH3', 1], ['H2O', 1]],
    {
      type: '产气',
      condition: '加热',
      phenomenon: '产生有刺激性气味的气体，使湿润红色石蕊试纸变蓝',
      gas: ['NH3'],
      stars: 3,
      trap: '铵盐与强碱共热放出氨气，这是检验 NH₄⁺ 的方法',
    },
  ],
  [
    [['NH4Cl', 2], ['Ca(OH)2', 1]],
    [['CaCl2', 1], ['NH3', 2], ['H2O', 2]],
    {
      type: '产气',
      condition: '加热',
      phenomenon: '产生大量有刺激性气味的气体',
      gas: ['NH3'],
      stars: 3,
      trap: '实验室制氨气的标准方法',
    },
  ],
  [
    [['NH3', 1], ['HCl', 1]],
    [['NH4Cl', 1]],
    {
      type: '化合',
      condition: '常温',
      phenomenon: '两瓶气体接近时产生大量白烟',
      stars: 3,
      trap: '白烟是 NH₄Cl 固体小颗粒，不是白雾',
    },
  ],
  [
    [['NO2', 2], ['NaOH', 2]],
    [['NaNO3', 1], ['NaNO2', 1], ['H2O', 1]],
    {
      type: '氧化还原',
      condition: '常温',
      phenomenon: '红棕色气体被吸收',
      stars: 3,
      trap: 'NO₂ 既作氧化剂又作还原剂，这是尾气处理的方法',
    },
  ],
  [
    [['Fe3O4', 1], ['CO', 4]],
    [['Fe', 3], ['CO2', 4]],
    {
      type: '氧化还原',
      condition: '高温',
      phenomenon: '黑色固体变为银白色，产生使石灰水变浑浊的气体',
      gas: ['CO2'],
      stars: 3,
    },
  ],
  [
    [['H2O', 2]],
    [['H2', 2], ['O2', 1]],
    {
      type: '分解',
      condition: '通电',
      phenomenon: '两极产生气泡，正氧负氢，体积比 1:2',
      gas: ['H2', 'O2'],
      stars: 3,
      trap: '正极氧气、负极氢气，体积比 1:2',
    },
  ],
  [
    [['CaCO3', 1], ['CO2', 1], ['H2O', 1]],
    [['Ca(HCO3)2', 1]],
    {
      type: '化合',
      condition: '常温',
      phenomenon: '沉淀逐渐溶解，溶液变澄清',
      stars: 3,
      trap: '溶洞形成与硬水的成因',
    },
  ],
];

const existing = Object.keys(reactions);
// 已存在的反应物组合，避免重复执行脚本时插入重复条目
const existingKeys = new Set(
  Object.values(reactions).map((r) => r.reactants.map(([id]) => id).sort().join('+')),
);
let nextId = Math.max(...existing.map((k) => parseInt(k.replace(/\D/g, ''), 10) || 0)) + 1;

const added = [];
const skipped = [];

for (const [reactants, products, meta] of CANDIDATES) {
  const key0 = reactants.map(([id]) => id).sort().join('+');
  if (existingKeys.has(key0)) continue;

  const missing = [...reactants, ...products].map(([id]) => id).filter((id) => !substances[id]);
  if (missing.length) {
    skipped.push(`缺物质 ${missing.join(', ')}：${reactants.map(([i]) => i).join(' + ')}`);
    continue;
  }

  const balance = checkBalance(
    reactants.map(([id, n]) => ({ formula: id, n })),
    products.map(([id, n]) => ({ formula: id, n })),
  );
  if (!balance.balanced) {
    const diff = Object.entries(balance.atomDiff).map(([el, d]) => `${el}${d > 0 ? '+' : ''}${d}`).join(' ');
    skipped.push(`配不平（${diff || '电荷'}）：${reactants.map(([i]) => i).join(' + ')}`);
    continue;
  }
  const gcd = gcdAll([...reactants.map(([, n]) => n), ...products.map(([, n]) => n)]);
  if (gcd !== 1) {
    skipped.push(`系数不是最简：${reactants.map(([i]) => i).join(' + ')}`);
    continue;
  }

  // 归属：所有试剂架同时含有全部反应物的关卡
  const levelIds = Object.values(levels)
    .filter((lv) => reactants.every(([id]) => lv.shelf.includes(id)))
    .map((lv) => lv.id)
    .sort((a, b) => a - b);
  if (levelIds.length === 0) {
    skipped.push(`没有关卡能打出：${reactants.map(([i]) => i).join(' + ')}`);
    continue;
  }

  const key = `r${nextId}`;
  nextId += 1;
  reactions[key] = { levels: levelIds, reactants, products, ...meta };
  added.push(`${key}  ${reactants.map(([i]) => i).join(' + ')}  → 关卡 ${levelIds.join('/')}`);
}

writeFileSync(resolve(root, 'data/reactions.json'), JSON.stringify(reactions, null, 2) + '\n', 'utf8');

console.log(`新增 ${added.length} 条：`);
for (const line of added) console.log('  + ' + line);
if (skipped.length) {
  console.log(`\n跳过 ${skipped.length} 条：`);
  for (const line of skipped) console.log('  - ' + line);
}
