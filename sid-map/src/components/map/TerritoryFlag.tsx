'use client';
import { SvgIcon } from "@/components/icons/SidIcon";

export default function TerritoryFlag({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x}, ${y})`} pointerEvents="none">
      <rect
        x={-label.length * 0.62 - 1}
        y={-1.6}
        width={label.length * 1.24 + 4}
        height={3.2}
        rx={0.6}
        fill="#000000a0"
      />
      <SvgIcon name="flag" x={-label.length * 0.62 + 1} size={2.2} />
      <text x={-label.length * 0.62 + 2.6} textAnchor="start" dy="0.5" fontSize="1.5" fill="#f4f2ec">
        {label}
      </text>
    </g>
  );
}
