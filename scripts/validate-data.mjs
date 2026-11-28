#!/usr/bin/env node
/**
 * 化学数据校验器 —— CI 的第一道防线。
 *
 * 任何一条方程式只要出现原子不守恒、电荷不守恒、系数未化到最简，
 * 或者两种物质在同一条件下被写出两个不同产物，这里就会失败。
 *
 * 用法：node scripts/validate-data.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseFormula, checkBalance, gcdAll, atomKey } from '../src/engine/formula.js';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');

const readJSON = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const substances = readJSON('data/substances.json');
const reactions = readJSON('data/reactions.json');
const levels = readJSON('data/levels.json');

/** @type {string[]} */
const errors = [];
/** @type {string[]} */
const warnings = [];

const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

// ---------- 1. 物质表 ----------
for (const [id, s] of Object.entries(substances)) {
  const parsed = parseFormula(s.formula);
  const total = Object.values(parsed.atoms).reduce((a, b) => a + b, 0);
  if (!total) fail(`物质 ${id} 的 formula "${s.formula}" 解析不出任何原子`);
  const key = atomKey(parsed.atoms);
  const expectKey = atomKey(parseFormula(id).atoms);
  if (key !== expectKey) {
    fail(`物质 ${id} 的 formula "${s.formula}" 与 id 组成不一致（id=${expectKey}, formula=${key}）`);
  }
  if (!s.name) fail(`物质 ${id} 缺少中文名`);
}

// ---------- 2. 方程式 ----------
/** @type {Map<string, string[]>} */
const signatureMap = new Map();

for (const [rid, r] of Object.entries(reactions)) {
  const label = `方程式 ${rid}`;
  if (!Array.isArray(r.reactants) || r.reactants.length === 0) {
    fail(`${label} 没有反应物`);
    continue;
  }
  if (!Array.isArray(r.products) || r.products.length === 0) {
    fail(`${label} 没有生成物`);
    continue;
  }

  const ids = [...r.reactants, ...r.products].map(([id]) => id);
  for (const id of ids) {
    if (!substances[id]) fail(`${label} 引用了不存在的物质 "${id}"`);
  }
  if (ids.some((id) => !substances[id])) continue;

  const left = r.reactants.map(([id, n]) => ({ formula: id, n }));
  const right = r.products.map(([id, n]) => ({ formula: id, n }));
  const { balanced, atomDiff, chargeDiff } = checkBalance(left, right);

  if (!balanced) {
    const parts = Object.entries(atomDiff)
      .map(([el, d]) => `${el}${d > 0 ? '+' : ''}${d}`)
      .join(' ');
    fail(`${label} ${rid} 未配平：${parts || `电荷${chargeDiff}`}`);
  }

  const coeffs = [...r.reactants.map(([, n]) => n), ...r.products.map(([, n]) => n)];
  if (coeffs.some((n) => !Number.isInteger(n) || n <= 0)) {
    fail(`${label} 系数必须是正整数：${coeffs.join(',')}`);
  } else if (gcdAll(coeffs) !== 1) {
    fail(`${label} 系数不是最简整数比（gcd=${gcdAll(coeffs)}）`);
  }

  // 同一组反应物 = 必须唯一产物，否则玩家无法判断该走哪条路
  const sig = r.reactants
    .map(([id]) => id)
    .sort()
    .join('+');
  const sameSig = signatureMap.get(sig) ?? [];
  for (const otherId of sameSig) {
    const other = reactions[otherId];
    const sameProducts =
      JSON.stringify([...r.products].sort()) === JSON.stringify([...other.products].sort());
    if (!sameProducts) {
      fail(`反应物组合 [${sig}] 同时对应 ${otherId} 与 ${rid} 两个不同产物，判定会产生歧义`);
    }
  }
  sameSig.push(rid);
  signatureMap.set(sig, sameSig);

  if (!r.levels || r.levels.length === 0) warn(`${label} 没有归属任何关卡`);
  for (const lv of r.levels ?? []) {
    if (!levels[String(lv)]) fail(`${label} 归属的关卡 ${lv} 不存在`);
  }
  if (!r.phenomenon) warn(`${label} 缺少现象描述`);
  if (!r.type) fail(`${label} 缺少反应类型`);
  if (!r.condition) fail(`${label} 缺少反应条件`);
}

// ---------- 3. 关卡 ----------
const playableCache = new Map();

