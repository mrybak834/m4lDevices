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
8. **M3a audio check:** on the audio track that hosts bouncer, play any sound (a loop, a synth feeding it, anything). Open the device, find the **Dry/Wet** parameter in the device's parameter dropdown (it isn't in presentation yet) and bring it up to ~50%. Draw a wall. Every particle/wall hit should produce a delayed tap of whatever was playing `delay_ms` ago, panned by the hit's x position, slightly dimmer on each successive bounce. The Max console should show no "no function" or "poly~: can't open" errors. If you see `poly~: can't open hitvoice.maxpat`, the absolute path in `_patcher.json` doesn't exist on your machine — edit the `poly~` text in the patcher.
9. **M3c MIDI-out check:** create a second MIDI track in Live; set its `MIDI From` to the track that hosts bouncer and pick `Bouncer` as the source; drop a synth on it; arm/monitor. In bouncer, set the `Walls` tab to `MIDI`. Hit play and draw a wall. The downstream synth should fire a note on every wall hit. With `SOURCE = MIDI` the pitch follows the upstream note; with `SOURCE = Random` it sticks at pitch 60. Adjust `NoteDuration` (in the parameter dropdown) to change how long each note sustains. The Max console should be quiet.
10. **M3d mod-output check (Map button is untested — expect to debug):** set the `Walls` tab to `Mod`. Click **bouncer's own `Map` button** (bottom row of the device, next to the 8 Mod meters — it turns orange when armed), then click the parameter you want to drive (e.g. a synth's filter-cutoff knob). bouncer captures it and the Map button should pop back off. Draw a wall and hit play: on every wall hit the target should jump up and decay back over ~300 ms (`Wall Mod 1` meter shows the same pulse). Multiple bounces = multiple pulses. Watch the Max console for Live API errors (`live.observer` / `live.remote~`). Only `Wall Mod 1` is wired to walls + the Map slot for now (per-wall dials/targets are M4); `Wall Mod 2`–`8` are visible meters that stay at 0. NOTE: while mapped, the target is pinned to its minimum at rest — pick a target where that's musical (cutoff, resonance, send amount), and reload the device to unmap.

## Known issues (deferred — not blocking next milestone)

- **Overlapping same-pitch notes share one note-off (M3b).** If two MIDI notes of the same pitch are held simultaneously and one is released, *all* live particles emitted from that pitch flip to unfilled. MIDI doesn't disambiguate overlapping notes of the same pitch, and we don't yet track per-note instance counts. Fine for typical keyboard playing; can be refined later with a per-pitch note-on counter or FIFO matching.

- **Expand toggle only partially grows the canvas.** `live.thisdevice setwidth` works (device gets wider), but the `script sendbox v8ui presentation_rect …` message doesn't size the canvas to fill the new device width. Tried both `x y w h` and `x1 y1 x2 y2` forms — neither has the canvas reach the right edge of the expanded device. Next time we touch this: probe with a `[print]` on the message string to confirm the message reaches thispatcher, and try alternative forms (`script size`, `script position`, or setting `rect` instead of `presentation_rect`).
- **Canvas in presentation mode is a clipped viewport into a larger v8ui.** v8ui renders to its `patching_rect` dimensions (520×380), but Live's presentation view only shows the `presentation_rect` (currently 426×148). The mouse can drag the source past the visible edge into the "off-screen" portion of the underlying canvas, and you can't drag it back from inside Live's view. Fix is to make the patching_rect match the presentation_rect (or use mgraphics in a way that's clipped to the visible region).
- **Two-file copy drift.** Live's project system copies the device into the set's project folder on first use; my edits to `User Library\…` don't reach Live until the Projects-folder copy is updated. Currently mitigated by deleting the Projects-folder copy so Live falls back to User Library. May recur on save.
- **Pop-out resizable window.** Phase 2 feature. Needs sub-patcher with mirror v8ui + state sync.

