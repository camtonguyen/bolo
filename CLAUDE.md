# BOLO — Instructions for Claude Code

## What this is

An in-world police terminal built around `@unlayer/react-image-editor`. You're
an operator in the Leonida State Police Wanted Division. Pull a suspect
record. Compose the wanted bulletin. Issue it. The editor is the composition
surface, mounted at full panel width.

**The turn:** after three closed cases, a record enters the queue carrying
this terminal's own operator ID. Same editor. Now you're using it to doctor
your own bulletin. Drop recognition below 40% without pushing tamper above
60% and you walk. Reuse a technique and it costs more every time (Reyes). Get
flagged once and every attempt after runs under heavier scrutiny (Act III).

## Stack

React 19 + TypeScript, Vite, Tailwind v4, zustand,
`@unlayer/react-image-editor` (MIT). Deploy: Vercel.

## SDK ground truth: read before touching the editor

If it isn't listed here or in `.claude/skills/unlayer-editor/SKILL.md`, it
does not exist. Don't invent API.

**Does NOT exist:** custom stickers · custom fonts · `options.colors` ·
custom filter presets · programmatic layer insertion · aspect-ratio locking ·
crop-state readback · zoom/pan introspection · `imageUrl` prop ·
`editor.exportImage()` · `data.rectImage`.

**Remount trap:** only `theme`, `locale`, `translations` update in place. Any
other `options` key change destroys the editor and takes unsaved edits with
it. Memoize `options`.

**Therefore:** all art direction (plate, seal, overlays, fonts) happens on our
own `<canvas>` before the data URL reaches `image`.

## The scoring rule

`src/scoring/recognition.ts` reads the same serializable `CompositeConfig`
the compositor produces. No image analysis, no separate machinery. A new
visual control must land in `CompositeConfig` or the game can't see it.

## Git rules (non-negotiable)

- **Never** add `Co-Authored-By: Claude` or any agent trailer to a commit or PR.
- Never commit to `main`. Branch, commit, PR.
- Conventional commits, imperative mood.

## Legal and safety boundaries

- All art is original. **Pricedown is banned**: it clones the GTA logotype.
- Never ship the strings "Grand Theft Auto", "Rockstar", or "Vice City".
  State: **Leonida**. City: **Port Verona**. Force: **Leonida State Police**.
- **The player edits fictional suspects only.** No arbitrary photo uploads of
  real people. A "make a wanted poster of anyone" tool is harassment-shaped.
- Portraits are original illustrations, not photographs of real people.

## Never do

- Don't add a visual control that bypasses `CompositeConfig`.
- Don't push to `main`.
