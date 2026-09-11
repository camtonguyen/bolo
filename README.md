# BOLO

BOLO is a police terminal for the Leonida State Police, Wanted Division.
You're an operator working the queue: pull a suspect's record, drop their
intake photo into a full-panel React Image Editor, grade the scan, stamp the
plate, and push the bulletin out to the field.

It plays like paperwork. It doesn't stay that way.

![BOLO demo](public/Bolo-Demo.gif)

## The loop

1. **Queue → Record.** Pick a case. A canvas compositor builds the bulletin
   plate (letterhead, seal, ruled fields, the portrait dropped into its
   window) before the editor ever sees it. Choose a plate treatment (raw,
   archival, degraded) and drag tamper-evidence overlays into place.
2. **Edit.** The composed plate is handed to `@unlayer/react-image-editor` at
   full width (Filter, Crop, Draw, Text, Shapes, Stickers), then **Issue
   bulletin**.
3. **Verdict.** Recognition and tamper bars fill, then a dispatch response
   reads back. Every issued bulletin lands on the wanted board.

No image analysis runs anywhere. The same plain, serializable object the
compositor renders from (plate treatment, overlays, bounty line) is exactly
what the verdict is scored from.

## The act-two turn

Close three cases and a new record enters the queue, carrying your own
operator ID. Nothing explains what that means. You're not filing this one.
You're the file.

Drop recognition below 40% without pushing tamper above 60% and you walk. A
reviewing officer notices when you lean on the same trick twice. Reuse gets
more expensive every time. Get flagged once and the terminal doesn't reset;
every attempt after runs under heavier scrutiny. Four endings, all determined
by state the game already tracks, none of them a scoreboard.

## Why a terminal

Wide and dense, so the editor gets a full working panel instead of being
squeezed into a phone-shaped frame. Editing an official document also
justifies a serious editing UI far better than filtering a selfie would.

## A note on the cast

Every suspect, including the operator record seeded in for act two, is
fictional, and every portrait is an original illustration, never a
photograph. There is no upload flow and no way to put a real person's face
into the queue.

## Running locally

```bash
npm install
npm run dev
```

Requires Node 20+.

```bash
npm run typecheck  # tsc --noEmit
npm run lint        # eslint .
npm run test        # hand-rolled assertions, no framework — see any *.test.ts
npm run build       # type-checks, then produces the production bundle
```

## Licensing

All artwork (the illustrated cast and the overlay/stamp SVGs) is original
work created for this project. Self-hosted type is SIL OFL 1.1. The code is
MIT licensed.

## Non-affiliation

Leonida, Port Verona, and the Leonida State Police are fictional. BOLO is not
affiliated with, endorsed by, or built using assets from Rockstar Games,
Take-Two Interactive, or any real law enforcement agency.