## Gotchas hit so far (worth remembering)

- **Live forces every device to exactly 169 px tall — width is free, height is not.** Anything in the presentation below ~168 px is silently clipped in Live's device view (it does not scroll or grow). Symptom: the M3d mod row of dials was cut off at the bottom in Live even though it showed fine in the Max editor (where `openrect` can be any height). Fix: lay the whole UI out within 169 px — shortened the v8ui canvas to 104 px tall and tucked the 8 mod dials + Map button into the strip beneath it (and the expand canvas message height to match). If you need more controls, go *wider*, not taller. Confirmed via Cycling '74 / Ableton M4L UI docs.

- **`.amxd` binary header** is `ampf` + version + `aaaa` + `meta` + meta-len + 4 zero pad bytes + `ptch` + JSON length (little-endian uint32) + JSON. **Total 32 bytes.** I burned a round trying 36 bytes — Max silently failed to load the patcher.
- **`v8ui` cannot take its filename as a typed argument.** Unlike `v8`, the box must be `"maxclass": "v8ui"` with a `"filename"` attribute. `"maxclass": "newobj"` + `"text": "v8ui bouncer.js"` produces a v8ui object with **no script attached** — no parse errors, no `post()` output, just silent "no function X" errors when messages arrive.
- **The `.amxd`'s folder is not on Max's search path by default.** Currently we work around this with an absolute path in the v8ui `filename`. Before sharing the device we either need to (a) save `bouncer.js` inside the device's Max project folder and **Freeze** the device (which embeds the script into the `.amxd`), or (b) tell the user to add the folder to File Preferences. See [forum thread](https://cycling74.com/forums/ensure-js-files-are-in-search-path).
- **`autowatch = 1` only arms after the script successfully runs once.** If the first load fails, edits to `bouncer.js` are ignored — you must close and reopen the device.
- **No `with` statement in v8ui scripts.** v8 runs strict-mode-ish; `with` is a parse-time error and kills the whole script (no functions hoisted). Use explicit `mgraphics.foo()` calls.
- **`tapin~` must live inside the `poly~` voice, not outside.** `tapin~ → tapout~` is linked by a direct signal cord and the buffer reference is stripped when the signal is routed through `poly~`'s signal inlets to a voice's `in~`. Symptom: `poly~` loads with no errors, `hit` messages reach the voice, the voice fires its envelope, but `tapout~` reads silence and the wet path is dead. Burned ~one debugging cycle on this in M3a. Each voice now owns its own `tapin~ 5000` (16 × ~700 KB ≈ 11 MB total — fine).
- **`tapout~ 0` has ONE inlet, not two.** The delay value goes to the **same** inlet that receives the `tapin~` signal — both a signal cord and message cords coexist on inlet 0. A patchcord targeting inlet 1 is silently deleted (`tapout~: patchcord inlet out of range`) and every voice ends up reading at delay = 0 (live-audio echo, no actual delay tap). Symptom that's easy to miss: Speed and wall-distance changes don't affect perceived tap timing, but the device still "makes sound" so it looks like it works. Fixed in hitvoice.maxpat.
- **`receive` has 0 inlets in Max — its name can't be changed via `set`.** Tried building auto-pair as dynamic `r bouncer_midi_<trackId>` driven by a `set` message from a `live.observer`; Max rejected the patchcord with `receive: patchcord inlet out of range`. Switched to a self-filtering pattern instead: fixed-name `s/r bouncer_midi`, message payload is `[pitch vel myTrackId]`, the receiver compares msgTrackId against its own `live.observer`-resolved track id via `==` + `gate`. Zero-latency on same track per Cycling '74's official guarantee.
- **A `@parameter_enable 1` `pattr` is a *numeric* Live parameter — it cannot hold a symbol/blob.** The geometry pattr was `pattr geometry @parameter_enable 1`; every `dumpGeometry()` (wall draw, Clear, Delete, Walls Audio/MIDI tab) ships `set <encoded-json-symbol>` into it, and the parameter layer tries to coerce the symbol to a number → `set: bad number` spam in the Max console (the store also silently fails). Changing Source didn't trigger it because `source_mode` doesn't dump geometry. Fixed by demoting it to a plain `pattr geometry` (blob store) and removing it from the `parameters` manifest — matches the design intent (geometry is preset-recall blob data, *not* a Live-automatable parameter). Caveat: a plain pattr persists via the patcher's saved value (one shared default across instances + requires a Max save), **not** per-instance with the Live set. True per-instance blob persistence (pattrstorage or a blob-typed param) is still open — fold into M4.
- **`pipe`'s left inlet distributes a list across all inlets, including the rightmost delay.** This lets the M3c note-off chain collapse to: `pack pitch 0 ch durMs → pipe 0 0 0 0`, where the 4-element list distributes 3 values + delay. Pipe's outlets fire right-to-left at the scheduled time, so connect them to noteout's 3 inlets directly (no re-pack needed). The trick is that `unpack 0 0 0`'s outlets also fire right-to-left, which means by the time `pitch` (outlet 0, hot) lands on both `noteout` inlet 0 (fires note-on) and `pack4` inlet 0 (fires the scheduled-off list), `vel` and `ch` are already in place on both downstream boxes. No `trigger` needed; the ordering falls out naturally.
  - **The arg count bites: `pipe`'s LAST argument is the delay time, so N args = (N−1) value inlets/outlets + 1 delay inlet.** The chain delays 3 values (pitch, vel, ch) + the delay, so it needs **`pipe 0 0 0 0`** (3 value outlets). It originally shipped as `pipe 0 0 0` — only 2 value outlets — so the patchcord to `noteout`'s channel inlet (pipe outlet 2) was out of range: `pipe: patchcord outlet out of range, deleting patchcord` in the console, and the channel was never delayed. Fixed by adding the 4th arg.

