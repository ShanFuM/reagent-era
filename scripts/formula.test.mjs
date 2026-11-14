import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFormula, checkBalance, gcdAll, formatFormula } from '../src/engine/formula.js';

test('解析简单分子式', () => {
  assert.deepEqual(parseFormula('H2SO4').atoms, { H: 2, S: 1, O: 4 });
  assert.deepEqual(parseFormula('Na').atoms, { Na: 1 });
});

test('解析括号与方括号', () => {
  assert.deepEqual(parseFormula('Ca(OH)2').atoms, { Ca: 1, O: 2, H: 2 });
  assert.deepEqual(parseFormula('Na[Al(OH)4]').atoms, { Na: 1, Al: 1, O: 4, H: 4 });
  assert.deepEqual(parseFormula('Al2(SO4)3').atoms, { Al: 2, S: 3, O: 12 });
});

test('解析电荷', () => {
  assert.equal(parseFormula('SO4^2-').charge, -2);
  assert.equal(parseFormula('Fe^3+').charge, 3);
  assert.equal(parseFormula('NH4^+').charge, 1);
  assert.deepEqual(parseFormula('[Al(OH)4]^-').atoms, { Al: 1, O: 4, H: 4 });
});

test('结晶水', () => {
  assert.deepEqual(parseFormula('CuSO4·5H2O').atoms, { Cu: 1, S: 1, O: 9, H: 10 });
});

test('配平判定', () => {
  const ok = checkBalance(
    [{ formula: 'Zn', n: 1 }, { formula: 'HCl', n: 2 }],
    [{ formula: 'ZnCl2', n: 1 }, { formula: 'H2', n: 1 }],
  );
  assert.equal(ok.balanced, true);

  const bad = checkBalance(
    [{ formula: 'Zn', n: 1 }, { formula: 'HCl', n: 1 }],
    [{ formula: 'ZnCl2', n: 1 }, { formula: 'H2', n: 1 }],
  );
  assert.equal(bad.balanced, false);
});

test('最简整数比', () => {
  assert.equal(gcdAll([2, 4, 2]), 2);
  assert.equal(gcdAll([2, 3, 5]), 1);
});

test('显示格式化', () => {
  assert.equal(formatFormula('H2SO4'), 'H₂SO₄');
  assert.equal(formatFormula('Ca(OH)2'), 'Ca(OH)₂');
  assert.equal(formatFormula('SO4^2-'), 'SO₄²⁻');
});
