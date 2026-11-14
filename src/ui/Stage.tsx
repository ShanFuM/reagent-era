import { useEffect, useRef, useState } from 'react';

const BASE_W = 1600;
const BASE_H = 900;

/**
 * 固定 1600×900 画布，等比缩放到容器。
 *
 * 尺寸取自「容器自身」而不是 window：预览面板 / iframe / 浏览器缩放
 * 都会让 window.innerWidth 和真正能看见的区域不一致，按 window 算会整体偏出屏幕。
 * 这里同时取 visualViewport 与元素尺寸的最小值，保证画布一定落在可视区域内。
 */
export default function Stage({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const measure = () => {
      const vv = window.visualViewport;
      // getBoundingClientRect 返回的是「变换之后」的真实可见尺寸，
      // 比 clientWidth 可靠：预览面板 / iframe / 浏览器缩放都会反映在这里。
      const rect = el.getBoundingClientRect();
      const widths = [rect.width, vv?.width ?? Infinity, window.innerWidth].filter(
        (n) => Number.isFinite(n) && n > 0,
      );
      const heights = [rect.height, vv?.height ?? Infinity, window.innerHeight].filter(
        (n) => Number.isFinite(n) && n > 0,
      );
      const w = Math.min(...widths);
      const h = Math.min(...heights);
      setScale(Math.min(w / BASE_W, h / BASE_H));
      setPortrait(h > w * 1.1 && w < 820);
    };

    measure();
    const raf = window.requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('scroll', measure);

    return () => {
      window.cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('scroll', measure);
    };
  }, []);

  return (
    <div className="stage-outer" ref={outerRef}>
      {portrait && (
        <div className="rotate-hint">
          <div className="rotate-icon">⟳</div>
          <div>请把手机横过来</div>
          <div className="rotate-sub">试剂纪元 需要横屏才能展开战场</div>
        </div>
      )}
      <div className="stage" style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}
