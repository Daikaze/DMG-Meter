/**
 * Averis | Highest DMG — Foundry VTT V14.
 * Records are manual only; no encounter or automatic damage tracking.
 * No global CSS, document monkey-patching, or core UI overrides.
 */
const MODULE_ID = "averis-highest-dmg";
const MAX_DAMAGE = 999_999_999;
const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;
const activeWindows = new Set();

function recordsFromSettings() {
  const value = game.settings.get(MODULE_ID, "records");
  if (!Array.isArray(value)) return [];
  return value
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? "").slice(0, 48),
      damage: Number(row.damage),
      actorId: String(row.actorId ?? ""),
      img: normalizeArtPath(row.img)
    }))
    .filter((row) => row.id && row.name.trim() && Number.isSafeInteger(row.damage)
      && row.damage >= 0 && row.damage <= MAX_DAMAGE);
}

function sortRecords(records) {
  return [...records].sort((a, b) => b.damage - a.damage || a.name.localeCompare(b.name));
}

function formatDamage(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

/** Images are paths picked from Foundry or explicitly entered by the GM. */
function normalizeArtPath(value) {
  const path = String(value ?? "").trim();
  if (!path || path.length > 2048 || /[\r\n<>]/.test(path)
      || /^(?:javascript|data|file|vbscript):/i.test(path)) return "";
  return path;
}

/** Prefer the character's actual scene token, then prototype token, then portrait. */
function getTokenArt(actor) {
  if (!actor) return "";
  const active = globalThis.canvas?.tokens?.placeables?.find(
    (token) => token?.actor?.id === actor.id
  )?.document?.texture?.src;
  const paths = [active, actor.prototypeToken?.texture?.src, actor.img];
  return paths.map(normalizeArtPath).find((path) => path && !path.includes("*"))
    || normalizeArtPath(actor.img);
}

class HighestDmgApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "averis-highest-dmg-window",
    classes: ["averis-highest-dmg-window"],
    window: {
      title: "Averis | Highest DMG",
      icon: "fa-solid fa-trophy",
      resizable: true
    },
    position: { width: 770, height: 680 }
  };

  static PARTS = {
    scoreboard: { template: `modules/${MODULE_ID}/templates/scoreboard.hbs` }
  };

  _editorOpen = false;
  _editingId = null;
  _busy = false;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const rows = sortRecords(recordsFromSettings()).map((record, index) => ({
      ...record,
      rank: index + 1,
      isFirst: index === 0,
      firstLetter: Array.from(record.name.trim())[0]?.toUpperCase() ?? "?",
      displayDamage: formatDamage(record.damage)
    }));
    const canEdit = Boolean(game.user?.isGM);
    const activeRecord = rows.find((row) => row.id === this._editingId);
    const editor = activeRecord || { name: "", damage: "", actorId: "", img: "" };
    const actors = canEdit ? [...game.actors.contents]
      .filter((actor) => actor.type === "character" || actor.hasPlayerOwner)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((actor) => ({
        id: actor.id,
        name: actor.name,
        selected: actor.id === editor.actorId
      })) : [];

    return {
      ...context,
      rows,
      leader: rows[0] || null,
      hasRecords: rows.length > 0,
      recordCount: rows.length,
      canEdit,
      editorOpen: canEdit && this._editorOpen,
      editing: Boolean(activeRecord),
      editor,
      actors,
      busy: this._busy,
      trackingEnabled: game.settings.get(MODULE_ID, "autoTracking")
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    activeWindows.add(this);
    const root = this.element.querySelector(".averis-hdmg");
    if (!root) return;

    root.addEventListener("click", (event) => {
      const target = event.target.closest("[data-hdmg-action]");
      if (!target || !root.contains(target)) return;
      const action = target.dataset.hdmgAction;
      if (action === "add") return this._openEditor();
      if (action === "edit") return this._openEditor(target.dataset.recordId);
      if (action === "cancel") return this._closeEditor();
      if (action === "delete") void this._deleteRecord();
      if (action === "toggle-tracking") void this._toggleTracking();
      if (action === "browse-art") void this._browseArt(root.querySelector("form.averis-hdmg__form"));
      if (action === "token-art") this._applyActorArt(root.querySelector("form.averis-hdmg__form"), "token");
      if (action === "portrait-art") this._applyActorArt(root.querySelector("form.averis-hdmg__form"), "portrait");
      if (action === "clear-art") this._setArt(root.querySelector("form.averis-hdmg__form"), "");
    });

    const form = root.querySelector("form.averis-hdmg__form");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        void this._saveRecord(form);
      });
      const actorSelect = form.elements.namedItem("actorId");
      actorSelect?.addEventListener("change", () => {
        const actor = game.actors.get(actorSelect.value);
        if (actor) {
          form.elements.namedItem("name").value = actor.name;
          this._setArt(form, getTokenArt(actor));
        }
      });

      const artInput = form.elements.namedItem("img");
      artInput?.addEventListener("input", () => this._refreshArtPreview(form));
      const previewImage = form.querySelector(".averis-hdmg__art-preview img");
      previewImage?.addEventListener("error", () => {
        previewImage.hidden = true;
        const fallback = form.querySelector(".averis-hdmg__art-placeholder");
        if (fallback) fallback.hidden = false;
      });
      this._refreshArtPreview(form);
    }
  }

  async _toggleTracking() {
    if (!game.user?.isGM || this._busy) return;
    this._busy = true;
    try {
      const current = game.settings.get(MODULE_ID, "autoTracking");
      await game.settings.set(MODULE_ID, "autoTracking", !current);
      ui.notifications.info(!current ? "Automatic damage tracking enabled." : "Automatic damage tracking disabled.");
    } catch (error) {
      console.error(`${MODULE_ID} | Could not change automatic tracking`, error);
      ui.notifications.error("Could not update automatic tracking.");
    } finally {
      this._busy = false;
      await this.render();
    }
  }

  _setArt(form, path) {
    if (!form || !game.user?.isGM) return;
    const input = form.elements.namedItem("img");
    if (!input) return;
    input.value = normalizeArtPath(path);
    this._refreshArtPreview(form);
  }

  _refreshArtPreview(form) {
    if (!form) return;
    const path = normalizeArtPath(form.elements.namedItem("img")?.value);
    const image = form.querySelector(".averis-hdmg__art-preview img");
    const placeholder = form.querySelector(".averis-hdmg__art-placeholder");
    if (image) {
      image.hidden = !path;
      if (path) {
        if (image.getAttribute("src") !== path) image.setAttribute("src", path);
      } else image.removeAttribute("src");
    }
    if (placeholder) placeholder.hidden = Boolean(path);
  }

  _applyActorArt(form, kind) {
    if (!form || !game.user?.isGM) return;
    const actorId = form.elements.namedItem("actorId")?.value;
    const actor = actorId ? game.actors.get(actorId) : null;
    if (!actor) {
      ui.notifications.warn("Select a character first to use their token or portrait art.");
      return;
    }
    const path = kind === "portrait" ? normalizeArtPath(actor.img) : getTokenArt(actor);
    if (!path) {
      ui.notifications.warn("The selected character has no image available.");
      return;
    }
    this._setArt(form, path);
  }

  async _browseArt(form) {
    if (!form || !game.user?.isGM) return;
    const Picker = foundry.applications.apps?.FilePicker?.implementation
      || foundry.applications.apps?.FilePicker;
    if (!Picker) {
      ui.notifications.error("Foundry's File Picker is unavailable.");
      return;
    }
    const selected = normalizeArtPath(form.elements.namedItem("img")?.value);
    try {
      const picker = new Picker({
        type: "image",
        current: selected,
        callback: (path) => {
          if (!form.isConnected || !this._editorOpen) return;
          this._setArt(form, path);
        }
      });
      await picker.render({ force: true });
    } catch (error) {
      console.error(`${MODULE_ID} | Cannot browse token art`, error);
      ui.notifications.error("Could not open the image picker.");
    }
  }

  _onClose(options) {
    activeWindows.delete(this);
    return super._onClose(options);
  }

  _openEditor(recordId = null) {
    if (!game.user?.isGM || this._busy) return;
    const record = recordId ? recordsFromSettings().find((item) => item.id === recordId) : null;
    if (recordId && !record) return;
    this._editingId = record?.id ?? null;
    this._editorOpen = true;
    void this.render();
  }

  _closeEditor() {
    if (this._busy) return;
    this._editingId = null;
    this._editorOpen = false;
    void this.render();
  }

  async _saveRecord(form) {
    if (!game.user?.isGM || this._busy) return;
    const name = String(form.elements.namedItem("name")?.value ?? "").trim();
    const rawDamage = String(form.elements.namedItem("damage")?.value ?? "").trim();
    const damage = Number(rawDamage);
    const actorId = String(form.elements.namedItem("actorId")?.value ?? "");
    const enteredArt = String(form.elements.namedItem("img")?.value ?? "").trim();
    const img = normalizeArtPath(enteredArt);

    if (enteredArt && !img) {
      ui.notifications.warn("Enter a valid image path for the character art.");
      return;
    }
    if (!name || name.length > 48) {
      ui.notifications.warn("Enter a character name (up to 48 characters).");
      return;
    }
    if (!rawDamage || !Number.isSafeInteger(damage) || damage < 0 || damage > MAX_DAMAGE) {
      ui.notifications.warn(`Damage must be a whole number between 0 and ${formatDamage(MAX_DAMAGE)}.`);
      return;
    }

    const actor = actorId ? game.actors.get(actorId) : null;
    const updated = {
      id: this._editingId || foundry.utils.randomID(),
      name,
      damage,
      actorId: actor?.id || "",
      img
    };
    const records = recordsFromSettings();
    const index = records.findIndex((row) => row.id === updated.id);
    if (this._editingId && index === -1) {
      ui.notifications.warn("This record no longer exists. Refresh and try again.");
      void this.render();
      return;
    }
    const duplicate = records.find((row) => row.id !== updated.id && (
      (updated.actorId && row.actorId === updated.actorId) ||
      row.name.trim().toLocaleLowerCase() === updated.name.toLocaleLowerCase()
    ));
    if (duplicate) {
      ui.notifications.warn("This character already has a record. Edit their existing entry instead.");
      return;
    }
    if (index === -1) records.push(updated);
    else records[index] = updated;

    this._busy = true;
    try {
      await game.settings.set(MODULE_ID, "records", records);
      this._editorOpen = false;
      this._editingId = null;
      ui.notifications.info("Highest DMG record saved.");
    } catch (err) {
      console.error(`${MODULE_ID} | Cannot save record`, err);
      ui.notifications.error("Unable to save Highest DMG record.");
    } finally {
      this._busy = false;
      await this.render();
    }
  }

  async _deleteRecord() {
    if (!game.user?.isGM || this._busy || !this._editingId) return;
    const record = recordsFromSettings().find((row) => row.id === this._editingId);
    if (!record) {
      this._closeEditor();
      return;
    }
    const confirmed = await DialogV2.confirm({
      window: { title: "Delete Highest DMG Record" },
      content: `<p>Remove the record for <strong>${foundry.utils.escapeHTML(record.name)}</strong>?</p>`,
      yes: { label: "Delete" },
      no: { label: "Cancel" },
      rejectClose: false
    });
    if (!confirmed) return;
    this._busy = true;
    try {
      const records = recordsFromSettings().filter((row) => row.id !== record.id);
      await game.settings.set(MODULE_ID, "records", records);
      this._editorOpen = false;
      this._editingId = null;
      ui.notifications.info("Highest DMG record deleted.");
    } catch (err) {
      console.error(`${MODULE_ID} | Cannot delete record`, err);
      ui.notifications.error("Unable to delete Highest DMG record.");
    } finally {
      this._busy = false;
      await this.render();
    }
  }
}

