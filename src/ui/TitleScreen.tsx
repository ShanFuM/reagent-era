import { PlayerSprite } from './Sprite';

export default function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="title-screen">
      <div className="title-glow" />
      <div className="title-hero">
        <PlayerSprite />
      </div>
      <div className="title-inner">
        <div className="title-kicker">2026 波克 AI 游戏创作大赛 · 寓教于游</div>
        <h1 className="title-main">试剂纪元</h1>
        <div className="title-en">R E A G E N T &nbsp; E R A</div>
        <div className="title-formulas">
          <span>Zn + 2HCl → ZnCl₂ + H₂↑</span>
          <span>2KMnO₄ + 16HCl → 2KCl + 2MnCl₂ + 5Cl₂↑ + 8H₂O</span>
          <span>Al(OH)₃ + NaOH → Na[Al(OH)₄]</span>
        </div>
        <p className="title-desc">
          你是裂谷里最后一个配方师。
          <br />
          手上的试剂只有两种用对，才会发生反应。
        </p>
        <button className="btn-primary big" onClick={onStart}>
          开始实验
        </button>
        <div className="title-foot">横屏游玩 · 28 关 · 四条年级线</div>
        <div className="title-team">化出界限　·　邹梓轩 / 张峻搏</div>
      </div>
    </div>
  );
}
