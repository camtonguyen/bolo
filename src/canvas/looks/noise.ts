/**
 * Deterministic hash noise -- a pure function of position, no RNG state. A
 * grade seeded from Math.random() would make the same CompositeConfig render
 * differently each time, which breaks the "reproducible from config alone"
 * rule the scoring engine and board both depend on.
 */
export function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Bilinear-interpolated hash noise -- smooth, low-frequency blotches at the
 * scale of `cell` pixels, instead of per-pixel salt-and-pepper grain.
 */
export function smoothNoise(x: number, y: number, cell: number): number {
  const gx = x / cell;
  const gy = y / cell;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const sx = gx - x0;
  const sy = gy - y0;
  const n00 = hash(x0, y0);
  const n10 = hash(x0 + 1, y0);
  const n01 = hash(x0, y0 + 1);
  const n11 = hash(x0 + 1, y0 + 1);
  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;
  return nx0 + (nx1 - nx0) * sy;
}