let scoreboardWindow = null;
let openingScoreboard = null;

function openScoreboard() {
  // A single instance is shared by the Scene Control and the module API.
  // Guard rendering to avoid duplicate windows if both tool and control
  // onChange fire as Foundry activates the control.
  if (!scoreboardWindow) scoreboardWindow = new HighestDmgApp();

  if (scoreboardWindow.rendered) {
    scoreboardWindow.bringToFront();
    return scoreboardWindow;
  }

  if (openingScoreboard) return openingScoreboard;
  try {
    openingScoreboard = Promise.resolve(scoreboardWindow.render({ force: true }));
    return openingScoreboard.finally(() => { openingScoreboard = null; });
  } catch (error) {
    openingScoreboard = null;
    console.error(`${MODULE_ID} | Could not open Highest DMG`, error);
    ui.notifications.error("Could not open the Highest DMG scoreboard.");
    return null;
  }
}

/**
 * Foundry v14 scene controls appear on the LEFT side of the canvas.
 * Use the supported getSceneControlButtons API, never hand-insert a DOM
 * element into the right-side sidebar or another module's navigation.
 *
 * The group (trophy icon, left column) opens the scoreboard directly;
 * the group's visible tool (right column) can open it again at any time.
 */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!controls || typeof controls !== "object") return;

  const orders = Object.values(controls).map(control => Number(control?.order) || 0);
  const order = Math.max(0, ...orders) + 1;
  const name = "averisHighestDmg";

  controls[name] = {
    name,
    title: "Highest DMG",
    icon: "fa-solid fa-trophy",
    order,
    visible: true, // GM and all players
    activeTool: "open",
    onChange: (_event, active) => {
      if (active) void openScoreboard();
    },
    tools: {
      open: {
        name: "open", // MUST match tools.open to avoid Foundry control errors
        title: "Open Highest DMG",
        icon: "fa-solid fa-trophy",
        order: 0,
        visible: true,
        onChange: (_event, active) => {
          if (active) void openScoreboard();
        }
      }
    }
  };
});

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "autoTracking", {
    name: "Automatic Damage Tracking",
    hint: "Record a new personal highest damage only after damage has been applied to a target. The source must be identifiable; this setting is GM-only.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: () => {
      for (const app of activeWindows) {
        if (app.rendered && !app._busy) void app.render();
      }
    }
  });

  game.settings.register(MODULE_ID, "records", {
    name: "Highest DMG Records",
    hint: "GM-maintained Highest Damage records.",
    scope: "world",
    config: false,
    type: Array,
    default: [],
    onChange: () => {
      for (const app of activeWindows) {
        if (app.rendered && !app._busy) void app.render();
      }
    }
  });

  game.settings.registerMenu(MODULE_ID, "openScoreboard", {
    name: "Open Highest DMG",
    label: "Open Scoreboard",
    hint: "Open the campaign's Highest Damage leaderboard. Only GMs can change records.",
    icon: "fa-solid fa-trophy",
    type: HighestDmgApp,
    restricted: false
  });
});

Hooks.once("ready", () => {
  const module = game.modules.get(MODULE_ID);
  if (module) module.api = Object.freeze({ open: openScoreboard });
});
