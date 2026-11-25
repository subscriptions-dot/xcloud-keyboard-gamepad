# Chrome Web Store listing: PadKey

Copy these into the Developer Dashboard.

## Package

`padkey-chrome-1.0.0.zip` (from the GitHub release, or zip the `chrome-extension` folder contents)

## Store listing tab

**Name** (from manifest): PadKey: Keyboard & Mouse Controller

**Summary** (from manifest, max 132):
Play Xbox Cloud Gaming in Chrome with your keyboard and mouse. Adds a virtual controller, no gamepad needed.

**Description:**

```
PadKey turns your keyboard and mouse into a game controller for Xbox Cloud Gaming in Chrome.

Many cloud games only accept a controller and stop at "Controller not detected". PadKey adds a virtual controller to the page, so those games work with the keys you already have.

FEATURES
• Works with games that ask for a controller (tested with Forza Horizon 6)
• Turns on by itself when a game starts
• Racing layout: W A S D or arrow keys for gas, brake and steering, with full steering while you hold the gas
• Shooter layout: W A S D to move, mouse to look, left/right click for fire and aim
• Small on-screen badge shows when it is on
• Settings popup: mode, auto on, badge, mouse sensitivity, key list

HOW TO USE
1. Open play.xbox.com and start a game.
2. PadKey turns on. If the game shows "Controller Disconnected", press Enter.
3. Press ` (key left of 1) to turn it off or on, and \ to switch racing / shooter.

RACING KEYS
W / Up: gas · S / Down: brake and reverse · A D / Left Right: steer · Space or Enter: A · Backspace: B · E: Y · Q: X · Shift / Ctrl: RB / LB · Tab: pause menu · I J K L: D-pad

SHOOTER KEYS
W A S D: move · Mouse: look (click the game first) · Left click: RT · Right click: LT · Space: A · C: B · R: X · E: Y · Q / F: LB / RB · Shift / V: stick clicks

PRIVACY
PadKey collects no data, makes no network requests and runs only on play.xbox.com.

Open source: https://github.com/subscriptions-dot/xcloud-keyboard-gamepad

PadKey is not affiliated with, endorsed by, or sponsored by Microsoft or Xbox. Xbox is a trademark of Microsoft Corporation.
```

**Category:** Games (or "Fun")

**Language:** English

**Store icon:** `store/icon512.png` resized to 128x128 → use `chrome-extension/icons/icon128.png`

**Screenshots (1280x800):** `store/screenshot1.png`, `store/screenshot2.png`, `store/screenshot3.png`

**Small promo tile (440x280):** `store/promo-small-440x280.png`

**Homepage URL:** https://github.com/subscriptions-dot/xcloud-keyboard-gamepad

**Support URL:** https://github.com/subscriptions-dot/xcloud-keyboard-gamepad/issues

## Privacy tab

**Single purpose:**
Let users play Xbox Cloud Gaming (play.xbox.com) with keyboard and mouse by adding a virtual game controller to that page.

**Permission justification:**
- `storage`: saves the user's PadKey settings (mode, auto on, badge, mouse sensitivity).
- Host access `https://play.xbox.com/*`, `https://www.xbox.com/*/play*` (content scripts): needed to add the virtual controller and read key presses on the cloud gaming page only.

**Remote code:** No, I am not using remote code.

**Data usage:** tick nothing (collects no user data). Certify the three disclosures.

**Privacy policy URL:** https://github.com/subscriptions-dot/xcloud-keyboard-gamepad/blob/main/PRIVACY.md

## Distribution tab

Visibility: Public · Regions: all
