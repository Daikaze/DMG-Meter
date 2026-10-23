/**
 * Averis | Highest DMG — Foundry VTT V11.
 * Records are manual only; no encounter or automatic damage tracking.
 * No global CSS, document monkey-patching, or core UI overrides.
 */
const MODULE_ID = "averis-highest-dmg";
const MAX_DAMAGE = 999_999_999;
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

class HighestDmgApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "averis-highest-dmg-window",
      classes: ["averis-highest-dmg-window"],
      template: `modules/${MODULE_ID}/templates/scoreboard.hbs`,
      title: "Averis | Highest DMG",
      width: 770,
      height: 680,
      resizable: true,
      popOut: true
    });
  }

  _editorOpen = false;
  _editingId = null;
  _busy = false;

  getData(options = {}) {
    const context = super.getData(options);
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
      busy: this._busy
    };
  }

  activateListeners(html) {
    super.activateListeners(html);
    activeWindows.add(this);
    const container = html?.[0];
    const root = container?.matches?.(".averis-hdmg")
      ? container : container?.querySelector?.(".averis-hdmg");
    if (!root) return;

    root.addEventListener("click", (event) => {
      const target = event.target.closest("[data-hdmg-action]");
      if (!target || !root.contains(target)) return;
      const action = target.dataset.hdmgAction;
      if (action === "add") return this._openEditor();
      if (action === "edit") return this._openEditor(target.dataset.recordId);
      if (action === "cancel") return this._closeEditor();
      if (action === "delete") void this._deleteRecord();
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
    const Picker = FilePicker;
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
      picker.render(true);
    } catch (error) {
      console.error(`${MODULE_ID} | Cannot browse token art`, error);
      ui.notifications.error("Could not open the image picker.");
    }
  }

  async close(options = {}) {
    activeWindows.delete(this);
    return super.close(options);
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
    const safeName = record.name.replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
    const confirmed = await Dialog.confirm({
      title: "Delete Highest DMG Record",
      content: `<p>Remove the record for <strong>${safeName}</strong>?</p>`,
      yes: () => true,
      no: () => false,
      defaultYes: false
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

function openScoreboard() {
  if (!scoreboardWindow) scoreboardWindow = new HighestDmgApp();
  if (scoreboardWindow.rendered) {
    scoreboardWindow.bringToTop();
    return scoreboardWindow;
  }
  return scoreboardWindow.render(true);
}

/**
 * Foundry V11 uses an ARRAY of Scene Controls, with a layer and a tools
 * array. The trophy icon appears in the left Scene Controls toolbar.
 * Use TokenLayer so selecting this UI group cannot activate a missing layer.
 */
Hooks.on("getSceneControlButtons", (controls) => {
  if (!Array.isArray(controls)) return;
  if (controls.some((control) => control.name === "averisHighestDmg")) return;

  controls.push({
    name: "averisHighestDmg",
    title: "Highest DMG",
    layer: "TokenLayer",
    icon: "fas fa-trophy",
    visible: true,  // Players and GM can access the leaderboard.
    activeTool: "open",
    tools: [{
      name: "open",
      title: "Open Highest DMG",
      icon: "fas fa-trophy",
      visible: true,
      button: true,
      onClick: () => openScoreboard()
    }]
  });
});

/**
 * In V11 clicking the left control icon normally only selects its palette.
 * Also open the scoreboard on that click, not only on the adjacent tool.
 * Bind to Foundry's rendered Scene Controls node, not the right sidebar.
 */
Hooks.on("renderSceneControls", (_app, html) => {
  const icon = html.find('[data-control="averisHighestDmg"]');
  icon.off("click.averisHighestDmg").on("click.averisHighestDmg", () => {
    openScoreboard();
  });
});

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "records", {
    name: "Highest DMG Records",
    hint: "GM-maintained Highest Damage records.",
    scope: "world",
    config: false,
    type: Array,
    default: [],
    onChange: () => {
      for (const app of activeWindows) {
        if (app.rendered && !app._busy) app.render(false);
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
