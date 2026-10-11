// Export PNG de la carte (SVG -> canvas).
// Une image externe n'est pas dessinée quand un SVG est converti en
// bitmap : on remplace donc chaque icône importée par son contenu.
async function inlineImages(root: SVGSVGElement) {
  await Promise.all(
    Array.from(root.querySelectorAll('image')).map(async (el) => {
      const href = el.getAttribute('href') ?? el.getAttribute('xlink:href');
      if (!href || href.startsWith('data:')) return;
      try {
        const blob = await (await fetch(href)).blob();
        const data = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(String(r.result));
          r.onerror = rej;
          r.readAsDataURL(blob);
        });
        el.setAttribute('href', data);
      } catch {
        el.remove(); // icône injoignable : on exporte le reste
      }
    })
  );
}

export async function exportMapPng(svg: SVGSVGElement | null, filename: string): Promise<boolean> {
  if (!svg) return false;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  await inlineImages(clone);
  return new Promise((resolve) => {
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
