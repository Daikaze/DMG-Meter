# Averis | Highest DMG

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

- Open **Game Settings → Configure Settings → Module Settings → Averis | Highest DMG → Open Scoreboard**.
- **Add Record**: select a world character to use its portrait, or enter a name manually, then enter the damage.
- **Pencil icon**: edit any existing record; **Delete** removes it after confirmation.
- Highest damage ranks first, with the leader featured in the gold card.
- Only the GM can edit. Players can view the scoreboard in read-only mode.
- Records are saved to a world setting and survive Foundry restarts.

You can add a hotbar Script macro:

```js
game.modules.get("averis-highest-dmg").api.open();
```

## Notes

- No global CSS or core UI overrides.
- Uses the Foundry v14 ApplicationV2 and Handlebars APIs.
- Manual highest DMG only; no Midi-QOL integration or automatic tracking.
- Automated tests verify record handling, but please also test inside your own Foundry installation.
