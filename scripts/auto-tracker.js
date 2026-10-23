/**
 * Highest DMG — optional applied-damage tracking for Foundry V14 / dnd5e.
 *
 * IMPORTANT: never use damage rolls, preApplyDamage, hp guesses, or
 * midi-qol.DamageRollComplete as a record trigger. Damage must have been
 * applied already, and a player-character attacker must be identifiable.
 *
 * The GM owns writes; other clients forward the verified post-apply event.
 * Existing scoreboard records, art, manual editing and world settings are
 * not replaced.
 */
const DMG_MODULE = "averis-highest-dmg";
const DMG_SOCKET = `module.${DMG_MODULE}`;
const DMG_LIMIT = 999_999_999;
let damageWriteQueue = Promise.resolve();
const recentEvents = new Map();

function trackingEnabled() {
  return game.system?.id === "dnd5e"
    && Boolean(game.settings.get(DMG_MODULE, "autoTracking"));
}

function primaryGM() {
  const active = [...(game.users?.contents ?? [])]
    .filter((user) => user.active && user.isGM)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return active[0] ?? (game.user?.isGM ? game.user : null);
}

function isPrimaryGM() {
  const gm = primaryGM();
  return Boolean(game.user?.isGM && gm?.id === game.user.id);
}

function normalizedImage(value) {
  const path = String(value ?? "").trim();
  if (!path || path.length > 2048 || /[\r\n<>]/.test(path)
      || /^(?:javascript|data|file|vbscript):/i.test(path)) return "";
  return path;
}

function actorIdOf(source) {
  if (!source) return "";
  // Do not treat the target actor as the attacker if the origin is missing.
  const actor = source.actor ?? (source.type === "character" || source.type === "npc" ? source : null)
    ?? (source.parent?.type === "character" || source.parent?.type === "npc" ? source.parent : null);
  return String(actor?.id ?? "");
}

function actorFromMessage(messageId) {
  const message = messageId && game.messages?.get(String(messageId));
  if (!message) return null;
  return message.actor ?? game.actors?.get(message.speaker?.actor) ?? null;
}

function normalizeAmount(amount) {
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return 0;
  const result = Math.floor(amount);
  return Number.isSafeInteger(result) && result <= DMG_LIMIT ? result : 0;
}

function sourceFromOptions(options) {
  const o = options ?? {};
  const messageId = o.messageId ?? o.chatMessage?.id ?? o.message?.id ?? "";
  const byMessage = actorFromMessage(messageId);
  const activity = o.activity ?? o.item?.activity;
  const byItem = activity?.item?.parent ?? o.item?.parent;
  // Explicit origin fields only; never fall back to the actor being damaged.
  const sourceActor = byMessage ?? activity?.actor ?? byItem;
  return { sourceId: actorIdOf(sourceActor), messageId: String(messageId) };
}

function issueAppliedDamage(sourceId, target, damage, messageId = "", source = "") {
  if (!trackingEnabled()) return;
  const amount = normalizeAmount(damage);
  const actorId = String(sourceId ?? "");
  const targetId = String(target?.id ?? target?.actor?.id ?? "");
  const targetUuid = String(target?.uuid ?? target?.actor?.uuid ?? targetId);
  if (!amount || !actorId || !targetId || actorId === targetId) return;

  const payload = {
    type: "appliedDamage",
    actorId,
    targetId,
    targetUuid,
    amount,
    messageId: String(messageId || ""),
    source: String(source)
  };

  if (isPrimaryGM()) {
    queueAppliedDamage(payload, true);
  } else if (primaryGM() && payload.messageId) {
    // Only bridge events with a resolvable chat message. The GM re-checks
    // the message actor independently; arbitrary player requests are ignored.
    game.socket?.emit(DMG_SOCKET, payload);
  }
}

