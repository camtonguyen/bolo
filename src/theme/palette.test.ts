// Run with: npm run test
// ensureFontsLoaded() itself needs `document.fonts`, which this plain-Node
// runner doesn't have -- but assertFontsReady()'s throw path is pure module
// state and import.meta.env, so it's the one piece worth checking here.
import { assertFontsReady } from './palette';

let threw = false;
try {
  assertFontsReady();
} catch {
  threw = true;
}
if (!threw) {
  throw new Error('assertFontsReady: expected it to throw before ensureFontsLoaded() ever resolves');
}

console.log('palette.test.ts: ok');
