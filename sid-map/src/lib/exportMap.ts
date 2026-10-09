// Export PNG de la carte (SVG -> canvas).
export function exportMapPng(svg: SVGSVGElement | null, filename: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!svg) return resolve(false);
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.querySelectorAll('foreignObject').forEach((el) => el.remove());
    clone.setAttribute('width', '1600');
    clone.setAttribute('height', '1600');
    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' })
    );
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(false);
      ctx.drawImage(img, 0, 0, 1600, 1600);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) return resolve(false);
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${filename}.png`;
        a.click();
        resolve(true);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(false);
    };
    img.src = url;
  });
}
