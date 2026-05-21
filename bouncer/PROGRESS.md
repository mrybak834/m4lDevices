# Bouncer — Build Progress

A Max for Live audio effect that emits visual particles from a source, bounces them off hand-drawn walls, and turns each wall hit into a delayed audio tap (escalating to per-wall effects and granular playback).

Plan reference: `PLAN.md.txt`. Device file: `bouncer.amxd`. Canvas script: `bouncer.js`.

---

## Workflow note

The patcher is reloaded from disk only when the device is freshly opened. If you have `bouncer.amxd` open in Max while I rewrite it, **close the device in Max (do *not* save from Max — that would clobber my edits), then re-open it** to pick up patcher changes. The `bouncer.js` file is `autowatch`ed by `v8ui`, so script-only edits hot-reload without re-opening the device.

`_patcher.json` and `_build_amxd.ps1` are the build sources for the `.amxd`. The `.amxd` is a Max-specific container with a 32-byte binary header (`ampf…ptch<len>`) followed by the patcher JSON; the build script wraps the JSON with that header.

## Verification steps (do these next)

1. In Live, close the current `bouncer` device (do **not** Save from Max).
2. Drag the device back onto a track (it's now the rewritten patcher).
3. Open the device editor in Max (the wrench icon).
4. Open Max's console (`Window → Max Console`).
5. **Milestone 1 check:** turn on `Draw` (toggle in Live's UI or the patcher). Click-drag inside the canvas to draw a wall. Turn `Draw` off. Particles should emit from the red source dot and reflect off the wall. Click on the source dot to drag it. Click a wall to select (turns orange); the `Delete` button removes it.
6. **Milestone 2 check:** in the Max console, watch for `HIT: <pid> <wallId> <delayMs> <x> <y> <nx> <ny> <bounce>` lines on every wall hit. Lower the `Speed` dial → delay numbers grow. `PARTICLE: <pid> <hitCount>` prints once per particle emission.
7. **Geometry persistence:** draw a wall, then close + reopen the device. The wall should come back. (If it doesn't, see *Known risks* below.)

## Known issues (deferred — not blocking next milestone)

- **Expand toggle only partially grows the canvas.** `live.thisdevice setwidth` works (device gets wider), but the `script sendbox v8ui presentation_rect …` message doesn't size the canvas to fill the new device width. Tried both `x y w h` and `x1 y1 x2 y2` forms — neither has the canvas reach the right edge of the expanded device. Next time we touch this: probe with a `[print]` on the message string to confirm the message reaches thispatcher, and try alternative forms (`script size`, `script position`, or setting `rect` instead of `presentation_rect`).
- **Canvas in presentation mode is a clipped viewport into a larger v8ui.** v8ui renders to its `patching_rect` dimensions (520×380), but Live's presentation view only shows the `presentation_rect` (currently 426×148). The mouse can drag the source past the visible edge into the "off-screen" portion of the underlying canvas, and you can't drag it back from inside Live's view. Fix is to make the patching_rect match the presentation_rect (or use mgraphics in a way that's clipped to the visible region).
- **Two-file copy drift.** Live's project system copies the device into the set's project folder on first use; my edits to `User Library\…` don't reach Live until the Projects-folder copy is updated. Currently mitigated by deleting the Projects-folder copy so Live falls back to User Library. May recur on save.
- **Pop-out resizable window.** Phase 2 feature. Needs sub-patcher with mirror v8ui + state sync.

## Gotchas hit so far (worth remembering)

- **`.amxd` binary header** is `ampf` + version + `aaaa` + `meta` + meta-len + 4 zero pad bytes + `ptch` + JSON length (little-endian uint32) + JSON. **Total 32 bytes.** I burned a round trying 36 bytes — Max silently failed to load the patcher.
- **`v8ui` cannot take its filename as a typed argument.** Unlike `v8`, the box must be `"maxclass": "v8ui"` with a `"filename"` attribute. `"maxclass": "newobj"` + `"text": "v8ui bouncer.js"` produces a v8ui object with **no script attached** — no parse errors, no `post()` output, just silent "no function X" errors when messages arrive.
- **The `.amxd`'s folder is not on Max's search path by default.** Currently we work around this with an absolute path in the v8ui `filename`. Before sharing the device we either need to (a) save `bouncer.js` inside the device's Max project folder and **Freeze** the device (which embeds the script into the `.amxd`), or (b) tell the user to add the folder to File Preferences. See [forum thread](https://cycling74.com/forums/ensure-js-files-are-in-search-path).
- **`autowatch = 1` only arms after the script successfully runs once.** If the first load fails, edits to `bouncer.js` are ignored — you must close and reopen the device.
- **No `with` statement in v8ui scripts.** v8 runs strict-mode-ish; `with` is a parse-time error and kills the whole script (no functions hoisted). Use explicit `mgraphics.foo()` calls.

## Known risks / things to check first

- **Geometry round-trip via `pattr`.** The script ships the wall layout as `set <json-as-symbol>` to a `pattr geometry` and reads it back via `prepend restore`. JSON has commas but `outlet()` passes the full string as a single Max symbol, so it *should* survive — but if reload comes back empty or garbled, switch the encoding in `bouncer.js` (`dumpGeometry` / `restore`) to base64 or to a flat list of numbers.
- **`v8ui` mouse handler signatures.** I'm using `onclick(x, y, button, …)` and `ondrag(x, y, button, …)` with the convention that `button === 0` during `ondrag` means mouse-released. If drag-to-draw never finalizes a wall, the release detection is off — log the args inside `ondrag` and adjust `finishDraw()` triggering.
- **`box.rect` in presentation.** Offscreen kill and exit-ray length use `box.rect`. If particles vanish unexpectedly when the device is shown in Live but not in the editor, `box.rect` is reporting the patching rect; we'd track width/height via a `size` message from the patcher instead.

---

## Milestones

### Milestone 1 — Visual toy (no audio)
- [x] `v8ui` canvas with custom paint loop — **confirmed loading + painting in Max console**
- [x] Source point (drag to reposition)
- [x] Hand-drawn walls (draw mode toggle)
- [x] Particle emission at configurable rate — **confirmed emitting**
- [x] Ray/segment collision + reflection
- [x] Precomputed bounce paths (audio-thread-friendly)
- [x] Particles die offscreen or after N bounces
- [x] Wall selection + delete
- [x] Wall layout persistence (via `pattr`/`dict`)
- [ ] **User verification:** draw a wall, watch particles bounce, slow Speed → see delay numbers grow

### Milestone 2 — Collision messages
- [x] Each wall has a stable id
- [x] Each particle has a stable id
- [x] `hit <particle_id> <wall_id> <delay_ms> <x> <y> <bounce>` emitted from canvas — **expected to fire once walls exist**
- [ ] **User verification:** `HIT …` lines in console after drawing a wall

### Milestone 3 — Basic delay wall
- [ ] `tapin~ 5000` recent-audio buffer
- [ ] `poly~ hitVoice` with 16 voices
- [ ] Per-hit envelope, gain, pan
- [ ] Dry/wet mix + output limiter
- [ ] **User verification in Max:** closer wall → shorter echo; farther → longer

### Milestone 4 — Per-wall effect slots
- [ ] Fixed effect buses (clean tap, filtered, echo, reverb, distortion, pitch)
- [ ] Wall → bus assignment via `live.menu`
- [ ] Wall parameter inspector (gain, reflection loss, scatter…)

### Milestone 5 — Audio-reactive emission
- [ ] Amplitude → particle energy
- [ ] Transient → particle burst
- [ ] Stereo balance → launch spread

### Milestone 6 — Granular particle audio
- [ ] Circular input buffer
- [ ] Per-particle emission buffer position
- [ ] `poly~` grain voice reads remembered slice on hit
- [ ] Pitch / reverse / freeze per wall

---

## Architectural decisions

- **`v8ui` over `jsui`** — Max 9 modern JS engine; cleaner mouse/MGraphics API.
- **Precomputed bounce itineraries** — JS runs in low-priority thread, so the canvas computes the full ray path at emission time and ships a list of scheduled `hit` events to the audio engine. Visuals just animate along the same path.
- **Fixed voice cap (16) before going granular** — protects Live from overload while we iterate.
- **Wall geometry stored as a blob (`pattr` dict)**, not as Live-automatable parameters — geometry has variable shape, so it's preset/preset-recall data only.
- **Stereo only** — M4L audio I/O is stereo; everything mixes back to L/R inside the device.

---

## Current Live UI controls

| Control          | Object         | Range / values            | Routes to                          |
|------------------|----------------|---------------------------|------------------------------------|
| Dry/Wet          | `live.dial`    | 0–100 %                   | output crossfade                   |
| Particle Rate    | `live.dial`    | 10–1000 ms                | v8ui `rate_ms`                     |
| Projection Speed | `live.dial`    | 50–1000 px/s              | v8ui `speed_px_s`                  |
| Max Bounces      | `live.dial`    | 1–32                      | v8ui `max_bounces`                 |
| Hit Gain         | `live.dial`    | -60 to +6 dB              | hit voice gain                     |
| Draw Mode        | `live.toggle`  | 0 / 1                     | v8ui `drawmode`                    |
| Clear Walls      | `live.text`    | button                    | v8ui `clear_walls`                 |
| Delete Selected  | `live.text`    | button                    | v8ui `delete_selected`             |

(Hit Gain wired in M3. Dry/Wet currently controls bypass crossfade only — gets wet path in M3.)
