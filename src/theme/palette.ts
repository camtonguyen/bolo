/** Terminal art direction. Canvas reads these too — single source of truth. */
export const palette = {
  phosphor: '#4AF6A0',
  phosphorDim: '#1E6B47',
  amber: '#FFB627',
  alert: '#FF3B3B',
  paper: '#E8E2D0',
  ink: '#14120E',
  terminalBg: '#060A08',
  panel: '#0C1310',
} as const;

export type PaletteToken = keyof typeof palette;

/** Bulletin faces. Self-hosted as woff2 in public/fonts/, wired via @font-face in index.css. Pricedown is banned — it clones the GTA logotype. */
export const fonts = {
  terminal: '"IBM Plex Mono", ui-monospace, monospace',
  bulletin: '"Oswald", sans-serif',
  stamp: '"Courier Prime", monospace',
  ui: 'Montserrat, system-ui, sans-serif',
} as const;

const FONT_SPECS = [
  '400 16px "IBM Plex Mono"',
  '700 16px "IBM Plex Mono"',
  '400 16px "Oswald"',
  '700 16px "Oswald"',
  '400 16px "Courier Prime"',
  '700 16px "Courier Prime"',
  '400 16px "Montserrat"',
  '700 16px "Montserrat"',
] as const;

let fontsReady = false;
let loading: Promise<void> | null = null;

/**
 * Force-fetches every self-hosted weight before resolving. `document.fonts.ready`
 * alone isn't enough to gate a canvas draw on: it only waits on fonts already
 * in flight, and a font nothing has rendered yet is never put in flight — so
 * a canvas draw can race ahead of a font that was never actually requested,
 * silently falling back, invisibly, until someone inspects an exported plate
 * closely. Memoized: repeated calls (one per composite()) don't re-issue the
 * fetches.
 */
export function ensureFontsLoaded(): Promise<void> {
  if (!('fonts' in document)) {
    fontsReady = true;
    return Promise.resolve();
  }
  loading ??= Promise.all(FONT_SPECS.map((spec) => document.fonts.load(spec))).then(() => {
    fontsReady = true;
  });
  return loading;
}

/**
 * Dev-only tripwire for the exact bug ensureFontsLoaded() exists to prevent:
 * a canvas text draw that runs before fonts actually resolved renders a
 * silent fallback. Call at the top of any function that sets ctx.font and
 * fills text. A no-op in production — this is a development guard, not
 * user-facing error handling.
 */
export function assertFontsReady(): void {
  if (import.meta.env.DEV && !fontsReady) {
    throw new Error('Canvas text drawn before ensureFontsLoaded() resolved — text would silently render a fallback font.');
  }
}
