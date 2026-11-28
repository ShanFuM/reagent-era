import { useEffect, useRef, useState } from 'react';
import type { Reaction } from '../engine/data';
import { formatFormula } from '../engine/formula.js';

interface Props {
  reaction: Reaction;
  timeLimit: number;
  combo: number;
  onConfirm: (coefficients: number[], perfect: boolean) => void;
  onSkip: () => void;
}

export default function BalancePad({ reaction, timeLimit, combo, onConfirm, onSkip }: Props) {
  const total = reaction.reactants.length + reaction.products.length;
  const [coeffs, setCoeffs] = useState<number[]>(() => Array.from({ length: total }, () => 1));
  const totalTicks = Math.max(1, Math.round(timeLimit * 10));
  const [ticks, setTicks] = useState(totalTicks);
  const skipRef = useRef(onSkip);
  skipRef.current = onSkip;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTicks((t) => (t <= 1 ? 0 : t - 1));
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (ticks === 0) skipRef.current();
  }, [ticks]);

  const bump = (i: number, d: number) => {
    setCoeffs((prev) => {
      const next = prev.slice();
      next[i] = Math.max(1, Math.min(30, next[i] + d));
      return next;
    });
  };

  const perfect = ticks > totalTicks * 0.5;
  const ratio = ticks / totalTicks;

  return (
    <div className="overlay">
      <div className="pad">
        <div className="pad-head">
          <div>
            <div className="pad-title">配平</div>
            <div className="pad-sub">
              {reaction.type} · {reaction.condition} · 把系数调到最简整数比
            </div>
          </div>
          <div className={`pad-timer ${ratio < 0.35 ? 'urgent' : ''}`}>
            <div className="pad-timer-bar">
              <div style={{ width: `${ratio * 100}%` }} />
            </div>
            <span>{(ticks / 10).toFixed(1)}s</span>
          </div>
        </div>

        <div className="equation">
          {reaction.reactants.map(([id], i) => (
            <span className="eq-term" key={`l${id}`}>
              <span className="coef">
                <button onClick={() => bump(i, -1)} aria-label="减少">
                  −
                </button>
                <b>{coeffs[i]}</b>
                <button onClick={() => bump(i, 1)} aria-label="增加">
                  +
                </button>
              </span>
              <span className="eq-formula">{formatFormula(id)}</span>
              {i < reaction.reactants.length - 1 && <span className="eq-op">+</span>}
            </span>
          ))}
          <span className="eq-eq">=</span>
          {reaction.products.map(([id], i) => {
            const idx = reaction.reactants.length + i;
            return (
              <span className="eq-term" key={`r${id}`}>
                <span className="coef">
                  <button onClick={() => bump(idx, -1)} aria-label="减少">
                    −
                  </button>
                  <b>{coeffs[idx]}</b>
                  <button onClick={() => bump(idx, 1)} aria-label="增加">
                    +
                  </button>
                </span>
                <span className="eq-formula">{formatFormula(id)}</span>
                {i < reaction.products.length - 1 && <span className="eq-op">+</span>}
              </span>
            );
          })}
        </div>

        <div className="pad-note">
          <div className="pad-phenomenon">现象 · {reaction.phenomenon}</div>
          {reaction.trap && <div className="pad-trap">⚠ {reaction.trap}</div>}
          {combo > 0 && <span className="pad-combo">连击 ×{combo}</span>}
        </div>

        <div className="pad-actions">
          <button className="btn-ghost" onClick={onSkip}>
            跳过配平（伤害 ×1.0）
          </button>
          <button className="btn-primary" onClick={() => onConfirm(coeffs, perfect)}>
            {perfect ? '确认配平 · 完美' : '确认配平'}
          </button>
        </div>
      </div>
    </div>
  );
}
