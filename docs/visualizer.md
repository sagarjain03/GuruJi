# GuruJi — Algorithm Visualiser

> Package: `packages/algorithms` (logic) · `apps/web` (rendering)
> Last updated: 2026-09-18

---

## The core decision

**Algorithm execution is separated from rendering.** The algorithm does not draw
anything; it emits a stream of typed events. The UI replays that stream.

```
packages/algorithms                 apps/web
┌─────────────────────┐            ┌──────────────────────┐
│ bubbleSort(input)   │            │  <ArrayCanvas />     │
│   ↓                 │  events    │  <TreeCanvas />      │
│ AlgorithmStep[]     │ ─────────▶ │  <GraphCanvas />     │
└─────────────────────┘            │  playback controls   │
                                   └──────────────────────┘
```

### Why this seam exists

The obvious alternative — algorithms that call `setState` as they run — fails in
three specific ways:

1. **Step-back is impossible.** Reversing an animation means reversing the
   algorithm. With an event array, "previous" is `index - 1`.
2. **Every new algorithm means new React code.** With events, adding Dijkstra is
   a pure function plus zero UI work, because it emits the same `VISIT` and
   `UPDATE` events the graph canvas already renders.
3. **The algorithms are untestable.** A pure function returning an array is
   trivially unit-tested against an expected event sequence. A function that
   renders is not.

The cost is generating the full step array up front, which bounds input sizes.
That is an acceptable trade — a visualiser sorting 10,000 elements is not
teaching anyone anything anyway.

---

## The event model

```ts
type AlgorithmStep = {
  type: StepType
  indices?: number[]          // positions involved
  values?: unknown[]          // values involved
  nodeIds?: string[]          // for trees and graphs
  state: StructureSnapshot    // the structure after this step
  variables: Record<string, unknown>  // loop counters, pointers, accumulators
  description: string         // one plain sentence, shown to the user
  metrics: { comparisons: number; swaps: number; visits: number }
}
```

| `StepType` | Meaning |
|---|---|
| `COMPARE` | Two elements are being compared |
| `SWAP` | Two elements exchanged |
| `VISIT` | A node or index was reached |
| `INSERT` / `DELETE` | Structure changed |
| `UPDATE` | A value or DP cell changed |
| `PUSH` / `POP` | Stack or queue operation |
| `MARK` | Highlight without mutation (found, pivot, window bounds) |
| `DONE` | Terminal step |

`description` is authored per step by the algorithm, not derived by the UI. The
algorithm knows *why* it is comparing; the renderer does not, and a generic
"comparing index 3 and 4" teaches nothing.

`variables` is what turns animation into explanation. Watching bars move shows
*what*; watching `left`, `right` and `windowSum` change shows *why*.

---

## Controls

```
⏮ Previous   ▶ Play / ⏸ Pause   ⏭ Next   ↻ Reset   Speed ──●──
```

Because playback is array-index traversal, `Previous` is exact rather than
approximate — it does not re-run and re-approximate a prior state. Scrubbing to
an arbitrary step is equally exact.

Displayed alongside: the current step description, the live variable panel, the
running metrics, and the structure itself.

---

## Coverage, in build order

Ordered by renderer reuse, not by algorithmic interest — each group adds one
canvas and then several algorithms come nearly free.

| Group | Algorithms | Renderer |
|---|---|---|
| Sorting | Bubble, Selection, Insertion, Merge, Quick, Heap | Array canvas |
| Searching | Linear, Binary | Array canvas (reused) |
| Linked list | Insert, Delete, Reverse, Cycle detection | Node-chain canvas |
| Trees | BFS, DFS, In/Pre/Post-order, Level-order | Tree canvas |
| Graphs | BFS, DFS, Dijkstra, Topological sort, DSU | Graph canvas |
| DP | Fibonacci, 0/1 Knapsack, LCS, Coin Change | Table canvas |

DP is last because it needs a different visual metaphor — a filling table with
dependency arrows — rather than a reuse of anything above it.

---

## Rendering

SVG for structures with meaningful identity (trees, graphs, linked lists):
elements are real nodes, so they can be keyed, transitioned and made
accessible. Canvas for large arrays where hundreds of bars would mean hundreds
of DOM nodes.

Framer Motion animates position and colour transitions between steps. Playback
timing is driven by a single `requestAnimationFrame` loop, not per-element
timers — dozens of independent timers drift, and drift makes a sort look wrong.

### Accessibility

The visualiser must not be purely visual:

- Step descriptions render as text, and the current one is announced politely
  to screen readers
- Controls are keyboard-operable (space, arrows) with visible focus
- State is conveyed by shape and label as well as colour — a red/green-only
  comparison highlight is unreadable for a significant fraction of users
- `prefers-reduced-motion` disables transitions; stepping still works

---

## State

Visualiser state is pure UI state, so it lives in Zustand, not TanStack Query:
current step index, playing/paused, speed, input data, selected algorithm.

The generated step array is memoised against `(algorithm, input)`. Changing the
speed must not regenerate it.

---

## Adding an algorithm

The test of whether the seam works: adding one should touch no React.

1. Write a pure function in `packages/algorithms` returning `AlgorithmStep[]`
2. Register it with its metadata (name, category, complexity, default input)
3. Write a unit test asserting the emitted event sequence

If a new algorithm needs a *new structure* it needs a new canvas — that is
expected and rare. If it needs UI changes to render a structure that already
exists, the event model has a gap and the gap gets fixed rather than worked
around.

---

## Bounds

Input sizes are capped per category (arrays ~50 elements, graphs ~30 nodes) and
the generated step array is capped in length. An algorithm that produces
hundreds of thousands of steps will freeze the tab while it generates them —
and, again, is teaching nobody anything at that size. The cap returns a clear
message rather than an unresponsive page.
