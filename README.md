# xCloud Keyboard Gamepad

Play **any** Xbox Cloud Gaming game on `play.xbox.com` with keyboard and mouse, even games that need a controller (Forza Horizon 6, etc.). It adds a virtual Xbox controller in the browser. No real gamepad, no extra app.

Tested in Chrome on macOS with the new `play.xbox.com` client (2026).

> Better xCloud does not work on the new `play.xbox.com` page and can break it. Turn it off while using this.

## Install

Pick **one**.

### Option A: Tampermonkey (userscript)

1. Install [Tampermonkey](https://www.tampermonkey.net/) in Chrome.
2. `chrome://extensions` > Tampermonkey > Details > turn on **Allow user scripts**.
3. Open [`xcloud-keyboard-gamepad.user.js`](https://raw.githubusercontent.com/subscriptions-dot/xcloud-keyboard-gamepad/main/xcloud-keyboard-gamepad.user.js) and click **Install**.

### Option B: Chrome extension (no Tampermonkey)

1. Download this repo (Code > Download ZIP) and unzip.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** > choose the `extension` folder.

## Use

1. Open `play.xbox.com` and start a game.
2. Click once on the game screen.
3. Press **`** (backtick, key under Esc). A green toast says *Keyboard gamepad ON*.
4. If the game says "Connect a controller", it will now detect it. Press `Enter`.

| Key | Action |
| --- | --- |
| `` ` `` | Virtual controller ON / OFF |
| `\` | Switch mode: racing / shooter |

### Racing mode (default)

| Key | Controller |
| --- | --- |
| `W` | RT (gas) |
| `S` | LT (brake / reverse) |
| `A` / `D` | Left stick (steer) |
| `Space`, `Enter` | A |
| `Backspace` | B |
| `Q` | X |
| `E` | Y |
| `Shift` | RB (gear up) |
| `Ctrl` | LB (gear down) |
| `R` | Right stick click |
| Arrow keys | D-pad |
| `Tab` | Menu / Start |
| `G` | View / Back |

### Shooter mode

| Key | Controller |
| --- | --- |
| `W A S D` | Left stick |
| Mouse | Right stick (click screen first to lock mouse) |
| Left click | RT |
| Right click | LT |
| `Space` | A |
| `C` | B |
| `R` | X |
| `E` | Y |
| `Q` / `F` | LB / RB |
| `Shift` | Left stick click |
| `V` | Right stick click |
| Arrow keys, `Enter`, `Backspace`, `Tab`, `G` | same as racing |

Tip for racing on keyboard: pick **Assisted Steering and Braking**, keyboard steering is all-or-nothing.

## How it works

The new `play.xbox.com` stream client does not poll `navigator.getGamepads()` every frame. It listens for Chrome's `gamepadrawinputchanged` event. That is why older scripts that only patch `getGamepads()` show "Controller not detected".

This script:

1. Patches `navigator.getGamepads()` to add a virtual "standard" Xbox 360 pad driven by the keyboard and mouse.
2. Sends a `focus` event so the Xbox UI starts tracking gamepads.
3. Sends `gamepadconnected`, then a `gamepadrawinputchanged` event on every key change and every frame, which is what the stream reads.
4. Stops mapped keys from reaching the Xbox page, so `Enter` does not also open the Xbox guide.

## Known limits

- Keyboard steering and throttle are digital (full on / off).
- Mouse look in shooter mode is basic, sensitivity is `MOUSE_SENS` in the script.
- If Microsoft changes the stream client, this can break.
- Not affiliated with Microsoft or Xbox.

## License

MIT