function queueAppliedDamage(payload, local = false) {
  if (!isPrimaryGM() || !trackingEnabled() || payload?.type !== "appliedDamage") return;

  const actorId = String(payload.actorId ?? "");
  const targetId = String(payload.targetId ?? "");
  const amount = normalizeAmount(payload.amount);
  const messageId = String(payload.messageId ?? "");
  const attacker = game.actors?.get(actorId);
  if (!attacker || attacker.type !== "character" || attacker.hasPlayerOwner === false) return;
  if (!targetId || actorId === targetId || !amount) return;

  if (!local) {
    // Remote events must have proof of attribution in an existing message.
    const fromMessage = actorFromMessage(messageId);
    if (!fromMessage || actorIdOf(fromMessage) !== actorId) return;
  } else if (messageId) {
    // A known chat message and an inferred actor must agree.
    const fromMessage = actorFromMessage(messageId);
    if (fromMessage && actorIdOf(fromMessage) !== actorId) return;
  }

  const key = [messageId || payload.source, actorId, payload.targetUuid || targetId, amount].join("|");
  const now = Date.now();
  for (const [eventKey, time] of recentEvents) {
    if (now - time > 8000) recentEvents.delete(eventKey);
  }
  if (recentEvents.has(key)) return;
  recentEvents.set(key, now);
  if (recentEvents.size > 250) recentEvents.delete(recentEvents.keys().next().value);

  damageWriteQueue = damageWriteQueue.then(async () => {
    if (!isPrimaryGM() || !trackingEnabled()) return;
    const existing = game.settings.get(DMG_MODULE, "records");
    const records = Array.isArray(existing) ? [...existing] : [];
    const index = records.findIndex((record) => record?.actorId === actorId
      || (record?.name && String(record.name).trim().toLocaleLowerCase()
        === String(attacker.name).trim().toLocaleLowerCase()));

    const oldRecord = index >= 0 ? records[index] : null;
    const oldDamage = Number(oldRecord?.damage) || 0;
    if (amount <= oldDamage) return;

    const image = normalizedImage(oldRecord?.img)
      || normalizedImage(attacker.prototypeToken?.texture?.src)
      || normalizedImage(attacker.img);
    const record = {
      id: oldRecord?.id || foundry.utils.randomID(),
      name: String(attacker.name ?? "Character").slice(0, 48),
      damage: amount,
      actorId,
      img: image
    };
    if (index >= 0) records[index] = { ...oldRecord, ...record };
    else records.push(record);
    await game.settings.set(DMG_MODULE, "records", records);
    if (game.user?.isGM) {
      ui.notifications.info(`Highest DMG: ${record.name} — ${amount} applied damage.`);
    }
  }).catch((error) => {
    recentEvents.delete(key);
    console.error(`${DMG_MODULE} | Applied-damage tracking failed`, error);
  });
}

Hooks.on("dnd5e.applyDamage", (target, amount, options) => {
  const { sourceId, messageId } = sourceFromOptions(options);
  issueAppliedDamage(sourceId, target, amount, messageId, "dnd5e");
});

// Midi-QOL's per-target "damaged" hook occurs AFTER damage was applied.
// hpDamage + tempDamage reflects actual HP/temporary-HP damage on that target.
// Do not use preTargetDamageApplication, rolls, or totalDamage here.
Hooks.on("midi-qol.damaged", (targetToken, details) => {
  const workflow = details?.workflow;
  const damageItem = details?.damageItem;
  const hp = Number(damageItem?.hpDamage);
  const temp = Number(damageItem?.tempDamage);
  if (!Number.isFinite(hp) && !Number.isFinite(temp)) return;

  const amount = Math.max(0, Number.isFinite(hp) ? hp : 0)
    + Math.max(0, Number.isFinite(temp) ? temp : 0);
  const actor = workflow?.actor ?? details?.item?.parent;
  const target = targetToken?.actor ?? targetToken?.document?.actor;
  const messageId = workflow?.itemCardId ?? workflow?.chatMessage?.id ?? "";
  issueAppliedDamage(actorIdOf(actor), target, amount, messageId, "midi-qol");
});

Hooks.once("ready", () => {
  if (game.system?.id !== "dnd5e") return;
  game.socket?.on(DMG_SOCKET, (payload) => {
    if (payload?.type === "appliedDamage") queueAppliedDamage(payload, false);
  });
});
