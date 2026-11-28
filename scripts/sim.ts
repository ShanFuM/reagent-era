/**
 * 无头对战模拟：用随机策略把 12 关各打若干遍，检查
 * 1) 战斗循环不会卡死；2) 不会抛出异常；3) 胜负分布合理。
 *
 * 构建：vite build --ssr scripts/sim.ts --outDir .sim
 * 运行：node .sim/sim.js
 */
import { LEVELS, lookupReaction } from '../src/engine/data';
import {
  advance,
  confirmBalance,
  createBattle,
  resolveMisfire,
  skipBalance,
  submitSelection,
  toggleBoost,
  toggleCard,
} from '../src/engine/battle';
import type { BattleState } from '../src/engine/battle';

function pickMove(s: BattleState): number[] {
  const idx = s.hand.map((_, i) => i);
  const opts: number[][] = idx.map((i) => [i]);
  for (let i = 0; i < idx.length; i += 1) {
    for (let j = i + 1; j < idx.length; j += 1) {
      opts.push([i, j]);
      for (let k = j + 1; k < idx.length; k += 1) opts.push([i, j, k]);
    }
  }
  const valid = opts.filter((p) => lookupReaction(p.map((i) => s.hand[i])));
  const pool = valid.length > 0 ? valid : opts;
  return pool[Math.floor(Math.random() * pool.length)];
}

interface Outcome {
  levelId: number;
  result: 'win' | 'lose' | 'stuck';
  turns: number;
  hp: number;
  /** 这一局用到了几种不同的反应 */
  variety: number;
}

function runOne(levelId: number, correctRate: number): Outcome {
  const level = LEVELS.find((l) => l.id === levelId);
  if (!level) throw new Error(`关卡 ${levelId} 不存在`);
  let s = createBattle(level);
  let guard = 0;

  while (s.phase !== 'win' && s.phase !== 'lose' && guard < 600) {
    guard += 1;
    if (s.phase === 'select') {
      let next = s;
      // 偶尔用一次强化：既模拟真人打法，也覆盖「收尾门槛」的强化路径
      if (Math.random() < 0.3 && next.energy > 0) next = toggleBoost(next);
      for (const i of pickMove(s)) next = toggleCard(next, i);
      s = submitSelection(next);
    } else if (s.phase === 'balance') {
      const r = s.pending;
      if (!r) throw new Error('配平阶段缺少反应数据');
      const coeffs = [...r.reactants.map(([, n]) => n), ...r.products.map(([, n]) => n)];
      s =
        Math.random() < correctRate
          ? confirmBalance(s, coeffs, Math.random() < 0.5)
          : skipBalance(s);
    } else if (s.phase === 'resolving') {
      s = advance(s);
    } else if (s.phase === 'misfire') {
      // 真人玩家要先关掉提示卡，模拟器直接略过
      s = resolveMisfire(s);
    } else {
      break;
    }
  }

  return {
    levelId,
    result: s.phase === 'win' ? 'win' : s.phase === 'lose' ? 'lose' : 'stuck',
    turns: s.stats.turns,
    hp: s.playerHp,
    variety: Object.keys(s.reactionCounts).length,
  };
}

const ROUNDS = 60;
const rows: string[] = [];
let stuck = 0;
let wins = 0;
let total = 0;

for (const level of LEVELS) {
  const outcomes: Outcome[] = [];
  for (let i = 0; i < ROUNDS; i += 1) outcomes.push(runOne(level.id, 0.75));
  const w = outcomes.filter((o) => o.result === 'win').length;
  const l = outcomes.filter((o) => o.result === 'lose').length;
  const st = outcomes.filter((o) => o.result === 'stuck').length;
  stuck += st;
  wins += w;
  total += ROUNDS;
  const avgTurns = (outcomes.reduce((a, o) => a + o.turns, 0) / ROUNDS).toFixed(1);
  const avgVariety = (outcomes.reduce((a, o) => a + o.variety, 0) / ROUNDS).toFixed(1);
  rows.push(
    `第 ${String(level.id).padStart(2)} 关 ${level.name.padEnd(6, '　')} 胜 ${String(w).padStart(2)} / 负 ${String(l).padStart(2)} / 卡死 ${st}  平均 ${avgTurns} 回合 · 用到 ${avgVariety} 种不同反应`,
  );
}

console.log(rows.join('\n'));
console.log(`\n合计：${wins}/${total} 胜，卡死 ${stuck} 局`);
if (stuck > 0) {
  console.error('✗ 存在卡死的对局，需要检查战斗循环');
  process.exit(1);
}
console.log('✓ 12 关战斗循环全部可正常结束');
