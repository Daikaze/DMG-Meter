# Averis | Highest DMG (v1.1.0)

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

- **GM and players:** click the gold **trophy icon** in Foundry's right-hand sidebar to open **Highest DMG** directly. A **Highest DMG** button is also available in the Settings sidebar panel as a fallback.\n- You can still open it from **Game Settings → Configure Settings → Module Settings → Averis | Highest DMG → Open Scoreboard**.
- **Add Record**: select a world character to use its portrait, or enter a name manually, then enter the damage.
- **Pencil icon**: edit any existing record; **Delete** removes it after confirmation.
- Highest damage ranks first, with the leader featured in the gold card.
- **GM** sees Add Record, Edit and Delete. **Players** see only the leaderboard; no editing controls are rendered. Saving and deleting also checks GM permissions and relies on Foundry's world setting authorization.\n- The shortcut is shown to both GMs and players. Clicking it opens a separate scoreboard window without switching your active sidebar tab.
- Records are saved to a world setting and survive Foundry restarts.

You can add a hotbar Script macro:

```js
game.modules.get("averis-highest-dmg").api.open();
```

## Notes

- No global CSS or core UI overrides.
- Uses the Foundry v14 ApplicationV2 and Handlebars APIs.
- Manual highest DMG only; no Midi-QOL integration or automatic tracking.
- Code/static checks can run outside Foundry, but sidebar placement and actual player permissions should also be tested directly with one GM client and one player client in Foundry V14.
