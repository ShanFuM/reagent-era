import { LEVELS } from '../engine/data';

interface Props {
  cleared: number[];
  onPick: (id: number) => void;
  onBack: () => void;
}

const STAGE_CLASS: Record<string, string> = {
  初中: 'junior',
  高一: 'senior1',
  高三: 'senior3',
};

export default function LevelSelect({ cleared, onPick, onBack }: Props) {
  return (
    <div className="select-screen">
      <header className="select-head">
        <button className="btn-ghost" onClick={onBack}>
          ← 返回
        </button>
        <div>
          <h2>元素裂谷 · 关卡</h2>
          <p>按学段从初三推进到高三，一关一个教材小节。</p>
        </div>
        <div className="select-count">
          已通关 {cleared.length}/{LEVELS.length}
        </div>
      </header>

      <div className="level-grid">
        {LEVELS.map((lv) => {
          const done = cleared.includes(lv.id);
          const isBoss = lv.id === 4 || lv.id === 8 || lv.id >= 9;
          return (
            <button
              key={lv.id}
              className={`level-card ${done ? 'done' : ''} ${isBoss ? 'boss' : ''}`}
              onClick={() => onPick(lv.id)}
            >
              <div className="level-top">
                <span className={`stage-badge ${STAGE_CLASS[lv.stage] ?? ''}`}>{lv.stage}</span>
                <span className="level-no">
                  {String(lv.id).padStart(2, '0')}
                  {done ? ' ✓' : ''}
                </span>
              </div>
              <div className="level-art">{lv.enemy.art}</div>
              <div className="level-name">{lv.name}</div>
              <div className="level-book">{lv.textbook}</div>
              <div className="level-meta">
                <span>{lv.enemy.hp} HP</span>
                <span className="weak-tag">弱点 {lv.enemy.weakness.join('/')}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
