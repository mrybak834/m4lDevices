# bouncer

A Max for Live audio effect that emits visual particles from a draggable, directional source, bounces them off hand-drawn walls, and turns each wall hit into one of: a delayed audio tap, a MIDI note out, or a pulse on a Live-mappable modulation dial. Each wall is independently configurable.

- See [`PROGRESS.md`](PROGRESS.md) for the current milestone breakdown (M3a–M3f covers the in-progress audio + MIDI + modulation work), deferred issues, and gotchas.
- See [`PLAN.md.txt`](PLAN.md.txt) for the original design plan and the 2026-05-21 design update (device-type research, per-wall mode model, snapshot model, parameter modulation plan).

## How to use

Drop both devices onto the **same MIDI/instrument track**, in this order:

```
MIDI clip → (any MIDI effects e.g. Arpeggiator) → bouncer-capture → your instrument → bouncer
```

- `bouncer-capture` (MIDI Effect) sits *before* the instrument and quietly forwards every note to its paired `bouncer` on the same track. It passes MIDI through unchanged — the instrument plays normally.
- `bouncer` (Audio Effect) sits *after* the instrument, taps the instrument's audio output for its delay engine, and emits particles from the MIDI notes it received via the capture device.
- The two devices auto-pair via Live's track ID — no per-instance setup. Multiple bouncer pairs across different tracks don't cross-trigger.
- In `bouncer`, flip the **SOURCE** tab from `Random` to `MIDI` so particles emit on note-ons rather than on the timer.

A `Bouncer.adg` Instrument Rack preset bundling both devices + an empty instrument slot is planned (see `PROGRESS.md` Milestone 8c) so the entire setup becomes one drag from the browser.

### Sending MIDI out from walls (M3c)

Bouncer's `Walls` tab (parameter `WallMode`) selects what every wall does on hit:

- `Audio` — wall hits feed the internal delay tap engine (default).
- `MIDI` — wall hits emit `noteout` with the particle's snapshot pitch, the snapshot velocity, and channel 1. The note-off is scheduled `NoteDuration` ms (default 200) after the note-on.

To use MIDI-mode walls, set up a downstream MIDI track:

1. Create a new MIDI track.
2. Set its **MIDI From** chooser to the track that hosts bouncer, then pick `Bouncer` in the second chooser (Live exposes bouncer as a MIDI source because of its `noteout` object).
3. Set **Monitor** to `In` (so the track passes MIDI without recording-arm).
4. Drop any synth on this MIDI track.

Flip bouncer's `Walls` tab to `MIDI`. Every wall hit will now drive a note on the downstream synth. With `SOURCE = MIDI`, pitch follows the upstream-played note; with `SOURCE = Random`, pitch is currently fixed at 60 (middle C). Per-wall note offsets / channels land in M4.

Per-wall mode (mixing audio + MIDI walls in the same device) lands with the per-wall editor in M4; the M3c placeholder stamps every wall to the same mode in lockstep.

### Standalone / advanced setups

- **bouncer alone on an audio track**: tap-effect any audio source. No MIDI source mode unless you route MIDI into the track via `MIDI From` (Live 11+) or a parallel MIDI track whose `MIDI To` targets the bouncer device. Particle emission stays in `Random` mode.
- **Multiple bouncer pairs in one set**: just drop a capture + bouncer pair on each track. Auto-pair filters by track ID, so they stay independent.

## Files

| File | Role |
|---|---|
| `bouncer.amxd` | The Audio Effect. Tap engine + particle canvas + Live parameters. |
| `bouncer-capture.amxd` | The companion MIDI Effect. Passthrough + forwards notes to `bouncer` on the same track. |
| `bouncer.js` | `v8ui` canvas script — all simulation, drawing, mouse handling, persistence. |
| `hitvoice.maxpat` | `poly~` voice sub-patcher for the delay-tap audio engine. Instantiated as `poly~ "<abs-path>/hitvoice.maxpat" 16 @steal 1` (see PROGRESS.md *Known risks* for the per-machine path caveat). |
| `_patcher.json` | JSON source for `bouncer.amxd`. Edit this, not the `.amxd`. |
| `_capture_patcher.json` | JSON source for `bouncer-capture.amxd`. |
| `_build_amxd.ps1` | Wraps either JSON source with the `.amxd` binary header. `-DeviceTag aaaa` for Audio Effect (default), `-DeviceTag mmmm` for MIDI Effect. Resolves paths relative to its own location. |
| `PROGRESS.md` | Live tracker: milestones, known issues, gotchas hit. |
| `PLAN.md.txt` | Original design plan + 2026-05-21 design update. |

## Build

```powershell
./_build_amxd.ps1                                                                  # rebuild bouncer.amxd
./_build_amxd.ps1 -JsonPath _capture_patcher.json -OutPath bouncer-capture.amxd -DeviceTag mmmm   # rebuild capture
```

## Local-machine paths

The `v8ui` box in `_patcher.json` points to `bouncer.js` via the **absolute path** on the original developer's machine (`D:/Ableton/User Library/Presets/Audio Effects/Max Audio Effect/bouncer/bouncer.js`), and the `poly~` box loads `hitvoice.maxpat` the same way. To use the devices on a different machine: open the `.amxd` in Max, click the relevant box's inspector, and update the path. Cleaning this up (likely by Freezing the devices or moving to a project-relative path) is on the TODO list in `PROGRESS.md`.
