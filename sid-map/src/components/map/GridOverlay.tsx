'use client';

import type { ViewBox } from '@/lib/hooks/useSvgViewport';

export default function GridOverlay({ viewBox, step = 5 }: { viewBox: ViewBox; step?: number }) {
  const startX = Math.floor(viewBox.x / step) * step;
  const endX = viewBox.x + viewBox.w;
  const startY = Math.floor(viewBox.y / step) * step;
  const endY = viewBox.y + viewBox.h;

  const vLines: number[] = [];
  for (let x = startX; x <= endX; x += step) vLines.push(x);
  const hLines: number[] = [];
  for (let y = startY; y <= endY; y += step) hLines.push(y);

  const strokeWidth = Math.max(0.04, viewBox.w * 0.0015);

  return (
    <g pointerEvents="none">
      {vLines.map((x) => (
        <line key={`v${x}`} x1={x} y1={viewBox.y - 20} x2={x} y2={viewBox.y + viewBox.h + 20} stroke="#b3261e" strokeOpacity={0.18} strokeWidth={strokeWidth} />
      ))}
      {hLines.map((y) => (
        <line key={`h${y}`} x1={viewBox.x - 20} y1={y} x2={viewBox.x + viewBox.w + 20} y2={y} stroke="#b3261e" strokeOpacity={0.18} strokeWidth={strokeWidth} />
      ))}
    </g>
  );
}
