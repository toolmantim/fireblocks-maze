import * as THREE from 'three';
import { LEVELS, ARMORS, WEAPONS, MAX_HP, TS, PEOPLE_PER_JAIL } from './config.js';
import { genMaze } from './maze.js';
import { LevelWorld } from './level.js';
import { Vehicle } from './vehicle.js';
import { Enemies } from './enemies.js';
import { Projectiles } from './weapons.js';
import { Particles } from './particles.js';
import { UI } from './ui.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { SFX, unlockAudio, setMuted, isMuted, engine } from './audio.js';

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7ec8f0);
scene.fog = new THREE.Fog(0x7ec8f0, 38, 85);
const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 220);
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a5f3a, 1.05));
const sun = new THREE.DirectionalLight(0xfff2cc, 1.7);
sun.position.set(24, 38, 14);
scene.add(sun);

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ---------- game state ----------
const G = {
  state: 'title', level: 1, save: loadSave(),
  world: null, enemies: null, projectiles: null,
  hp: MAX_HP, invuln: 0, fireCd: 0, fireTick: 0, shake: 0,
  time: 0, spawnT: 0, objKey: '', lockedMsgT: 0, grindT: 0,
};
const fx = new Particles(scene);
const vehicle = new Vehicle(scene);
vehicle.group.visible = false;
setMuted(G.save.muted);

// ---------- UI ----------
const ui = new UI({
  play: () => startLevel(G.save.started ? G.save.level : 1),
  startLevel: (n) => startLevel(n),
  nextLevel: () => startLevel(Math.min(G.level + 1, 10)),
  toMenu: () => toMenu(),
  resume: () => { G.state = 'playing'; ui.showOnly(null); },
  garageToggle: () => garageToggle(),
  loadout: (kind, id) => {
    G.save[kind] = id;
    vehicle.applyLoadout(G.save.color, G.save.armor, G.save.weapon);
    SFX.click(); writeSave(G.save); ui.syncGarage(G.save);
  },
  toggleMute: () => {
    G.save.muted = !isMuted(); setMuted(G.save.muted);
    ui.setMuteIcons(G.save.muted); writeSave(G.save); SFX.click();
  },
  saveNow: () => { writeSave(G.save); ui.toast('Saved! ✅'); SFX.click(); },
  reset: () => {
    if (!confirm('Start over? This erases your saved game!')) return;
    clearSave(); G.save = loadSave(); setMuted(G.save.muted);
    ui.buildLevelGrid(G.save); ui.setMuteIcons(G.save.muted); ui.toast('Fresh start! 🌟');
  },
});
ui.setMuteIcons(G.save.muted);
addEventListener('pointerdown', unlockAudio, { once: false });
addEventListener('keydown', unlockAudio, { once: false });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state === 'playing') { G.state = 'paused'; ui.showOnly('pause-screen'); }
});

// ---------- level lifecycle ----------
function startLevel(n) {
  G.level = n;
  G.save.level = n; G.save.started = true; writeSave(G.save);
  if (G.world) G.world.dispose();
  if (G.enemies) G.enemies.dispose();
  if (G.projectiles) G.projectiles.dispose();
  const maze = genMaze(n);
  G.world = new LevelWorld(scene, maze);
  G.enemies = new Enemies(scene, G.world, maze.cfg);
  G.projectiles = new Projectiles(scene);
  vehicle.applyLoadout(G.save.color, G.save.armor, G.save.weapon);
  vehicle.placeAt(G.world.centerOf(maze.spawn[0], maze.spawn[1]));
  vehicle.heading = Math.PI; // face north, into the maze
  vehicle.group.rotation.y = Math.PI;
  vehicle.group.visible = true;
  G.hp = MAX_HP; G.invuln = 0; G.shake = 0; G.spawnT = 0.8; G.objKey = '';
  ui.initMinimap(G.world);
  ui.setLevel(n); ui.setKey(false); ui.setHearts(G.hp); ui.setRescued(G.save.rescued);
  ui.showOnly(null);
  document.getElementById('hud').classList.remove('hidden');
  G.state = 'playing';
  SFX.spawnIn();
  if (n === 10) { ui.setBanner('👹 MONSTER LEVEL! Watch out!'); G.objKey = 'boss-warn'; setTimeout(() => { G.objKey = ''; }, 3000); }
}

function toMenu() {
  G.state = 'title';
  document.getElementById('hud').classList.add('hidden');
  vehicle.group.visible = false;
  ui.buildLevelGrid(G.save);
  ui.showOnly('title-screen');
  engine(0);
}

function garageToggle() {
  if (G.state === 'playing') { G.state = 'garage'; ui.syncGarage(G.save); ui.showOnly('garage'); SFX.click(); engine(0); }
  else if (G.state === 'garage') { G.state = 'playing'; ui.showOnly(null); SFX.click(); }
}

