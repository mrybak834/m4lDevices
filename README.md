# m4lDevices

Custom Max for Live devices.

This repo lives inside Ableton's `Max Audio Effect` User Library folder so the devices it tracks are discoverable from Live's browser without any path-juggling. Each device gets its own subfolder.

## Devices

- [`bouncer/`](bouncer/) — visual particle device with hand-drawn walls; planned delay-tap audio engine. See [`bouncer/README.md`](bouncer/README.md) and [`bouncer/PROGRESS.md`](bouncer/PROGRESS.md).

## Repo location

`D:\Ableton\User Library\Presets\Audio Effects\Max Audio Effect\`

Live's browser shows the devices under **User Library → Audio Effects → Max Audio Effect → \<device\>**. Drop a device's `.amxd` onto a track from there.

`.amxd` files Live auto-saves at the repo root (e.g. when you save a new Max Audio Effect to the User Library default location) are intentionally `.gitignore`d so the repo only tracks devices we explicitly develop here.
