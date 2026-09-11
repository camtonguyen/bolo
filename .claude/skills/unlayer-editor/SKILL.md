---
name: unlayer-editor
description: Use whenever mounting, configuring, wiring, or debugging the @unlayer/react-image-editor component — including the composer editor panel, the issue pipeline, locale switching, tool configuration, or any bug where the editor fails to load an image. Also use before writing any code that touches editor options or instance methods, to avoid inventing API that does not exist.
---

# Unlayer React Image Editor — verified integration

Verified against docs.unlayer.com and the repo README on 2026-09-05.
**If an API is not on this page, it does not exist. Do not invent it.**

## The correct mount

```tsx
import { useRef } from 'react';
import ImageEditor from '@unlayer/react-image-editor';

const ref = useRef<{ editor: ImageEditorInstance | null }>(null);

<ImageEditor
  ref={ref}
  image={compositedDataUrl}        // NOT `imageUrl`
  minHeight={560}
  options={{
    theme: 'dark',
    locale,
    translations: {
      en: { 'image_editor.toolbar.save': 'Post to feed' },
    },
    features: {
      imageEditor: {
        dock: 'left',
        tools: {
          resize: false,
          frame: false,
          crop: { icon: '<svg viewBox="0 0 24 24">…</svg>' },
        },
      },
    },
  }}
  onSave={({ dataUrl, blob }) => publishToFeed(dataUrl, blob)}
  onCancel={() => terminal.goQueue()}
  onLoadError={() => toast('Photo failed to load — check CORS')}
  onError={(err) => reportEditorFailure(err)}
/>
```

## Instance methods

Reached through `ref.current?.editor` — `null` until mounted.

| Method | Use in this project |
| --- | --- |
| `getImage()` | Returns `string \| null` **synchronously** -- a data URL, not a promise or a blob. Polled for the live forensic diff (see `src/canvas/diff.ts`, `EditorPanel`'s poll effect) and for the wanted board thumbnail |
| `hasChanges()` | Cheap, synchronous. Guards every poll loop and every exit path (abandon, transmit) |
| `reset(url?)` | Load the next photo without a remount. `void \| Promise<void>` |
| `updateOptions(p)` | Theme + locale only |
| `destroy()` | Component handles this on unmount |

## Confirmed from the compiled component (`dist/index.mjs`), not just the `.d.ts`

- Changing the `image` prop does **not** require calling `reset()` yourself --
  the component diffs `image` against what it last applied and calls
  `editor.reset(newImage)` internally. So a plate recomposite while the
  editor is open (a rail edit -- bounty line, overlay toggle -- while
  `ComposerStage` and `EditorPanel` are both mounted) silently resets the
  live editor and discards any in-progress crop/text/sticker edit. Anything
  that reads the editor's live state (the forensic-diff poll) must re-derive
  its baseline whenever `image` changes, not just once on mount.
- The remount key is *literally* `JSON.stringify(options minus {theme,
  locale, translations})` compared across renders in a `useEffect` dependency
  array -- confirming the SKILL's existing memoization warning is not
  approximate, it's exact. Any other key, even an equivalent object with a
  new identity, remounts.
- `editorId` only sets the mounted `<div id>` -- purely cosmetic, safe to
  reuse or omit for a single instance. Multiple simultaneous instances still
  need distinct `editorId`s to avoid two editors fighting over one DOM id,
  even though the SDK itself doesn't key off of it.

## Does not exist — hard stop

Custom stickers · custom fonts · `options.colors` · custom filter presets ·
programmatic layer insertion · aspect-ratio locking from config ·
`imageUrl` prop · `editor.exportImage()` · `data.rectImage` · themes beyond
`'light' | 'dark'`.

If a task seems to need one of these, composite it ourselves on our own
`<canvas>` before handing the data URL to the editor.

## The remount trap

Only `theme`, `locale`, `translations` apply via `updateOptions()`. **Any other
`options` key change destroys and recreates the editor**, discarding unsaved
edits. So:

- Compute `features.imageEditor.tools` once, before first mount.
- Never derive `options` inline in JSX — memoize it, or a parent re-render
  produces a new object identity and nukes the user's work.

```tsx
const options = useMemo(() => ({ /* ... */ }), [locale]); // theme/locale only
```

## Loading and CORS

`image` accepts a URL or a base64 data URL. We always pass a **data URL** from
our own canvas, which sidesteps CORS entirely. If `onLoadError` ever fires, the
compositor emitted a malformed data URL — check there first, not in the editor.

## AI Assistant

Requires a `projectId` from an Unlayer account with the paid feature enabled.
`defaultPrompt` pre-fills the chat; `autoSubmitPrompt` fires it automatically.
**Out of scope unless access is confirmed** — do not build a dependency on it.

## Checklist before opening a PR that touches the editor

- [ ] No invented API from the "does not exist" list
- [ ] `options` is memoized
- [ ] `hasChanges()` guards every exit path
- [ ] `onLoadError` and `onError` both handled
- [ ] Editor still mounts after a locale switch
- [ ] Editor container was not narrowed — it gets the full remaining width