function levelComplete() {
  G.state = 'done';
  engine(0);
  fx.confetti(vehicle.pos.x, 1, vehicle.pos.z);
  G.save.unlocked = Math.max(G.save.unlocked, Math.min(G.level + 1, 10));
  G.save.level = Math.min(G.level + 1, 10);
  writeSave(G.save);
  if (G.level >= 10) {
    SFX.fanfare();
    document.getElementById('win-text').textContent = `You beat ALL 10 mazes and rescued ${G.save.rescued} people!`;
    ui.showOnly('win-screen');
  } else {
    SFX.jingle();
    document.getElementById('done-title').textContent = `🎉 LEVEL ${G.level} DONE! 🎉`;
    document.getElementById('done-text').textContent = `You rescued ${PEOPLE_PER_JAIL} people! ⭐ Total: ${G.save.rescued}`;
    ui.showOnly('level-done');
  }
}

function hurt(amount, fromPos) {
  if (G.invuln > 0 || G.state !== 'playing') return;
  const a = Math.max(0.5, Math.round(amount * vehicle.armor.protect * 2) / 2);
  G.hp -= a; G.invuln = 1.3; G.shake = Math.max(G.shake, 0.3);
  SFX.hurt();
  ui.setHearts(G.hp);
  if (fromPos) {
    const push = vehicle.pos.clone().sub(fromPos).setY(0).normalize().multiplyScalar(7);
    vehicle.vel.add(push);
  }
  if (G.hp <= 0) {
    fx.explosion(vehicle.pos.x, 0.8, vehicle.pos.z);
    SFX.boom();
    vehicle.placeAt(G.world.centerOf(G.world.maze.spawn[0], G.world.maze.spawn[1]));
    G.hp = MAX_HP; G.invuln = 2.5; G.spawnT = 0.8;
    ui.setHearts(G.hp);
    ui.toast('💪 Try again! You can do it!');
  }
}

// ---------- objectives ----------
function objective() {
  const w = G.world;
  if (!w.guard.bumped) return { key: 'guard', pos: w.guard.group.position, color: 0xffd60a, text: '🚓 Bump the friendly guard!' };
  if (!w.keyTaken) return { key: 'key', pos: w.keyPickup.position, color: 0xffd60a, text: '🗝️ Grab the key!' };
  if (!w.jailOpen) return { key: 'jail', pos: w.doorWorld, color: 0xbf5af2, text: '🔓 Free the people!' };
  return { key: 'exit', pos: w.portalWorld, color: 0x34ff88, text: '🌀 Go to the glowing exit!' };
}