for (const [key, lv] of Object.entries(levels)) {
  const label = `第 ${key} 关「${lv.name}」`;
  if (!lv.enemy) {
    fail(`${label} 缺少敌人配置`);
    continue;
  }
  if (!(lv.enemy.hp > 0)) fail(`${label} 敌人血量无效`);
  if (!Array.isArray(lv.shelf) || lv.shelf.length < 4) fail(`${label} 试剂架太短`);

  for (const id of lv.shelf) {
    if (!substances[id]) fail(`${label} 试剂架引用了不存在的物质 "${id}"`);
  }
  const missing = lv.shelf.filter((id) => !substances[id]);
  if (missing.length) continue;

  const shelfSet = new Set(lv.shelf);
  const playable = Object.entries(reactions).filter(
    ([, r]) => r.reactants.every(([id]) => shelfSet.has(id)) && (r.levels ?? []).includes(lv.id),
  );
  playableCache.set(lv.id, playable);

  if (playable.length < 3) {
    fail(`${label} 只有 ${playable.length} 条可打出的反应（至少需要 3 条）`);
  }
  const weakness = lv.enemy.weakness ?? [];
  const hitsWeakness = playable.filter(([, r]) => weakness.includes(r.type));
  if (weakness.length && hitsWeakness.length === 0) {
    fail(`${label} 没有任何一条可打出的反应能命中弱点 [${weakness.join('/')}]`);
  }
  if (!lv.guide) warn(`${label} 缺少教学提示`);
  if (!lv.textbook) warn(`${label} 缺少教材出处`);
  if (lv.requireBalance && !(lv.balanceTime > 0)) {
    fail(`${label} 要求配平但没给倒计时`);
  }
  if (!(lv.handSize >= 2)) fail(`${label} 手牌上限过小`);
}

// ---------- 3.5 年级线 ----------
// 同一关可以属于多条线（前 4 关是四条线共用的新手教程），
// 所以校验的是「每条线内部 order 唯一 + 关卡数够」。
const LINE_NAMES = ['初三', '高一', '高二', '高三'];
/** @type {Map<string, { id: number, order: number, label: string }[]>} */
const byLine = new Map(LINE_NAMES.map((n) => [n, []]));

for (const [key, lv] of Object.entries(levels)) {
  const label = `第 ${key} 关「${lv.name}」`;
  const linesOk = Array.isArray(lv.lines) && lv.lines.length > 0;
  const orderOk = Number.isInteger(lv.order) && lv.order >= 1;

  if (!linesOk) {
    fail(`${label} 缺少 lines（该关出现在哪几条年级线）`);
  } else {
    if (new Set(lv.lines).size !== lv.lines.length) fail(`${label} 的 lines 有重复项`);
    for (const name of lv.lines) {
      if (!LINE_NAMES.includes(name)) fail(`${label} 的 lines 里有未知年级线 "${name}"`);
    }
  }
  if (!orderOk) fail(`${label} 的 order 必须是正整数（当前 ${JSON.stringify(lv.order)}）`);

  if (linesOk && orderOk) {
    for (const name of lv.lines) {
      if (LINE_NAMES.includes(name)) byLine.get(name).push({ id: lv.id, order: lv.order, label });
    }
  }
}

for (const name of LINE_NAMES) {
  const list = byLine.get(name);
  if (list.length < 4) {
    fail(`年级线「${name}」只有 ${list.length} 关，至少要 4 关`);
  }
  const seen = new Map();
  for (const item of list) {
    const prev = seen.get(item.order);
    if (prev) fail(`年级线「${name}」的 order ${item.order} 重复：${prev} 与 ${item.label}`);
    else seen.set(item.order, item.label);
  }
}

// ---------- 4. 汇总 ----------
const totalReactions = Object.keys(reactions).length;
console.log(`物质 ${Object.keys(substances).length} 种 · 方程式 ${totalReactions} 条 · 关卡 ${Object.keys(levels).length} 关`);
for (const [lid, list] of [...playableCache.entries()].sort((a, b) => a[0] - b[0])) {
  console.log(`  第 ${String(lid).padStart(2)} 关：可打出 ${list.length} 条反应`);
}
for (const name of LINE_NAMES) {
  console.log(`  ${name}线：${byLine.get(name).length} 关`);
}

if (warnings.length) {
  console.log(`\n⚠ 警告 ${warnings.length} 条`);
  for (const w of warnings) console.log(`  - ${w}`);
}

if (errors.length) {
  console.error(`\n✗ 发现 ${errors.length} 个问题：`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log('\n✓ 数据校验通过');
