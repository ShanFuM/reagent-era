import { useCallback, useEffect, useState } from 'react';
import Stage from './ui/Stage';
import TitleScreen from './ui/TitleScreen';
import LevelSelect from './ui/LevelSelect';
import BattleScreen from './ui/BattleScreen';
import { LEVELS } from './engine/data';
import type { GradeLine } from './engine/data';

const STORE_KEY = 'reagent-era.progress.v1';
const LINE_KEY = 'reagent-era.line.v1';

function loadCleared(): number[] {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((n): n is number => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

type Screen = 'title' | 'select' | 'battle';

/** 关卡属于多条线时，深链默认落在高三线；不属于高三线就用它自己的第一条线。 */
function lineOfLevelId(id: number): GradeLine {
  const lv = LEVELS.find((l) => l.id === id);
  if (!lv) return '高三';
  return lv.lines.includes('高三') ? '高三' : lv.lines[0];
}

function loadLine(): GradeLine | null {
  try {
    const raw = window.localStorage.getItem(LINE_KEY);
    return raw && raw.length > 0 ? (raw as GradeLine) : null;
  } catch {
    return null;
  }
}

/** 深链：#/levels 直接进关卡选择，#/battle/7 直接进第 7 关（演示、截图、评委复查都用得上） */
function parseHash(): { screen: Screen; levelId: number } {
  try {
    const hash = window.location.hash.replace(/^#\/?/, '');
    if (hash.startsWith('battle/')) {
      const id = Number(hash.slice('battle/'.length));
      if (LEVELS.some((l) => l.id === id)) return { screen: 'battle', levelId: id };
    }
    if (hash === 'levels') return { screen: 'select', levelId: 1 };
  } catch {
    /* 无 hash 或环境不支持时走默认 */
  }
  return { screen: 'title', levelId: 1 };
}

export default function App() {
  const initial = parseHash();
  const [screen, setScreen] = useState<Screen>(initial.screen);
  const [levelId, setLevelId] = useState(initial.levelId);
  const [cleared, setCleared] = useState<number[]>(loadCleared);
  const [line, setLine] = useState<GradeLine>(
    () => (initial.screen === 'battle' ? lineOfLevelId(initial.levelId) : loadLine() ?? '高三'),
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(cleared));
    } catch {
      /* 离线单文件版本可能禁用存储，忽略即可 */
    }
  }, [cleared]);

  useEffect(() => {
    try {
      window.localStorage.setItem(LINE_KEY, line);
    } catch {
      /* 同上 */
    }
  }, [line]);

  const markCleared = useCallback((id: number) => {
    setCleared((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }, []);

  const startLevel = useCallback((id: number) => {
    setLevelId(id);
    setScreen('battle');
  }, []);

  const level = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];

  return (
    <Stage>
      {screen === 'title' && <TitleScreen onStart={() => setScreen('select')} />}

      {screen === 'select' && (
        <LevelSelect
          cleared={cleared}
          line={line}
          onLine={setLine}
          onPick={startLevel}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'battle' && (
        <BattleScreen
          key={level.id}
          level={level}
          line={line}
          onExit={() => setScreen('select')}
          onCleared={markCleared}
          onNext={startLevel}
        />
      )}
    </Stage>
  );
}
