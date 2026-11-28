import { useEffect, useState } from 'react';
import {
  advance,
  bossPhaseOf,
  chainView,
  confirmBalance,
  createBattle,
  enemyResistOf,
  enemyWeaknessOf,
  skillGate,
  skipBalance,
  submitSelection,
  toggleBoost,
  toggleCard,
} from '../engine/battle';
import type { BattleState } from '../engine/battle';
import { nextLevelInLine, solutionReactions, substance } from '../engine/data';
import type { GradeLine, Level, Reaction } from '../engine/data';
import { formatFormula } from '../engine/formula.js';
import BalancePad from './BalancePad';

const formatEquation = (r: Reaction) =>
  `${r.reactants.map(([id, n]) => `${n > 1 ? n : ''}${formatFormula(id)}`).join(' + ')} = ${r.products
    .map(([id, n]) => `${n > 1 ? n : ''}${formatFormula(id)}`)
    .join(' + ')}`;

const KIND_CLASS: Record<string, string> = {
  单质: 'element',
  氧化物: 'oxide',
  过氧化物: 'peroxide',
  酸: 'acid',
  碱: 'base',
  盐: 'salt',
  气体: 'gas',
  有机物: 'organic',
};

interface Props {
  level: Level;
  /** 当前年级线：决定「下一关」走哪条线 */
  line: GradeLine;
  onExit: () => void;
  onCleared: (id: number) => void;
  onNext: (id: number) => void;
}

