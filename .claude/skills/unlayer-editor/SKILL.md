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
        enabled: true,
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
| `getImage()` | Returns `string \| null` **synchronously** -- a data URL, not a promise or a blob. Polled for the live forensic diff (see `src/canvas/diff.ts`, `createEditorWatch` in `src/composer/editorWatch.ts`, ticked by `EditorPanel`) and for the wanted board thumbnail |
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

## Surviving screen navigation without remounting

`EditorPanel` (and the `<ImageEditor>` inside it) is mounted exactly once for
the whole app session, by `EditorSessionProvider` in `TerminalShell` --
*above* the screen router, not inside `ComposerStage`. Screens that come and
go (`CaseQueue`, `RecordView`, `ComposerStage`) never own the editor's
lifecycle:

- `ComposerStage` calls `useComposeSession({ suspect, config, locale })` (see
  `src/composer/EditorSession.tsx`), which composites the plate, publishes it
  with the config it was rendered from, and claims a DOM slot for the
  editor's own markup to render into.
- The provider portals `<EditorPanel>`'s output into that slot, or into a
  permanently-mounted offscreen fallback div when no screen currently claims
  one -- so the SDK's container node is never removed from the document.
- A new case publishing a new `image` is just another `image` prop change on
  the one long-lived instance, which the SDK picks up via its own internal
  reset (see above) -- not a remount.

Don't reach for this pattern for anything that doesn't need to survive a
screen change. It exists solely because this editor's mount/decode cost and
in-progress edits are worth preserving across navigation.

## Does not exist — hard stop

Custom stickers · custom fonts · `options.colors` · custom filter presets ·
programmatic layer insertion · aspect-ratio locking from config ·
`imageUrl` prop · `editor.exportImage()` · `data.rectImage` · themes beyond
`'light' | 'dark'` · **`features.imageEditor.dock`**.

`dock` is real, but it is not the image editor's. It lives at
`appearance.panels.tools.dock` and docks the *email* editor's tool panel;
`features.imageEditor` carries only `enabled` and `tools`
(`@unlayer/types/dist/editor/features.d.ts`, line 84). An earlier version of
this page had it in the mount example. There is no way to move the image
editor's own toolbar from config.

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

## Translations

`UnlayerTranslations` is `Partial<Record<UnlayerLocale, Partial<Record<UnlayerTranslationKey, string>>>>`,
so translations are keyed by locale first, then by string key. The SDK ships
its own strings for every built-in locale -- what belongs here is **only the
strings this app overrides**, and each override needs an entry per locale it
should appear in. A `translations` block holding `en` alone means every other
locale silently falls back to the SDK's stock wording for those keys.

Image-editor keys are namespaced `image_editor.*`; the toolbar ones are
`save`, `cancel`, `apply`, `undo`, `redo`, `zoom_in`, `zoom_out`,
`fit_to_screen`, `show_chat`, `hide_chat`. Autocomplete works on them --
`UnlayerTranslationKey` is a union, widened with `(string & {})`, so a typo
type-checks and silently does nothing. Check the union in
`@unlayer/types/dist/editor/intl.d.ts` rather than trusting the compiler.

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
