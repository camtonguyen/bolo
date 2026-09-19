// Run with: npm run test
import { createEditorWatch, DELTA_POLL_TICKS, type WatchedEditor } from './editorWatch';
import { assertEqual } from '../test/assert';

/** A 1x1 grey pixel -- computeDelta of grey(0) vs grey(51) is 51/255 = 0.2, grey(0) vs grey(255) is 1. */
const grey = (v: number) => ({ width: 1, height: 1, data: new Uint8ClampedArray([v, v, v, 255]) }) as ImageData;
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Stands in for the SDK's editor instance -- the second adapter at the seam. */
function fakeEditor(state: { changed: boolean; image: string | null }): WatchedEditor {
  return { hasChanges: () => state.changed, getImage: () => state.image };
}

/** Decodes "grey:N" urls to a grey(N) bitmap and records every url it was asked to decode. */
function harness(decode: (url: string) => Promise<ImageData> = (url) => Promise.resolve(grey(Number(url.split(':')[1])))) {
  const decoded: string[] = [];
  const changes: boolean[] = [];
  const deltas: number[] = [];
  const watch = createEditorWatch({
    decode: (url) => {
      decoded.push(url);
      return decode(url);
    },
    onHasChanges: (c) => changes.push(c),
    onDelta: (d) => deltas.push(d),
  });
  const ticks = async (editor: WatchedEditor | undefined, n: number) => {
    for (let i = 0; i < n; i++) watch.tick(editor);
    await flush();
  };
  return { watch, decoded, changes, deltas, ticks };
}

// A new plate baselines the diff: delta reads 0 straight away, and nothing is measured until the editor reports edits.
{
  const h = harness();
  h.watch.reset('grey:0');
  await flush();
  assertEqual(h.deltas, [0], 'reset reports a zero delta');
  const editor = fakeEditor({ changed: false, image: 'grey:255' });
  await h.ticks(editor, DELTA_POLL_TICKS * 2);
  assertEqual(h.decoded, ['grey:0'], 'an untouched editor is never decoded, however long it is polled');
  assertEqual(h.changes.every((c) => c === false) && h.changes.length === DELTA_POLL_TICKS * 2, true, 'hasChanges is reported on every tick');
}

// hasChanges() reports every tick; the heavier getImage + decode + diff only every DELTA_POLL_TICKS-th.
{
  const h = harness();
  h.watch.reset('grey:0');
  await flush();
  const editor = fakeEditor({ changed: true, image: 'grey:51' });
  await h.ticks(editor, DELTA_POLL_TICKS - 1);
  assertEqual(h.deltas, [0], 'no diff before the Nth tick');
  assertEqual(h.changes, [true, true], 'but hasChanges already reads true');
  await h.ticks(editor, 1);
  assertEqual(h.deltas, [0, 0.2], 'the Nth tick measures the editor image against the baseline');
}

// A decode still in flight makes later measuring ticks skip rather than queue up.
{
  let release: (b: ImageData) => void = () => {};
  const slow = new Promise<ImageData>((resolve) => (release = resolve));
  const h = harness((url) => (url === 'grey:51' ? slow : Promise.resolve(grey(0))));
  h.watch.reset('grey:0');
  await flush();
  const editor = fakeEditor({ changed: true, image: 'grey:51' });
  await h.ticks(editor, DELTA_POLL_TICKS * 2);
  assertEqual(h.decoded.filter((u) => u === 'grey:51').length, 1, 'a second measuring tick skips while the first decode is pending');
  release(grey(51));
  await flush();
  assertEqual(h.deltas.at(-1), 0.2, 'the pending decode still lands');
  await h.ticks(editor, DELTA_POLL_TICKS);
  assertEqual(h.decoded.filter((u) => u === 'grey:51').length, 2, 'measuring resumes once the decode has finished');
}

// A new plate mid-measurement: the stale reading must not land against the new baseline.
{
  let release: (b: ImageData) => void = () => {};
  const slow = new Promise<ImageData>((resolve) => (release = resolve));
  const h = harness((url) => (url === 'grey:255' ? slow : Promise.resolve(grey(0))));
  h.watch.reset('grey:0');
  await flush();
  await h.ticks(fakeEditor({ changed: true, image: 'grey:255' }), DELTA_POLL_TICKS);
  h.watch.reset('grey:0');
  release(grey(255));
  await flush();
  assertEqual(h.deltas, [0, 0], 'only the two resets reported; the in-flight reading against the old plate was dropped');
}

// No editor mounted yet, or nothing to read back: quiet, never a throw.
{
  const h = harness();
  h.watch.reset('grey:0');
  await flush();
  await h.ticks(undefined, DELTA_POLL_TICKS);
  await h.ticks(fakeEditor({ changed: true, image: null }), DELTA_POLL_TICKS);
  assertEqual(h.decoded, ['grey:0'], 'nothing decoded without an editor image');
  assertEqual(h.changes.slice(0, DELTA_POLL_TICKS), [false, false, false], 'a missing editor reads as no changes');
}

console.log('editorWatch.test.ts: ok');
