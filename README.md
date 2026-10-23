# Averis | Highest DMG (v1.6.0 — Foundry V14)

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
- **Automatic Damage Tracking**: OFF by default. GM can use **ON/OFF** in the Record Manager (or the module's Configure Settings) to enable recording of a new Highest DMG after real damage has been applied to a target.
- Tracks the damage actually applied, after resistance/immunity and damage adjustments, using `dnd5e.applyDamage` or Midi-QOL's post-application `midi-qol.damaged` hook. Never records damage from damage-roll or pre-application events. Temporary HP damage is included with Midi-QOL.
- A new record is automatically created for a recognized **player character**; an existing one is increased only on a new personal high. Manual records and custom artwork stay intact.
- Tracking skips healing, zero damage, NPCs, self-damage and events without a reliably identified attacker (for normal D&D5e damage application, a linked message ID or explicit source item/activity is needed). It never guesses who attacked based on who was targeted.
- Only a connected GM writes settings. Post-damage events from player clients with a source chat message can be forwarded to an active GM for record updates; the message's attacker is rechecked on the GM client.
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
- Manual Highest DMG stays available. Automatic tracking is optional and supports D&D 5e's post-apply hook and Midi-QOL's post-damage hook (if installed).
- Token artwork selection uses Foundry V14's native FilePicker. The module links to image paths stored in Foundry, rather than duplicating or embedding image files.
- JavaScript syntax and simulated damage-application checks can be run outside Foundry. Actual Foundry V14 + D&D5e 5.3.3 / Midi-QOL in-session testing is still necessary.

## Restored configuration

v1.5.0 restored the v1.3.0 Foundry V14 module code and settings. v1.6.0 adds optional post-applied automatic damage tracking, disabled by default. The separate v1.4.0 release remains available for Foundry V11. The module ID and world-setting key are unchanged; reinstalling the module does not itself reset or erase campaign records. Do not downgrade a Foundry world from V14 to V11.
