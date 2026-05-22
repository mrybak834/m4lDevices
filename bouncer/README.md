# bouncer

A Max for Live audio effect that emits visual particles from a draggable, directional source, bounces them off hand-drawn walls, and turns each wall hit into one of: a delayed audio tap, a MIDI note out, or a pulse on a Live-mappable modulation dial. Each wall is independently configurable.

- See [`PROGRESS.md`](PROGRESS.md) for the current milestone breakdown (M3a–M3f covers the in-progress audio + MIDI + modulation work), deferred issues, and gotchas.
- See [`PLAN.md.txt`](PLAN.md.txt) for the original design plan and the 2026-05-21 design update (device-type research, per-wall mode model, snapshot model, parameter modulation plan).

## Files

| File | Role |
|---|---|
| `bouncer.amxd` | The built Max for Live device. |
| `bouncer.js` | `v8ui` canvas script — all simulation, drawing, mouse handling, persistence. |
| `_patcher.json` | JSON source for `bouncer.amxd`. Edit this, not the `.amxd`. |
| `_build_amxd.ps1` | Wraps `_patcher.json` with the `.amxd` binary header (`ampf…ptch<len>`). Resolves paths relative to its own location, so you can invoke it from any working directory. |
| `hitvoice.maxpat` | `poly~` voice sub-patcher for the delay-tap audio engine. Wired in as M3a — instantiated as `poly~ "<abs-path>/hitvoice.maxpat" 16 @steal 1` (see PROGRESS.md *Known risks* for the per-machine path caveat). |
| `PROGRESS.md` | Live tracker: milestones, known issues, gotchas hit. |
| `PLAN.md.txt` | Original design plan. |

## Build

```powershell
./_build_amxd.ps1
```

Rewrites `bouncer.amxd` next to the script.

## Local-machine paths

The `v8ui` box in `_patcher.json` points to `bouncer.js` via the **absolute path** on the original developer's machine (`D:/Ableton/User Library/Presets/Audio Effects/Max Audio Effect/bouncer/bouncer.js`). To use this device on a different machine: open `bouncer.amxd` in Max, click the `v8ui` box's inspector, and set `filename` to your local copy of `bouncer.js`. Cleaning this up (likely by Freezing the device or moving to a project-relative path) is on the TODO list in `PROGRESS.md`.
