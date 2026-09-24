import { computeDelta, DIFF_SIZE } from '../canvas/diff';
import { NO_EDITOR_EDITS, type EditorReading } from '../scoring/markerCoverage';
import type { MarkerId } from '../data/markers';
import type { Rect } from '../canvas/overlays';

/** Where each marker sits on the plate being watched -- from markerRects(suspect). */
export type WatchedRegions = readonly { id: MarkerId; rect: Rect }[];

/**
 * The slice of the SDK's editor instance the watch reads. `ImageEditorInstance`
 * satisfies it as-is; tests hand in a fake -- the two adapters at this seam.
 */
export interface WatchedEditor {
  hasChanges(): boolean;
  getImage(): string | null;
}

/** hasChanges() alone is cheap and synchronous, no image decode, so the loop runs at this cadence. */
export const WATCH_INTERVAL_MS = 500;
/** The getImage()+decode+diff step is heavier, so it only runs on every Nth tick -- roughly every 1500ms. */
export const DELTA_POLL_TICKS = 3;

/** Decodes a data URL to a DIFF_SIZE x DIFF_SIZE ImageData -- decode and downsample happen together via one scaled drawImage, cheap enough to run on every poll tick. */
export function decodeToDeltaBitmap(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = DIFF_SIZE;
      canvas.height = DIFF_SIZE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('2D context unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, DIFF_SIZE, DIFF_SIZE);
      resolve(ctx.getImageData(0, 0, DIFF_SIZE, DIFF_SIZE));
    };
    img.onerror = () => reject(new Error('Failed to decode image for forensic diff'));
    img.src = dataUrl;
  });
}

export interface EditorWatch {
  /**
   * A new plate is now what the editor shows: re-baseline the diff, and read
   * a zero reading straight away. `regions` are the marker rects on that
   * plate -- they change with the suspect, so they arrive with the plate
   * rather than being fixed when the watch is created.
   */
  reset(image: string, regions: WatchedRegions): void;
  /**
   * One poll tick. Always reports hasChanges(); every DELTA_POLL_TICKS-th
   * tick -- and only if the editor has edits and the previous decode has
   * finished, so slow decodes skip rather than queue -- also reports the
   * forensic reading of the editor's own crop/text/draw/sticker tools, the
   * only window into what the player did with them.
   */
  tick(editor: WatchedEditor | undefined): void;
}

/** One decoded candidate, measured over the whole plate and again over each marker. */
function read(baseline: ImageData, candidate: ImageData, regions: WatchedRegions): EditorReading {
  const regionDeltas: Partial<Record<MarkerId, number>> = {};
  for (const { id, rect } of regions) {
    regionDeltas[id] = computeDelta(baseline, candidate, rect);
  }
  return { frame: computeDelta(baseline, candidate), regions: regionDeltas };
}

/**
 * Timer- and React-free so the loop's rules are testable with a fake editor;
 * EditorPanel just calls tick() from an interval and reset() when `image`
 * changes. `decode` is a parameter for the same reason.
 */
export function createEditorWatch({
  decode = decodeToDeltaBitmap,
  onHasChanges,
  onDelta,
}: {
  decode?: (dataUrl: string) => Promise<ImageData>;
  onHasChanges: (changed: boolean) => void;
  onDelta: (reading: EditorReading) => void;
}): EditorWatch {
  let ticks = 0;
  let reference: ImageData | null = null;
  let regions: WatchedRegions = [];
  let busy = false;
  // Bumped on every reset, so a decode still in flight for the previous
  // plate can't land a reading against the new baseline.
  let generation = 0;

  return {
    reset(image, nextRegions) {
      const mine = ++generation;
      reference = null;
      regions = nextRegions;
      onDelta(NO_EDITOR_EDITS);
      decode(image)
        .then((bitmap) => {
          if (mine === generation) reference = bitmap;
        })
        .catch(() => {});
    },

    tick(editor) {
      const changed = editor?.hasChanges() ?? false;
      onHasChanges(changed);

      ticks += 1;
      if (ticks % DELTA_POLL_TICKS !== 0 || busy || !changed) return;
      const baseline = reference;
      const dataUrl = editor?.getImage();
      if (!baseline || !dataUrl) return;

      busy = true;
      const mine = generation;
      const measured = regions;
      decode(dataUrl)
        .then((candidate) => {
          if (mine === generation) onDelta(read(baseline, candidate, measured));
        })
        .catch(() => {})
        .finally(() => {
          busy = false;
        });
    },
  };
}
