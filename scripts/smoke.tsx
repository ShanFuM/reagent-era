/**
 * 界面渲染冒烟测试：把每个界面在服务端渲染一遍，
 * 只要有组件在渲染期抛错（空引用、坏数据、hooks 误用）就会在这里炸出来。
 */
import { renderToString } from 'react-dom/server';
import TitleScreen from '../src/ui/TitleScreen';
import LevelSelect from '../src/ui/LevelSelect';
import BattleScreen from '../src/ui/BattleScreen';
import { LEVELS } from '../src/engine/data';

const noop = () => undefined;

let html = renderToString(<TitleScreen onStart={noop} />);
console.log(`标题界面  OK  ${html.length} 字符`);
html = renderToString(<LevelSelect cleared={[1, 2]} onPick={noop} onBack={noop} />);
console.log(`关卡选择  OK  ${html.length} 字符`);

for (const level of LEVELS) {
  html = renderToString(
    <BattleScreen level={level} onExit={noop} onCleared={noop} onNext={noop} />,
  );
  if (!html.includes(level.name)) {
    console.error(`✗ 第 ${level.id} 关渲染结果里找不到敌人名`);
    process.exit(1);
  }
  console.log(`第 ${String(level.id).padStart(2)} 关   OK  ${html.length} 字符`);
}

console.log('\n✓ 全部界面渲染通过');
