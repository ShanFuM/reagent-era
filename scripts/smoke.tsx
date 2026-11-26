/**
 * 界面渲染冒烟测试：把每个界面在服务端渲染一遍，
 * 只要有组件在渲染期抛错（空引用、坏数据、hooks 误用）就会在这里炸出来。
 */
import { renderToString } from 'react-dom/server';
import TitleScreen from '../src/ui/TitleScreen';
import LevelSelect from '../src/ui/LevelSelect';
import BattleScreen from '../src/ui/BattleScreen';
import { GRADE_LINES, LEVELS, levelsOfLine, nextLevelInLine } from '../src/engine/data';

const noop = () => undefined;

let html = renderToString(<TitleScreen onStart={noop} />);
console.log(`标题界面  OK  ${html.length} 字符`);

// 年级线：每条线都要渲染出它自己的关卡，且不能混进别的线
for (const line of GRADE_LINES) {
  const page = renderToString(
    <LevelSelect cleared={[1, 2]} line={line} onLine={noop} onPick={noop} onBack={noop} />,
  );
  const expected = levelsOfLine(line);
  for (const lv of expected) {
    if (!page.includes(lv.name)) {
      console.error(`✗ ${line}线 渲染结果里找不到「${lv.name}」`);
      process.exit(1);
    }
  }
  const others = LEVELS.filter((lv) => !lv.lines.includes(line));
  for (const lv of others) {
    if (page.includes(lv.name)) {
      console.error(`✗ ${line}线 里混进了不属于该线的「${lv.name}」`);
      process.exit(1);
    }
  }
  console.log(`${line}线关卡选择  OK  ${expected.length} 关  ${page.length} 字符`);
}

// 「下一关」必须沿当前线走：order 连续，不会跳到别的线
for (const line of GRADE_LINES) {
  const list = levelsOfLine(line);
  let cur = list[0];
  let steps = 1;
  while (steps <= 100) {
    const next = nextLevelInLine(line, cur);
    if (!next) break;
    if (next.order !== cur.order + 1) {
      console.error(`✗ ${line}线：第 ${cur.order} 关之后接到了第 ${next.order} 关`);
      process.exit(1);
    }
    cur = next;
    steps += 1;
  }
  if (steps !== list.length) {
    console.error(`✗ ${line}线：「下一关」链只走了 ${steps} 关，实际有 ${list.length} 关`);
    process.exit(1);
  }
  console.log(`${line}线下一关链  OK  ${list[0].order} → ${list[list.length - 1].order}`);
}

for (const level of LEVELS) {
  const line = level.lines.includes('高三') ? '高三' : level.lines[0];
  html = renderToString(
    <BattleScreen level={level} line={line} onExit={noop} onCleared={noop} onNext={noop} />,
  );
  if (!html.includes(level.name)) {
    console.error(`✗ 第 ${level.id} 关渲染结果里找不到敌人名`);
    process.exit(1);
  }
  console.log(`第 ${String(level.id).padStart(2)} 关   OK  ${html.length} 字符`);
}

console.log('\n✓ 全部界面渲染通过');
