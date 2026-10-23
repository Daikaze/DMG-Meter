# Averis | Highest DMG (v1.3.0)

**Foundry VTT v14** · D&D 5e 5.3.3 compatible.

A dark gold-accented **Highest DMG** leaderboard for your Averis campaign. The board begins empty and contains just **one category: highest single-hit damage**. There are no sample characters, example encounters, or automatic damage calculations.

## Installation

**Manifest URL:**

```text
https://raw.githubusercontent.com/Daikaze/DMG-Meter/main/module.json
```

In Foundry, open **Add-on Modules → Install Module**, paste the manifest URL, install, and enable **Averis | Highest DMG** in Manage Modules.

Alternatively, download the repository and place its contents inside `Data/modules/averis-highest-dmg/`, ensuring `module.json` is at that path.

## How to use

- **GM and players:** click the **trophy icon** in the **left-hand Scene Controls toolbar** (beside the canvas, as shown with the other scene tools). It opens Highest DMG directly. Its adjacent tool icon can also reopen the scoreboard.
- You can still open it from **Game Settings → Configure Settings → Module Settings → Averis | Highest DMG → Open Scoreboard**.
- **Add Record**: select a world character or enter its name manually, then enter the damage.
- **Token / Character Art**: choose **Browse Art** to select or upload an image with Foundry's image picker; optionally paste a Foundry image path. **Use Token Art** selects the current scene token image (or prototype token image), **Use Portrait** selects the actor's portrait, and **Clear** removes the image. Pick a character first for the Token/Portrait buttons.
- A live thumbnail preview appears in the editor. Saved artwork appears as a circular avatar in the leaderboard and a larger featured portrait for the top damage record.
- Changing scoreboard artwork **does not modify actor portraits or canvas tokens**. Existing saved images remain intact unless you change them. Image paths are stored with each record; GM-only controls.
- **Pencil icon**: edit any existing record, including its art; **Delete** removes it after confirmation.
- Highest damage ranks first, with the leader featured in the gold card.
- **GM** sees Add Record, Edit and Delete. **Players** see only the leaderboard; no editing controls are rendered. Saving and deleting also checks GM permissions and relies on Foundry's world setting authorization.
- The launcher uses Foundry V14's native `getSceneControlButtons` hook. It appears for everyone in the left scene toolbar. It does not insert an unclickable floating icon on the right.
- Records are saved to a world setting and survive Foundry restarts.

You can add a hotbar Script macro:

```js
game.modules.get("averis-highest-dmg").api.open();
```

## Notes

- No global CSS or core UI overrides.
- Uses the Foundry v14 ApplicationV2 and Handlebars APIs.
- Manual highest DMG only; no Midi-QOL integration or automatic tracking.
- Token artwork selection uses Foundry V14's native FilePicker. The module links to image paths stored in Foundry, rather than duplicating or embedding image files.
- JavaScript, artwork selection, save/load, and simulated GM/player permission checks have been run outside Foundry. Verify layout, file browser, and image access with real Foundry V14 GM and player clients as well.
