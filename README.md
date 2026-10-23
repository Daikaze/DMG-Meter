# Averis | Highest DMG (v1.4.0 — Foundry V11)

**Foundry VTT V11 only** · Manual Highest DMG records for D&D 5e. Not compatible with Foundry V14.

A dark gold-accented **Highest DMG** leaderboard for your Averis campaign. The board begins empty and contains just **one category: highest single-hit damage**. There are no sample characters, example encounters, or automatic damage calculations.

## Installation

**Manifest URL:**

```text
https://raw.githubusercontent.com/Daikaze/DMG-Meter/main/module.json
```

In Foundry, open **Add-on Modules → Install Module**, paste the manifest URL, install, and enable **Averis | Highest DMG** in Manage Modules.

Alternatively, download the repository and place its contents inside `Data/modules/averis-highest-dmg/`, ensuring `module.json` is at that path.

## How to use

- **GM and players:** click the **trophy icon** on the **left-hand Scene Controls toolbar**. In V11, the icon opens Highest DMG on click; the adjacent tool also opens the same window.
- You can still open it from **Game Settings → Configure Settings → Module Settings → Averis | Highest DMG → Open Scoreboard**.
- **Add Record**: select a world character or enter its name manually, then enter the damage.
- **Token / Character Art**: choose **Browse Art** to select or upload an image with Foundry's image picker; optionally paste a Foundry image path. **Use Token Art** selects the current scene token image (or prototype token image), **Use Portrait** selects the actor's portrait, and **Clear** removes the image. Pick a character first for the Token/Portrait buttons.
- A live thumbnail preview appears in the editor. Saved artwork appears as a circular avatar in the leaderboard and a larger featured portrait for the top damage record.
- Changing scoreboard artwork **does not modify actor portraits or canvas tokens**. Existing saved images remain intact unless you change them. Image paths are stored with each record; GM-only controls.
- **Pencil icon**: edit any existing record, including its art; **Delete** removes it after confirmation.
- Highest damage ranks first, with the leader featured in the gold card.
- **GM** sees Add Record, Edit and Delete. **Players** see only the leaderboard; no editing controls are rendered. Saving and deleting also checks GM permissions and relies on Foundry's world setting authorization.
- The launcher uses Foundry V11's **array-based** `getSceneControlButtons` hook, the existing TokenLayer, and a V11 Scene Controls render hook for one-click access. It does not insert icons into the right sidebar.
- Records are saved to a world setting and survive Foundry restarts.

You can add a hotbar Script macro:

```js
game.modules.get("averis-highest-dmg").api.open();
```

## Notes

- No global CSS or core UI overrides.
- Uses Foundry **V11** `Application`, `FormApplication`, Handlebars templates, `FilePicker`, and `Dialog`. Does not use V12+ or V14 application APIs.
- Manual highest DMG only; no Midi-QOL integration or automatic tracking.
- Token artwork selection uses Foundry V11's native FilePicker. The module links to image paths stored in Foundry, rather than duplicating or embedding image files.
- Automated V11 API-shape, artwork selection, save/delete, and GM/player permission checks are run against simulated APIs. Real Foundry V11 GM and player testing remains necessary.

## Upgrade notes

v1.4.0 targets **Foundry V11 exclusively**. It retains the module ID `averis-highest-dmg` and the world setting `records`, so existing records and artwork paths stay in place when upgrading the module in the same world. No conversion from Foundry V14 worlds to V11 is supported; Foundry worlds themselves should not be downgraded. The older Foundry V14 code remains available under the `v1.3.0` release.
