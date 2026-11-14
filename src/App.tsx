import { useCallback, useEffect, useState } from 'react';
import Stage from './ui/Stage';
import TitleScreen from './ui/TitleScreen';
import LevelSelect from './ui/LevelSelect';
import BattleScreen from './ui/BattleScreen';
import { LEVELS } from './engine/data';

const STORE_KEY = 'reagent-era.progress.v1';

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

  useEffect(() => {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(cleared));
    } catch {
      /* 离线单文件版本可能禁用存储，忽略即可 */
    }
  }, [cleared]);

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
          onPick={startLevel}
          onBack={() => setScreen('title')}
        />
      )}

      {screen === 'battle' && (
        <BattleScreen
          key={level.id}
          level={level}
          onExit={() => setScreen('select')}
          onCleared={markCleared}
          onNext={startLevel}
        />
      )}
    </Stage>
  );
}
