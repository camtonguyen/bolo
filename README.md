# BOLO

Built for Unlayer's Build with React Image Editor Challenge: an original GTA
VI-inspired experience.

BOLO is a police terminal for the Leonida State Police, Wanted Division. You
work the queue: pull a suspect's record, drop the intake photo into a
full-panel React Image Editor, grade the scan, stamp the plate, push the
bulletin out to the field.

It plays like paperwork. It doesn't stay that way.

Live demo: https://bolo-psi.vercel.app

![BOLO demo](public/Bolo-Demo.gif)

## The loop

1. **Queue → Record.** Pick a case. A canvas compositor builds the bulletin
   plate (letterhead, seal, ruled fields, the portrait dropped into its
   window) before the editor ever sees it. Choose a plate treatment (raw,
   archival, degraded) and drag the tamper-evidence overlays into place.
2. **Edit.** The composed plate goes to `@unlayer/react-image-editor` at full
   width: Filter, Crop, Draw, Text, Shapes, Stickers. A live ALTERATION
   readout tracks what those tools actually do to the plate. Hit **Issue
   bulletin** in the editor itself, or **TRANSMIT BULLETIN** in the terminal
   chrome once there's something to send.
3. **Verdict.** Recognition and tamper bars fill. A dispatch response reads
   back. Every issued bulletin lands on the wanted board.

The rail's own controls (plate treatment, overlays, bounty line, substituted
portrait) score from one plain, serializable object -- no image analysis
needed there. The SDK editor's own tools (crop, text, stickers) are invisible
to that object, though, so there's no way to know what they did except by
looking: a live poll of the editor's own render, diffed against the original
plate. That's the only pixel comparison anywhere in the game, and it exists
because the SDK gives no other way to see inside its own tools.

## Game logic

```mermaid
flowchart TD
    Queue[Case Queue] --> Record[Suspect Record]
    Record --> Compose[Compose Bulletin]
    Compose --> Rail
    Compose --> SDKTools

    subgraph inEditor [Compose screen]
        Rail["Rail controls: plate treatment, overlays,<br/>bounty line, substituted portrait"] --> Config[CompositeConfig]
        SDKTools["SDK editor's own tools:<br/>crop / text / stickers"] --> Poll["getImage() poll, gated on hasChanges()"]
        Poll --> Delta["computeDelta() vs. the original plate"]
    end

    Config --> Issue{"Issue bulletin<br/>(SDK save button or TRANSMIT control)"}
    Delta --> Issue
    Issue --> Evaluate["evaluate(config, suspect, suspicion, act, liveDelta)"]
    Evaluate --> Verdict["Verdict: match / tamper / outcome"]
    Verdict --> Resolve[resolveIssue]

    Resolve --> Board[("Bulletin filed --<br/>viewable anytime on the BOARD tab")]
    Resolve --> Suspicion[("suspicion += techniques used<br/>(reuse costs more tamper next time)")]
    Resolve -.->|"operator case only"| Heat["heat += heatDelta"] -.-> Ending
    Resolve --> Ending{"Ending applies?<br/>(operator case derives one from verdict + heat;<br/>once any ending is set, it's sticky for every case after)"}

    Ending -->|"identified / burned / clean / complicit"| EndScreen["Ending / Epilogue screen<br/>(run over)"] --> Queue
    Ending -->|"still null"| VerdictScreen[Verdict screen] --> Queue

    ThreeCases["3 cases closed"] -.-> Turn["Operator's own record<br/>enters the queue"] -.-> Record
    Act["Act I -> II -> III<br/>(revealed + operatorFlagged)"] -.->|"tamperScrutiny multiplier"| Evaluate
```

## The act-two turn

Close three cases. A new record enters the queue, carrying your own operator
ID. Nobody explains what that means. You're not filing this one. You're the
file.

Drop recognition below 40% without pushing tamper above 60%, and you walk.
Lean on the same trick twice and a reviewing officer notices: reuse gets more
expensive every time. Get flagged once and the terminal doesn't forget. Every
attempt after that runs under heavier scrutiny. Four endings, all decided by
state the game already tracks. None of them is a scoreboard.

## Why a terminal

A terminal is wide and dense, which is exactly what the editor wants: a full
working panel, not a phone-shaped box. Editing an official document also
earns a serious editing UI in a way that filtering a selfie never will.

## A note on the cast

Every suspect is fictional, including the operator record seeded in for act
two. Every portrait is an original illustration, never a photograph. There's
no upload flow and no way to put a real person's face into the queue.

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

All the art here is original: the illustrated cast, the overlay and stamp
SVGs, all of it. Self-hosted type is SIL OFL 1.1. The code is MIT licensed.

## Non-affiliation

Leonida, Port Verona, and the Leonida State Police are fictional. BOLO is not
affiliated with, endorsed by, or built using assets from Rockstar Games,
Take-Two Interactive, or any real law enforcement agency.
