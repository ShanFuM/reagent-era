import { GRADE_LINES, levelsOfLine } from '../engine/data';
import type { GradeLine, Level } from '../engine/data';

interface Props {
  cleared: number[];
  line: GradeLine;
  onLine: (line: GradeLine) => void;
  onPick: (id: number) => void;
  onBack: () => void;
}

const STAGE_CLASS: Record<string, string> = {
  初中: 'junior',
  高一: 'senior1',
  高二: 'senior2',
  高三: 'senior3',
};

/** 每条线的第 4/8 关，以及每线最后 4 关（9–12）是 Boss。 */
const isBossLevel = (lv: Level) => lv.order % 4 === 0 || lv.order >= 9;

export default function LevelSelect({ cleared, line, onLine, onPick, onBack }: Props) {
  const levels = levelsOfLine(line);
  const doneInLine = levels.filter((lv) => cleared.includes(lv.id)).length;

  return (
    <div className="select-screen">
      <header className="select-head">
        <button className="btn-ghost" onClick={onBack}>
          ← 返回
        </button>
        <div>
          <h2>元素裂谷 · 关卡</h2>
          <p>四条年级线各自从初中四关起步——这四关同时是新手教程。</p>
        </div>
        <div className="select-count">
          已通关 {doneInLine}/{levels.length}
        </div>
      </header>

      <nav className="line-tabs" role="tablist" aria-label="年级线">
        {GRADE_LINES.map((name) => {
          const list = levelsOfLine(name);
          const done = list.filter((lv) => cleared.includes(lv.id)).length;
          const active = name === line;
          return (
            <button
              key={name}
              role="tab"
              aria-selected={active}
              className={`line-tab ${active ? 'on' : ''}`}
              onClick={() => onLine(name)}
            >
              <span className="line-name">{name}线</span>
              <span className="line-meta">
                {done}/{list.length} 关
              </span>
            </button>
          );
        })}
      </nav>

      <div className="level-grid">
        {levels.map((lv) => {
          const done = cleared.includes(lv.id);
          return (
            <button
              key={lv.id}
              className={`level-card ${done ? 'done' : ''} ${isBossLevel(lv) ? 'boss' : ''}`}
              onClick={() => onPick(lv.id)}
            >
              <div className="level-top">
                <span className={`stage-badge ${STAGE_CLASS[lv.stage] ?? ''}`}>{lv.stage}</span>
                <span className="level-no">
                  {String(lv.order).padStart(2, '0')}
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
