'use client';

import { useToast } from '@/components/ui/Toast';

export default function ExportMapButton({
  svgRef,
  filename
}: {
  svgRef: React.RefObject<SVGSVGElement>;
  filename: string;
}) {
  const { showToast } = useToast();

  function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    // Les info-bulles HTML (foreignObject) ne se rasterisent pas de
    // façon fiable d'un navigateur à l'autre : on les retire de l'export.
    clone.querySelectorAll('foreignObject').forEach((el) => el.remove());
    clone.setAttribute('width', '1600');
    clone.setAttribute('height', '1600');

    const svgString = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, 1600, 1600);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${filename}.png`;
        link.click();
        showToast('Image exportée.');
      }, 'image/png');
    };
    img.onerror = () => {
      showToast("Export impossible depuis ce navigateur.", 'error');
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  return (
    <button
      onClick={exportPng}
      className="glass flex items-center gap-1.5 rounded-full px-3 py-1.5 font-display text-[10px] uppercase tracking-wide text-paper/70 hover:text-accent"
    >
      🖼 Exporter
    </button>
  );
}