export default function BattleScreen({ level, line, onExit, onCleared, onNext }: Props) {
  const [state, setState] = useState<BattleState>(() => createBattle(level));
  const [hintOpen, setHintOpen] = useState(false);

  useEffect(() => {
    if (state.phase !== 'resolving') return;
    const timer = window.setTimeout(() => setState((s) => advance(s)), 1600);
    return () => window.clearTimeout(timer);
  }, [state.phase, state.logSeq]);

  useEffect(() => {
    if (state.phase === 'win') onCleared(level.id);
  }, [state.phase, level.id, onCleared]);

  const restart = () => setState(createBattle(level));
  const nextLevel = nextLevelInLine(line, level);
  const gate = skillGate(state);
  const solutions = solutionReactions(level);
  const hpRatio = state.playerHp / state.playerMaxHp;
  const enemyRatio = state.enemyHp / state.enemyMaxHp;
  const bossPhase = bossPhaseOf(state);
  const phaseTotal = level.phases?.length ?? 0;
  const chain = chainView(state);
  const weaknessTags = enemyWeaknessOf(state);
  const resistTags = enemyResistOf(state);

  return (
    <div className="battle">
      <header className="topbar">
        <button className="btn-ghost small" onClick={onExit}>
          ← 关卡
        </button>
        <div className="topbar-title">
          <span className="lv-no">第 {String(level.order).padStart(2, '0')} 关</span>
          <span className="lv-name">{level.name}</span>
          <span className="lv-stage">
            {line}线 · {level.stage}
          </span>
        </div>
        <div className="topbar-right">
          {bossPhase && (
            <span className="phase-pill">
              阶段 {state.bossIndex + 1}/{phaseTotal} · {bossPhase.name}
            </span>
          )}
          {gate.required && (
            <span className={`gate-pill ${gate.satisfied ? 'ok' : 'todo'}`}>
              {gate.satisfied ? '✓ 收尾条件已达' : '收尾需：完美配平 ×1 或 强化 ×1'}
            </span>
          )}
          <span className="turn-pill">
            回合 {state.turn} / {state.maxTurns}
          </span>
          <button className="btn-ghost small" onClick={() => setHintOpen(true)}>
            💡 提示
          </button>
          <button className="btn-ghost small" onClick={restart}>
            重开
          </button>
        </div>
      </header>

      <div className="field">
        <aside className="side left">
          <div className="panel player-panel">
            <div className="panel-label">配方师</div>
            <div className="bar">
              <div className={`bar-fill ${hpRatio < 0.3 ? 'low' : ''}`} style={{ width: `${hpRatio * 100}%` }} />
              <span className="bar-text">
                {state.playerHp} / {state.playerMaxHp}
              </span>
            </div>
            <div className="chips">
              {state.shield > 0 && <span className="chip shield">🛡 护盾 {state.shield}</span>}
              {state.combo > 0 && <span className="chip combo">连锁 ×{state.combo}</span>}
            </div>
            <button
              className={`energy-btn ${state.boost ? 'on' : ''}`}
              disabled={state.energy <= 0 || state.phase !== 'select'}
              onClick={() => setState((s) => toggleBoost(s))}
            >
              <span className="energy-dot" />
              强化 ×1.25
              <span className="energy-count">能量 {state.energy}</span>
            </button>
          </div>

          <div className="panel log-panel">
            <div className="panel-label">实验记录</div>
            <div className="log">
              {state.log.slice(-7).map((entry) => (
                <div key={entry.id} className={`log-line ${entry.kind}`}>
                  {entry.text}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <main className="arena">
          <div className="arena-grid" />
          <div className={`enemy ${state.phase === 'resolving' ? 'hit' : ''}`}>
            <div className="enemy-art">{state.level.enemy.art}</div>
            <div className="enemy-name">
              {state.level.enemy.name}
              {bossPhase && <span className="enemy-phase-name"> · {bossPhase.name}</span>}
            </div>
            <div className="bar enemy-bar">
              <div className="bar-fill enemy-fill" style={{ width: `${enemyRatio * 100}%` }} />
              <span className="bar-text">
                {state.enemyHp} / {state.enemyMaxHp}
              </span>
            </div>
            <div className="enemy-tags">
              {weaknessTags.map((t) => (
                <span key={t} className="tag weak">
                  弱点 · {t} ×2
                </span>
              ))}
              {resistTags.map((t) => (
                <span key={t} className="tag resist">
                  抗性 · {t} ×0.5
                </span>
              ))}
              {state.enemyArmor > 0 && (
                <span className="tag armor">
                  护甲 {state.enemyArmor} · 减伤 {state.enemyArmor * 12}%
                </span>
              )}
            </div>
            {chain && (
              <div className="chain-panel">
                <div className="chain-head">
                  <span className="chain-title">
                    {chain.title} · 工序 {chain.done}/{chain.total}
                  </span>
                  <span className="chain-sub">
                    {chain.done >= chain.total
                      ? '✓ 工序完成'
                      : `下一步：${chain.nodes.find((n) => n.status === 'current')?.name ?? '—'}`}
                  </span>
                </div>
                <div className="chain-track">
                  {chain.nodes.map((node, index) => (
                    <span className="chain-item" key={`${node.id}-${index}`}>
                      {index > 0 && <span className="chain-arrow">→</span>}
                      <span className={`chain-node chain-node--${node.status}`}>
                        <span className="chain-formula">{formatFormula(node.id)}</span>
                        <span className="chain-name">{node.name}</span>
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
          {state.lastResult && state.phase === 'resolving' && (
            <div
              key={state.logSeq}
              className={`damage-float ${state.lastResult.weak ? 'weak' : ''}`}
            >
              -{state.lastResult.damage}
              {state.lastResult.weak && <span className="dmg-tag">弱点</span>}
              {state.lastResult.offChain && <span className="dmg-cut">偏离工序 · 伤害减半</span>}
            </div>
          )}
          {state.phaseSwitch && bossPhase && (
            <div className="phase-shift" role="status">
              <div className="phase-shift-kicker">阶段切换</div>
              <div className="phase-shift-title">
                第 {state.bossIndex + 1} / {phaseTotal} 阶段 · {bossPhase.name}
              </div>
              <div className="phase-shift-sub">回复 30 HP · 能量回满 · 护盾清零 · 工序重置</div>
            </div>
          )}
        </main>

        <aside className="side right">
          <div className="panel guide-panel">
            <div className="panel-label">战术提示</div>
            <p className="guide-text">{level.guide}</p>
          </div>
          <div className="panel book-panel">
            <div className="panel-label">教材出处</div>
            <p className="book-text">{level.textbook}</p>
          </div>
          <div className="panel deck-panel">
            <div className="deck-row">
              <span>牌堆 {state.deck.length}</span>
              <span>弃牌 {state.discard.length}</span>
            </div>
          </div>
        </aside>
      </div>

      <div className="handbar">
        <div className="hand">
          {state.hand.map((id, index) => {
            const sub = substance(id);
            const selected = state.selected.includes(index);
            return (
              <button
                key={`${id}-${index}`}
                className={`card k-${KIND_CLASS[sub.kind] ?? 'element'} ${selected ? 'sel' : ''}`}
                onClick={() => setState((s) => toggleCard(s, index))}
                disabled={state.phase !== 'select'}
              >
                <span className="card-formula">{formatFormula(sub.formula)}</span>
                <span className="card-name">{sub.name}</span>
                <span className="card-kind">{sub.kind}</span>
              </button>
            );
          })}
        </div>
        <div className="action-panel">
          <div className="action-hint">
            {state.selected.length === 0
              ? '选择参与反应的物质，判断它们能否反应'
              : state.selected.length === 1
                ? '可以再加一种，或直接出招（单质分解）'
                : `已选 ${state.selected.length} 种 · 能反应就命中，不能反应浪费一回合`}
          </div>
          <button
            className="btn-summon"
            disabled={state.selected.length === 0 || state.phase !== 'select'}
            onClick={() => setState((s) => submitSelection(s))}
          >
            出 招
          </button>
        </div>
      </div>

      {state.phase === 'balance' && state.pending && (
        <BalancePad
          reaction={state.pending}
          timeLimit={level.balanceTime}
          combo={state.combo}
          onConfirm={(coeffs, perfect) => setState((s) => confirmBalance(s, coeffs, perfect))}
          onSkip={() => setState((s) => skipBalance(s))}
        />
      )}

      {hintOpen && (
        <div className="overlay" onClick={() => setHintOpen(false)}>
          <div className="hint-card" onClick={(e) => e.stopPropagation()}>
            <div className="hint-head">
              <div>
                <div className="hint-title">通关提示 · {level.name}</div>
                <div className="hint-sub">
                  弱点：{level.enemy.weakness.join(' / ')}　|　{level.textbook}
                </div>
              </div>
              <button className="btn-ghost small" onClick={() => setHintOpen(false)}>
                关闭
              </button>
            </div>
            <div className="hint-list">
              {solutions.length === 0 && (
                <div className="hint-empty">这一关没有内置答案，先按弱点类型试组合。</div>
              )}
              {solutions.map(({ id, reaction }) => (
                <div className="hint-item" key={id}>
                  <div className="hint-eq">{formatEquation(reaction)}</div>
                  <div className="hint-meta">
                    {reaction.type} · {reaction.condition} · {reaction.phenomenon}
                  </div>
                </div>
              ))}
            </div>
            <div className="hint-foot">先自己试试；卡住再看。答案不唯一，命中弱点的组合都算。</div>
          </div>
        </div>
      )}

      {(state.phase === 'win' || state.phase === 'lose') && (
        <div className="overlay">
          <div className={`result ${state.phase === 'win' ? 'win' : 'lose'}`}>
            <div className="result-title">{state.phase === 'win' ? '实验成功' : '实验失败'}</div>
            <div className="result-sub">
              {state.phase === 'win'
                ? state.level.phases
                  ? `${state.level.enemy.name} 的三道形态全部瓦解。`
                  : `${state.level.enemy.name} 被你彻底分解。`
                : state.playerHp <= 0
                  ? '你被反噬了。调整一下试剂搭配再试。'
                  : '回合耗尽——试剂不够用了。'}
            </div>
            <div className="result-stats">
              <div>
                <span>造成伤害</span>
                <b>{state.stats.dealt}</b>
              </div>
              <div>
                <span>受到伤害</span>
                <b>{state.stats.taken}</b>
              </div>
              <div>
                <span>完美配平</span>
                <b>{state.stats.perfect}</b>
              </div>
              <div>
                <span>回合数</span>
                <b>{state.stats.turns}</b>
              </div>
            </div>
            <div className="result-actions">
              <button className="btn-ghost" onClick={restart}>
                再来一次
              </button>
              {state.phase === 'win' && nextLevel && (
                <button className="btn-primary" onClick={() => onNext(nextLevel.id)}>
                  下一关 · {nextLevel.name}
                </button>
              )}
              <button className="btn-ghost" onClick={onExit}>
                返回关卡
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
