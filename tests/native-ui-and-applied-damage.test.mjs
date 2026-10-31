import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../scripts/auto-tracker.js",import.meta.url),"utf8");
const main = readFileSync(new URL("../scripts/highest-dmg.js",import.meta.url),"utf8");
const css = readFileSync(new URL("../styles/highest-dmg.css",import.meta.url),"utf8");
const tpl = readFileSync(new URL("../templates/scoreboard.hbs",import.meta.url),"utf8");
const manifest = JSON.parse(readFileSync(new URL("../module.json",import.meta.url),"utf8"));

function harness() {
  const handlers = new Map(), settings = new Map([["autoTracking",false],["records",[]]]);
  const gm = {id:"GM1",isGM:true,active:true};
  const pc = {id:"PC1",uuid:"Actor.PC1",name:"Rashira",type:"character",hasPlayerOwner:true,img:"icons/rashira.webp"};
  const npc = {id:"NPC1",uuid:"Actor.NPC1",name:"Goblin",type:"npc",hasPlayerOwner:false,img:"icons/goblin.webp"};
  const other = {id:"NPC2",uuid:"Actor.NPC2",name:"Orc",type:"npc",hasPlayerOwner:false};
  const actors = new Map([[pc.id,pc],[npc.id,npc],[other.id,other]]);
  const messages = new Map([
    ["m1",{actor:pc}], ["m2",{actor:pc}], ["m3",{actor:pc}], ["m4",{actor:npc}], ["m5",{actor:pc}]
  ]);
  const socketListeners = new Map(), notifications = [];
  let serial = 0;
  const sandbox = {
    console, Promise, Date,
    Hooks: {
      on(name,fn){handlers.set(name,fn);},
      once(name,fn){handlers.set(name,fn);}
    },
    foundry:{utils:{randomID:()=>`record${++serial}`}},
    ui:{notifications:{info:message=>notifications.push(message)}},
    game:{
      user:gm,users:{contents:[gm]},system:{id:"dnd5e",version:"6.0.6"},
      actors:{get:id=>actors.get(id)},messages:{get:id=>messages.get(id)},
      socket:{on:(name,fn)=>socketListeners.set(name,fn),emit(){}},
      settings:{
        get(_mod,key){return settings.get(key);},
        async set(_mod,key,value){settings.set(key,value);}
      }
    }
  };
  vm.runInNewContext(source,vm.createContext(sandbox),{filename:"auto-tracker.js"});
  handlers.get("ready")();
  return {handlers,settings,notifications,pc,npc,other,socketListeners,sandbox,
    async flush() {await new Promise(resolve=>setImmediate(resolve));},
    records(){return settings.get("records");},
    fire(name,...args){return handlers.get(name)(...args);}
  };
}

test("only applied events can create a record after tracking enabled",async()=>{
  const h=harness();
  h.fire("dnd5e.applyDamage",h.npc,30,{messageId:"m1"});
  await h.flush();
  assert.equal(h.records().length,0,"tracking is off by default");
  h.settings.set("autoTracking",true);
  h.fire("dnd5e.applyDamage",h.npc,30,{messageId:"m1"});
  await h.flush();
  assert.equal(h.records().length,1);
  assert.equal(h.records()[0].damage,30);
  assert.equal(h.records()[0].actorId,"PC1");
  assert.equal(h.records()[0].img,"icons/rashira.webp");
  h.fire("dnd5e.applyDamage",h.npc,12,{messageId:"m2"});
  await h.flush();
  assert.equal(h.records()[0].damage,30,"only highest personal hit saved");
  h.fire("dnd5e.applyDamage",h.npc,45,{messageId:"m3"});
  await h.flush();
  assert.equal(h.records()[0].damage,45);
  assert.equal(h.records().length,1);
});
test("healing, NPC attacker, self-damage and unattributed events are ignored",async()=>{
  const h=harness();h.settings.set("autoTracking",true);
  h.fire("dnd5e.applyDamage",h.npc,-10,{messageId:"m1"});
  h.fire("dnd5e.applyDamage",h.npc,0,{messageId:"m1"});
  h.fire("dnd5e.applyDamage",h.pc,10,{messageId:"m1"});
  h.fire("dnd5e.applyDamage",h.npc,77,{});
  h.fire("dnd5e.applyDamage",h.other,20,{messageId:"m4"});
  await h.flush();
  assert.equal(h.records().length,0);
});
test("Midi-QOL post-applied HP and temp HP values are added once",async()=>{
  const h=harness();h.settings.set("autoTracking",true);
  h.fire("midi-qol.damaged",{actor:h.npc},{
    workflow:{actor:h.pc,itemCardId:"m1"},
    damageItem:{hpDamage:18,tempDamage:5}
  });
  await h.flush();
  assert.equal(h.records()[0].damage,23);
  h.fire("dnd5e.applyDamage",h.npc,23,{messageId:"m1"});
  await h.flush();
  assert.equal(h.records().length,1,"same message/target amount deduplicated");
  h.fire("midi-qol.damaged",{actor:h.npc},{
    workflow:{actor:h.pc,itemCardId:"m2"},
    damageItem:{hpDamage:0,tempDamage:0}
  });
  await h.flush();
  assert.equal(h.records()[0].damage,23);
});
test("socket requests without attacker-matching chat attribution are rejected",async()=>{
  const h=harness();h.settings.set("autoTracking",true);
  const receive=h.socketListeners.get("module.averis-highest-dmg");
  assert.equal(typeof receive,"function");
  receive({type:"appliedDamage",actorId:"PC1",targetId:"NPC1",targetUuid:"Actor.NPC1",amount:100,messageId:"m4",source:"dnd5e"});
  receive({type:"appliedDamage",actorId:"PC1",targetId:"NPC1",targetUuid:"Actor.NPC1",amount:100,messageId:"missing",source:"dnd5e"});
  await h.flush();
  assert.equal(h.records().length,0);
  receive({type:"appliedDamage",actorId:"PC1",targetId:"NPC1",targetUuid:"Actor.NPC1",amount:20,messageId:"m5",source:"dnd5e"});
  await h.flush();
  assert.equal(h.records()[0].damage,20);
});

test("native Foundry V14 UI, GM controls and module-scoped CSS",()=>{
  assert.equal(manifest.version,"1.6.1");
  assert.equal(manifest.compatibility.verified,"14");
  assert.equal(manifest.relationships.systems[0].compatibility.verified,"6.0.6");
  assert.ok(main.includes("HandlebarsApplicationMixin(ApplicationV2)"));
  assert.ok(main.includes("frame: true") && main.includes("minimizable: true") && main.includes("resizable: true"));
  assert.ok(main.includes("if (controls[name]) return"));
  assert.ok(tpl.includes("{{#if canEdit}}"));
  assert.ok(tpl.includes('data-hdmg-action="toggle-tracking"'));
  assert.ok(css.includes(".averis-highest-dmg-window .window-content"));
  assert.ok(css.includes("@container hdmg-window"));
  assert.ok(!css.includes(".window-app button"));
  assert.ok(!css.includes("background: #11131d"));
});
