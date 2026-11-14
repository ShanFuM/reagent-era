/**
 * 化学式解析与显示。
 *
 * 纯 JS（带 JSDoc 类型），因为构建时的数据校验脚本（纯 Node）和运行时引擎
 * 必须共用同一份解析逻辑——化学知识的正确性只有一套实现才有意义。
 */

/**
 * @typedef {{ atoms: Record<string, number>, charge: number }} ParsedFormula
 */

const SUB_DIGITS = '₀₁₂₃₄₅₆₇₈₉';
const SUP_DIGITS = '⁰¹²³⁴⁵⁶⁷⁸⁹';

/**
 * 解析化学式。支持括号 / 方括号 / 结晶水 / 电荷后缀（如 `SO4^2-`）。
 * @param {string} input
 * @returns {ParsedFormula}
 */
export function parseFormula(input) {
  const s = String(input).replace(/\s+/g, '');
  let charge = 0;
  let body = s;
  const caret = s.indexOf('^');
  if (caret >= 0) {
    body = s.slice(0, caret);
    const tail = s.slice(caret + 1);
    const m = /^(\d*)([+-])$/.exec(tail);
    if (m) {
      const magnitude = m[1] ? parseInt(m[1], 10) : 1;
      charge = (m[2] === '+' ? 1 : -1) * magnitude;
    }
  }

  const atoms = /** @type {Record<string, number>} */ ({});
  for (const part of body.split(/[·*]/)) {
    if (!part) continue;
    const lead = /^(\d+)(.*)$/.exec(part);
    const mult = lead ? parseInt(lead[1], 10) : 1;
    const rest = lead ? lead[2] : part;
    const parsed = parseGroupString(rest);
    for (const el of Object.keys(parsed)) {
      atoms[el] = (atoms[el] ?? 0) + parsed[el] * mult;
    }
  }
  return { atoms, charge };
}

/**
 * @param {string} s
 * @returns {Record<string, number>}
 */
function parseGroupString(s) {
  let i = 0;

  /** @param {string | null} close */
  function parse(close) {
    /** @type {Record<string, number>} */
    const out = {};
    while (i < s.length) {
      const ch = s[i];
      if (close && ch === close) {
        i += 1;
        return out;
      }
      if (ch === '(' || ch === '[') {
        i += 1;
        const inner = parse(ch === '(' ? ')' : ']');
        const n = readNumber();
        for (const el of Object.keys(inner)) {
          out[el] = (out[el] ?? 0) + inner[el] * n;
        }
        continue;
      }
      const m = /^[A-Z][a-z]?/.exec(s.slice(i));
      if (m) {
        i += m[0].length;
        const n = readNumber();
        out[m[0]] = (out[m[0]] ?? 0) + n;
        continue;
      }
      i += 1; // 忽略无法识别的字符，交由校验脚本报错
    }
    return out;
  }

  function readNumber() {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return 1;
    i += m[0].length;
    return parseInt(m[0], 10);
  }

  return parse(null);
}

/**
 * 原子组成的规范化字符串，用于比较两个式子是否为同一物质。
 * @param {Record<string, number>} atoms
 */
export function atomKey(atoms) {
  return Object.keys(atoms)
    .sort()
    .map((el) => `${el}${atoms[el]}`)
    .join('');
}

/**
 * 多组式子按系数求和后的原子总数。
 * @param {{ formula: string, n: number }[]} terms
 * @returns {{ atoms: Record<string, number>, charge: number }}
 */
export function sumAtoms(terms) {
  /** @type {Record<string, number>} */
  const atoms = {};
  let charge = 0;
  for (const term of terms) {
    const parsed = parseFormula(term.formula);
    for (const el of Object.keys(parsed.atoms)) {
      atoms[el] = (atoms[el] ?? 0) + parsed.atoms[el] * term.n;
    }
    charge += parsed.charge * term.n;
  }
  return { atoms, charge };
}

/**
 * 判断一组系数是否使方程式成立。
 * @param {{ formula: string, n: number }[]} left
 * @param {{ formula: string, n: number }[]} right
 * @returns {{ balanced: boolean; atomDiff: Record<string, number>; chargeDiff: number }}
 */
export function checkBalance(left, right) {
  const l = sumAtoms(left);
  const r = sumAtoms(right);
  /** @type {Record<string, number>} */
  const atomDiff = {};
  let nonzero = false;
  for (const el of new Set([...Object.keys(l.atoms), ...Object.keys(r.atoms)])) {
    const d = (l.atoms[el] ?? 0) - (r.atoms[el] ?? 0);
    if (d !== 0) {
      atomDiff[el] = d;
      nonzero = true;
    }
  }
  const chargeDiff = l.charge - r.charge;
  return { balanced: !nonzero && chargeDiff === 0, atomDiff, chargeDiff };
}

/**
 * 最大公约数，用于判断系数是否已化为最简整数比。
 * @param {number[]} nums
 */
export function gcdAll(nums) {
  const gcd2 = (/** @type {number} */ a, /** @type {number} */ b) => {
    while (b) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a;
  };
  return nums.reduce((acc, n) => gcd2(acc, Math.abs(n)), 0);
}

/**
 * 把 ASCII 化学式渲染成带下标的显示形式，例如 `H2SO4` → `H₂SO₄`。
 * @param {string} formula
 */
export function formatFormula(formula) {
  const s = String(formula);
  const caret = s.indexOf('^');
  const body = caret >= 0 ? s.slice(0, caret) : s;
  const tail = caret >= 0 ? s.slice(caret + 1) : '';
  const sub = body.replace(/(?<=[A-Za-z)\]])(\d+)/g, (d) =>
    [...d].map((c) => SUB_DIGITS[Number(c)]).join(''),
  );
  if (!tail) return sub;
  const m = /^(\d*)([+-])$/.exec(tail);
  if (!m) return sub;
  const num = m[1] ? [...m[1]].map((c) => SUP_DIGITS[Number(c)]).join('') : '';
  return `${sub}${num}${m[2] === '+' ? '⁺' : '⁻'}`;
}