// ---------- main update ----------
function update(dt) {
  G.time += dt;
  const w = G.world;
  const input = ui.getMove();
  const speedFrac = vehicle.update(dt, input, w);
  engine(G.spawnT > 0 ? 0 : speedFrac);

  // spawn drop-in
  if (G.spawnT > 0) {
    G.spawnT -= dt;
    const t = Math.max(G.spawnT, 0) / 0.8;
    vehicle.group.position.y = t * t * 7;
    if (G.spawnT <= 0) {
      SFX.thump();
      fx.chunkBurst(vehicle.pos.x, 0.3, vehicle.pos.z, 0x8a7a5a, 12, 3);
    }
  }

  // drill
  const drillResult = vehicle.updateDrill(dt, w);
  const fp = vehicle.frontPoint(1.15);
  if (drillResult === 'grind') {
    G.grindT -= dt;
    if (G.grindT <= 0) { SFX.grind(); G.grindT = 0.09; }
    fx.sparkBurst(fp.x, 0.7, fp.z, 0xffcc66, 2, 2);
    G.shake = Math.max(G.shake, 0.06);
  } else if (drillResult === 'break') {
    SFX.breakBlock();
    fx.chunkBurst(fp.x, 1, fp.z, 0x9a6b3f, 18, 5);
    G.shake = Math.max(G.shake, 0.2);
    ui.redrawMinimapStatic(w);
  }

  // enemies
  const ev = G.enemies.update(dt, G.time, vehicle.pos, fp, fx);
  for (const e of ev) {
    if (e.type === 'zombieHit') hurt(1, e.from);
    else if (e.type === 'zombieDie' || e.type === 'monsterDie') SFX.zap();
    else if (e.type === 'groan') { if (e.dist < 16) SFX.groan(); }
    else if (e.type === 'hiss') SFX.hiss();
    else if (e.type === 'creeperBoom') {
      G.projectiles.explode(e.pos, w, G.enemies, fx, []);
      SFX.boom(); G.shake = Math.max(G.shake, 0.6);
      if (vehicle.pos.distanceTo(e.pos) < 3.4) hurt(2.5, e.pos);
      ui.redrawMinimapStatic(w);
    }
  }

  // firing
  G.fireCd -= dt;
  if (ui.firing && G.fireCd <= 0 && G.spawnT <= 0) {
    const origin = vehicle.frontPoint(1.25); origin.y = 0.85;
    G.projectiles.fire(origin, vehicle.forward(), vehicle.weapon);
    G.fireCd = vehicle.weapon.cd;
    if (vehicle.weapon.douse) SFX.splash(); else if (vehicle.weapon.blast) SFX.thump(); else SFX.pew();
  }
  const pev = G.projectiles.update(dt, w, G.enemies, fx);
  for (const e of pev) {
    if (e.type === 'boom') { SFX.boom(); G.shake = Math.max(G.shake, 0.35); ui.redrawMinimapStatic(w); }
    else if (e.type === 'douse') { SFX.sizzle(); ui.redrawMinimapStatic(w); }
    else if (e.type === 'monsterDie') SFX.zap();
  }

  // fire tiles burn
  G.fireTick -= dt;
  if (w.fireAtWorld(vehicle.pos.x, vehicle.pos.z) && G.fireTick <= 0) {
    G.fireTick = 0.25;
    if (!vehicle.armor.fireproof) { hurt(0.5); fx.sparkBurst(vehicle.pos.x, 0.9, vehicle.pos.z, 0xff6611, 8, 3); }
  }

  // guard bump -> key drop
  const guard = w.guard;
  if (!guard.bumped && vehicle.pos.distanceTo(guard.group.position) < 1.35) {
    guard.bumped = true;
    guard.key.visible = false;
    w.keyPickup.visible = true;
    w.keyPickup.position.copy(guard.group.position).setY(0.75);
    SFX.boing();
    fx.hearts(guard.group.position.x, 1.6, guard.group.position.z);
  }
  // key pickup
  if (guard.bumped && !w.keyTaken) {
    const kp = w.keyPickup.position;
    if (Math.hypot(vehicle.pos.x - kp.x, vehicle.pos.z - kp.z) < 1.1) {
      w.keyTaken = true;
      w.keyPickup.visible = false;
      SFX.key();
      ui.setKey(true);
      fx.sparkBurst(kp.x, 1, kp.z, 0xffd60a, 20, 3.5);
    }
  }
  // open jail
  if (w.keyTaken && !w.jailOpen && vehicle.pos.distanceTo(w.doorWorld) < 2.3) {
    w.openJail();
    SFX.jailOpen();
    setTimeout(() => SFX.cheer(), 350);
    const c = w.centerOf(w.maze.mid, w.maze.mid);
    fx.hearts(c.x, 1.5, c.z);
    fx.confetti(c.x, 0.5, c.z);
    G.save.rescued += PEOPLE_PER_JAIL;
    writeSave(G.save);
    ui.setRescued(G.save.rescued);
    setTimeout(() => { w.unlockPortal(); SFX.portal(); ui.redrawMinimapStatic(w); }, 900);
  }
  // portal
  const pd = Math.hypot(vehicle.pos.x - w.portalWorld.x, vehicle.pos.z - w.portalWorld.z);
  G.lockedMsgT -= dt;
  if (pd < 1.2) {
    if (w.portalUnlocked) { levelComplete(); return; }
    if (G.lockedMsgT <= 0) { G.lockedMsgT = 2.5; SFX.locked(); ui.setBanner('🔒 Free the people first!'); G.objKey = 'locked-msg'; setTimeout(() => { G.objKey = ''; }, 2500); }
  }

  // objective banner + beacon
  const obj = objective();
  if (obj.key !== G.objKey && G.objKey !== 'locked-msg' && G.objKey !== 'boss-warn') {
    G.objKey = obj.key;
    ui.setBanner(obj.text);
  }
  w.setBeacon(obj.pos, obj.color);

  // invulnerability blink
  G.invuln -= dt;
  vehicle.group.visible = G.invuln > 0 ? Math.floor(G.time * 12) % 2 === 0 : true;

  w.update(dt, G.time, vehicle.pos);
  fx.update(dt);
  ui.drawMinimap(w, vehicle.pos, vehicle.heading, G.enemies);
}

// ---------- camera ----------
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  if (!G.world) return;
  camTarget.set(vehicle.pos.x, 0, vehicle.pos.z);
  const want = new THREE.Vector3(camTarget.x, 16.5, camTarget.z + 11.5);
  camera.position.lerp(want, Math.min(1, 6 * dt));
  if (G.shake > 0) {
    G.shake = Math.max(0, G.shake - dt * 1.6);
    camera.position.x += (Math.random() - 0.5) * G.shake * 0.6;
    camera.position.y += (Math.random() - 0.5) * G.shake * 0.5;
  }
  camera.lookAt(camTarget.x, 0.5, camTarget.z - 0.6);
}

// ---------- loop ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (G.state === 'playing') update(dt);
  if (G.state !== 'title') { updateCamera(dt); renderer.render(scene, camera); }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
toMenu();

// debug hooks for screenshots/testing
window.FB = {
  G, vehicle, startLevel,
  tp: (tx, tz) => vehicle.placeAt(G.world.centerOf(tx, tz)),
  toGuard: () => { const p = G.world.guard.group.position; vehicle.placeAt(G.world.centerOf(...G.world.tileAt(p.x, p.z))); },
  toJail: () => vehicle.placeAt(G.world.doorWorld.clone().add(new THREE.Vector3(0, 0, 1.6))),
  toPortal: () => vehicle.placeAt(G.world.portalWorld.clone().add(new THREE.Vector3(-TS, 0, 0))),
  key: () => { G.world.guard.bumped = true; G.world.keyTaken = true; ui.setKey(true); },
};
console.log('FIREBOX MAZE ready');
