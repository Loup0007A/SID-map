export type ShapeTool = 'polygon' | 'circle' | 'ellipse' | 'square' | 'rectangle' | 'trapezoid' | 'freehand';

export const SHAPE_TOOLS: { value: ShapeTool; label: string; icon: string }[] = [
  { value: 'polygon', label: 'Polygone', icon: '⬡' },
  { value: 'circle', label: 'Cercle', icon: '○' },
  { value: 'ellipse', label: 'Ellipse', icon: '⬭' },
  { value: 'square', label: 'Carré', icon: '□' },
  { value: 'rectangle', label: 'Rectangle', icon: '▭' },
  { value: 'trapezoid', label: 'Trapèze', icon: '⏢' },
  { value: 'freehand', label: 'Tracé libre', icon: '✎' }
];

// Formes qui se dessinent par clic-glisse (boîte englobante) plutôt
// que clic par clic.
export const DRAG_SHAPES: ShapeTool[] = ['circle', 'ellipse', 'square', 'rectangle', 'trapezoid', 'freehand'];