## Known risks / things to check first

- **M3d Map button (`live.remote~`) is implemented but UNTESTED in Live.** Research confirmed Live has no stock param-to-param mapping — the only real way is a device-owned Map button via `live.remote~` (so M7 was pulled forward). The chain is wired but I couldn't run Live. Most likely things to debug, in order:
  1. **`selected_parameter` capture — now done in JS via `LiveAPI` (in `bouncer.js`).** First attempt used a patcher chain (`live.path` → `live.observer @property selected_parameter` → gate) triggered first by `loadbang` (too early — Live API not ready) then by `live.thisdevice`'s bang; both produced **zero output** (the observer never fired, nothing printed). Rather than keep debugging the patcher blind, the capture moved into `bouncer.js`: a `LiveAPI(onSelParam, "live_set view")` with `.property = "selected_parameter"`, created **lazily on the first `map_arm 1`** (clicking Map at runtime guarantees the Live API is ready — sidesteps all init-timing issues). It records the selected-param id at arm time as a baseline and captures the next *different* id the user clicks, emits `map_target <id>` out v8ui outlet 1 → patcher `route map_target map_disarm` → `prepend id` → `live.remote~` right inlet, and `map_disarm` to pop the button. Heavy `post()` tracing is in for diagnosis (strip in M3f). Capture is **confirmed working in Live** (logs showed it correctly skip a `View` object and grab the clicked `DeviceParameter` id). Two fixes were needed along the way: (a) only forward ids whose `LiveAPI.type === "DeviceParameter"` — a single click can fire the observer with intermediate non-parameter objects (e.g. a `View`); (b) **`live.remote~`'s `id` cannot be set from inside a Live-API notification** (`"Setting the Id cannot be triggered by notifications. You will need to defer your response."`) — so the captured `id` is routed through a `deferlow` before `live.remote~`'s right inlet. Still TODO: confirm the modulation actually *drives* the target on wall hits (the `sig~ → live.remote~ @normalized` value path), and strip the `post()` tracing + check whether the always-override-at-rest behavior is acceptable.
  2. **`live.remote~` value inlet — float vs signal.** It's fed via `sig~ 0.` (a constant signal) because `live.remote~`'s left inlet is a signal inlet. If values don't move the target, confirm `@normalized 1` took (else send a `normalized 1` message) and that the signal is actually flowing.
  3. **Always-override-at-rest.** `live.remote~` *owns* the target while an `id` is set: at rest the mod value is 0, so the target is pinned to its **minimum** between hits (e.g. cutoff fully closed), pulsing up on each hit. That's the intended Phase-1 effect but will feel wrong on targets where min≠a sensible resting value. There's no "unmap" yet (clicking Map again just re-arms); to release, reload the device. Refine in M4/M7 (release via `id 0`, or modulate around the user's base value like LFO "Modulation" mode).
  4. **Global model.** Only `Wall Mod 1` is wired to walls + the single Map slot; dials 2–8 are visible meters that won't move until M4 gives each wall its own dial/target.

- **Geometry round-trip via `pattr`.** The script ships the wall layout as `set <json-as-symbol>` to a `pattr geometry` and reads it back via `prepend restore`. JSON has commas but `outlet()` passes the full string as a single Max symbol, so it *should* survive — but if reload comes back empty or garbled, switch the encoding in `bouncer.js` (`dumpGeometry` / `restore`) to base64 or to a flat list of numbers.
- **`v8ui` mouse handler signatures.** I'm using `onclick(x, y, button, …)` and `ondrag(x, y, button, …)` with the convention that `button === 0` during `ondrag` means mouse-released. If drag-to-draw never finalizes a wall, the release detection is off — log the args inside `ondrag` and adjust `finishDraw()` triggering.
- **`box.rect` in presentation.** Offscreen kill and exit-ray length use `box.rect`. If particles vanish unexpectedly when the device is shown in Live but not in the editor, `box.rect` is reporting the patching rect; we'd track width/height via a `size` message from the patcher instead.
- **M3a `poly~` absolute path.** `_patcher.json` instantiates the voice as `poly~ "D:/Ableton/User Library/Presets/Audio Effects/Max Audio Effect/bouncer/hitvoice.maxpat" 16 @steal 1` — same per-machine path quirk as the `v8ui` `filename`. Symptom on a different machine: `poly~: can't open hitvoice.maxpat` in the Max console, plus dead silence on the wet path. The proper fix (Freeze the device, or add the folder to Max's search path) is on the same TODO as the v8ui path.
- **M3a `target 0` race.** The first hit after the device loads relies on `t l b` to send `target 0` to `poly~` before the `[delay gain pan]` list, so the very first message goes to one voice rather than fanning out to all 16. If you ever see 16 voices fire simultaneously on the first hit, the `t l b`'s right-outlet-first ordering is being violated — check the patchlines.

---

## Milestones

### Milestone 1 — Visual toy (no audio) ✓
- [x] `v8ui` canvas with custom paint loop
- [x] Source point (drag to reposition)
- [x] Hand-drawn walls (draw mode toggle)
- [x] Particle emission at configurable rate
- [x] Ray/segment collision + reflection
- [x] Precomputed bounce paths (audio-thread-friendly)
- [x] Particles die offscreen or after N bounces
- [x] Wall selection + delete
- [x] Wall layout persistence (via `pattr`/`dict`)

### Milestone 2 — Collision messages ✓
- [x] Each wall has a stable id
- [x] Each particle has a stable id
- [x] `hit <particle_id> <wall_id> <delay_ms> <x> <y> <nx> <ny> <bounce>` emitted from canvas
- [x] MIDI input via parallel-track routing — confirmed working

### Milestone 3 — Make the device musically usable

The device is currently silent and modeless. M3 is split into six independently-shippable sub-milestones. After M3a it makes sound; after M3c it speaks MIDI; after M3d it modulates Ableton parameters.

#### M3a — Audio engine (resume the paused work) ✓
- [x] Wire `hitvoice.maxpat` into `_patcher.json` as `poly~ hitvoice 16 @steal 1` (loaded by absolute path; same per-machine path caveat as the `v8ui` `filename`)
- [x] `tapin~ 5000` L/R recent-audio buffers tapped off `plugin~`
- [x] `tapin~` outlets routed into each voice's `in~ 2` / `in~ 3` (the voice's `tapout~ 0` reads from the delay)
- [x] Crossfade wet sum vs. dry passthrough with the existing Dry/Wet dial. Dial still **not in presentation** — accessible via Live's device parameter list. Un-hide rolls into M3e with the rest of the layout work.
- [x] Augment hit message in `bouncer.js` to include gain (`0.85^bounce` decay) + pan (`hit.x → [-1,1]`). Per-wall overrides land in M4.
- [x] In patcher, `route hit` → `zl nth 3 4 5` extracts `[delay gain pan]`; `t l b` fires `target 0` then the list so `poly~` auto-allocates a voice each hit.
- [x] **Verified in Live:** with bouncer capturing both audio and MIDI, every wall hit produces a delayed tap (the sound repeats when a particle hits a wall).

#### M3b — Particle snapshot + live/dead visual state ✓
- [x] Add `snapshot {pitch, velocity, emittedAt}` + `srcType`, `srcAlive`, `nextEventIdx`, `hitFlashUntilMs` to each particle at emission
- [x] Listen for `notein` note-offs; flip matching live particles' `srcAlive=false`
- [x] Render filled circle when `srcAlive`, hollow ring when not
- [x] Transient 150ms refill flash on each wall hit, linearly fading back to current state
- [x] Random/audio source mode: auto-expire `srcAlive` after 1s
- [x] **Verified in Live:** particles emit filled, flash on each wall hit, go hollow on note release, refill briefly on subsequent hits

#### M3c — MIDI in (companion device) + MIDI out ✓
- [x] Ship a companion `bouncer-capture.amxd` MIDI Effect that goes before the instrument and forwards MIDI to bouncer via Max `send`/`receive` (zero-latency, same track). Auto-pair by Live API track ID + self-filter — no per-instance setup needed.
- [x] **Verified in Live:** capture before FM Piano, bouncer after, SOURCE = MIDI; particles emit on every note (including arpeggiator output, since capture sits after MIDI Effects) and FM Piano plays normally.
- [x] Add `noteout` to `_patcher.json` (hidden `midiout` for future CC is deferred to M3d/M4)
- [x] Add `mode: "audio"|"midi"|"mod"` field to wall object (default `"audio"`; backfilled on restore for old presets)
- [x] In hit router, walls in MIDI mode emit a `note_hit pitch vel ch` message that's split in the patcher into an immediate note-on + a `pipe`-scheduled note-off. `wall.noteOffset` is M4 — for M3c the pitch is `snapshot.pitch` (or 60 when source is non-MIDI).
- [x] Minimal UI: global `WallMode` `live.tab` (Audio / MIDI) placeholder until M4 brings the per-wall editor. Stamps every wall's `mode` in lockstep on change. Companion `NoteDuration` `live.dial` (10–2000 ms, default 200) controls the note-off delay; lives in the parameter dropdown, not in presentation yet (M3e polish).
- [x] **Verified in Live:** second MIDI track with `MIDI From = <bouncer track> | Bouncer` + a synth; flipping `WallMode` to `MIDI` fires a note on the downstream synth on every wall hit, pitch following the upstream note (SOURCE = MIDI). Also fixed during verification: the geometry `pattr` was a numeric Live parameter and emitted `set: bad number` on every wall draw / Clear / mode change — demoted to a plain blob `pattr` (see *Gotchas*).

#### M3d — Parameter modulation outputs (Phase 1 — manual map)
- [x] Add 8 `live.dial` parameters (`Wall Mod 1` … `Wall Mod 8`) exposed in device parameter list (0–1 float, param-only — not in presentation yet, same as NoteDur/MaxBounces)
- [x] Walls in `mod` mode store `dialIndex`, `peakValue`, `decayMs` (defaults 0 / 1.0 / 300 ms; round-trip through the geometry pattr so M4's per-wall editor inherits them). No per-wall editor yet, so every mod wall pulses dial 0 (`Wall Mod 1`) until M4.
- [x] On hit, pulse the assigned dial then decay back. The pulse jumps to `peakValue` and decays linearly to 0 over `decayMs`, emitted from `bouncer.js`'s `tick()` at ~60 fps. Routing: `bouncer.js` outlet `mod <dialIndex> <value>` → patcher `route … mod …` (outlet 3) → `route 0 1 2 3 4 5 6 7` → the 8 dials.
- [x] `WallMode` `live.tab` enum extended to `Audio / MIDI / Mod`; `wall_mode(2)` stamps every wall to `"mod"`.
- [x] **Pulled M7's `live.remote~` Map button forward** (research showed plain exposed params have no stock param-to-param mapping, so the dials alone couldn't drive anything). Added a `Map` `live.text` button + Live API capture chain (`live.path live_set view` → `live.observer` on `selected_parameter` → `route` → `gate` by map-arm → `t l b` captures the clicked param's `id`) feeding `live.remote~ @normalized 1`. The global mod pulse (`Wall Mod 1`) → `sig~` → `live.remote~` drives the captured target, auto-scaled 0–1 to its range. All 8 dials surfaced in presentation (bottom row); for now only dial 1 is wired to walls + the single Map slot (global model) — per-wall dial/target picking is M4.
- [x] **Verified in Live:** `WallMode = Mod`, click bouncer's **Map** (turns orange), click a synth's filter-cutoff knob → captured (console shows `captured target id=…`); drawing a wall + playing pulses the cutoff up and decays it back on every hit. Required fixes during bring-up: capture moved to JS `LiveAPI` armed on Map-click; only forward `DeviceParameter`-typed ids; `deferlow` the `id` into `live.remote~` (can't set id inside a Live-API notification). Global model: all walls → `Wall Mod 1` → the single Map slot (per-wall dial/target = M4). Still open: strip `post()` tracing (M3f); decide whether always-override-at-rest is acceptable.

#### M3e — Canvas / expand bug fixes + presentation polish
- [ ] Bind canvas size to presentation rect dimensions (fix expand widening device but not canvas)
- [ ] Clip source/particle motion to visible presentation rectangle, not underlying patching rect
- [ ] Mostly view-layout fixes in `_patcher.json` + a clipping check in `bouncer.js`'s drag handler
- [ ] Move the Dry/Wet (and probably Max Bounces) dials into presentation now that audio is live — needs a small canvas-x shift to make room

#### M3f — Cleanup
- [x] Remove the noisy `post()` in `bouncer.js`'s `midi_note()` — also stripped the M3d map-capture trace `post()`s (kept only try/catch error posts) and the `starting load` line.
- [x] Strip `print HIT` / `print PARTICLE` debug logging in the patcher (`route … particle` outlet is now unconsumed — fine).
- [x] Update README with Live track-setup instructions for MIDI in (capture + bouncer on one track via auto-pair) — done; MIDI out + parameter mapping recipes added when M3c's noteout work lands and M3d's mod dials are wired.

### Milestone 4 — Per-wall config UI
- [ ] Wall selection panel showing the selected wall's mode + mode-specific params
- [ ] Audio mode: gain, pan bias, pitch offset, voice tuning
- [ ] MIDI mode: note offset, velocity scale, duration, channel
- [ ] Mod mode: dial index, peak value, decay
- [ ] Extend `pattr` serializer in `bouncer.js` to round-trip these fields

### Milestone 5 — Audio-reactive emission
- [ ] Amplitude → particle energy
- [ ] Transient → particle burst
- [ ] Stereo balance → launch spread

### Milestone 6 — Granular particle audio
- [ ] Circular input buffer
- [ ] Per-particle emission buffer position
- [ ] `poly~` grain voice reads remembered slice on hit
- [ ] Pitch / reverse / freeze per wall

### Milestone 7 — Live API parameter targeting (Phase 2 of param modulation)
- [ ] Per-wall Map Button captures a Live API path to a target parameter
- [ ] On hit, write a value directly to that parameter via `live.object` / `live.remote~`
- [ ] Removes the "max 8 dials" limitation of M3d

### Milestone 8 — High-priority hit dispatch (deferred upgrade)
- [ ] At particle emission, ship each future `hit` event into Max's high-priority scheduler via `pipe <hitTimeMs>` (or per-event `delay`) instead of waiting for the v8ui `tick()` to detect the collision
- [ ] Visual flash stays driven by `tick()`; only the audio outlet moves
- [ ] Removes the ~16 ms tick-rate jitter on the audio side
- [ ] Trigger to take this on: dense particle streams or granular per-wall audio (M6) where the jitter starts to matter. See *Hit-event dispatch* in `PLAN.md.txt` for rationale.

### Milestone 8c — Bouncer Rack preset (single-drag install)
- [ ] Build `Bouncer.adg` in Live: Instrument Rack containing `bouncer-capture` → an empty instrument slot (labelled "Drop your instrument here") → `bouncer`.
- [ ] Promote the most-tweaked bouncer parameters as Rack macros: Dry/Wet, Particle Rate, Speed, Max Bounces, Direction, Spread, Draw.
- [ ] Save into `bouncer/` and commit. From the user's perspective the product becomes "drag Bouncer.adg onto a MIDI track, drop your instrument in the slot".
- [ ] Out of scope until requested: a default placeholder instrument bundled inside the rack (the empty slot keeps the rack small and honest about what it does).

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
| Mix (Dry/Wet)    | `live.dial`    | 0–100 %                   | output crossfade                   |
| Emit Direction   | `live.dial`    | 0–360 °                   | v8ui `emit_dir`                    |
| Emit Spread      | `live.dial`    | 0–360 °                   | v8ui `emit_spread`                 |
| Particle Rate    | `live.dial`    | 10–1000 ms                | v8ui `rate_ms`                     |
| Projection Speed | `live.dial`    | 50–1500 px/s              | v8ui `speed_px_s`                  |
| Max Bounces      | `live.dial`    | 1–32                      | v8ui `max_bounces` *(param-only)*  |
| Note Duration    | `live.dial`    | 10–2000 ms                | v8ui `midi_dur` + pipe delay inlet *(param-only)* |
| Draw Mode        | `live.text`    | toggle                    | v8ui `drawmode`                    |
| Source Mode      | `live.tab`     | Random / MIDI             | v8ui `source_mode`                 |
| Wall Mode        | `live.tab`     | Audio / MIDI / Mod        | v8ui `wall_mode` (global override) |
| Wall Mod 1–8     | `live.dial`    | 0–1                       | mod-mode hit pulse meters (dial 1 → `live.remote~`) |
| Map              | `live.text`    | arm / off                 | captures clicked param → `live.remote~` target |
| Expand View      | `live.text`    | compact / expanded        | thispatcher resize                 |
| Clear Walls      | `live.text`    | button                    | v8ui `clear_walls`                 |
| Delete Selected  | `live.text`    | button                    | v8ui `delete_selected`             |

Hit Gain dial is no longer wired separately — per-bounce gain (`0.85^bounce`) and hit pan (x → [-1, 1]) are computed in `bouncer.js`'s dispatch loop and shipped per-hit in the `hit` message. Per-wall gain/pan overrides land in M4.
