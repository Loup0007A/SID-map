export function reliefColor(elevation: number): string {
  if (elevation < -60) return '#0a2540';
  if (elevation < -20) return '#144a6b';
  if (elevation < 0) return '#2c7a9c';
  if (elevation < 20) return '#8a9a5b';
  if (elevation < 50) return '#a67c52';
  if (elevation < 80) return '#8a6a4a';
  return '#e8e4d8';
}
