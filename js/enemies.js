import * as THREE from 'three';
import { TS, ZOMBIE_SPEED, CREEPER_SPEED } from './config.js';
import { zombieTex, creeperTex } from './textures.js';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

const ZOMBIE_STOP = 1.55;  // zombies halt here, beside the car — visible and shootable
const ZOMBIE_REACH = 1.8;  // how close counts as a zombie "touch"

function buildZombie() {
  const g = new THREE.Group();
  const skin = lam(0x57a64e);
  const faceMat = [skin, skin, skin, skin, new THREE.MeshLambertMaterial({ map: zombieTex() }), skin];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.44, 0.44), faceMat);
  head.position.y = 1.32;
  const body = box(0.46, 0.6, 0.26, lam(0x2e7d5b)); body.position.y = 0.84;
  const armL = box(0.14, 0.14, 0.6, skin); armL.position.set(-0.2, 1.0, 0.35);
  const armR = armL.clone(); armR.position.x = 0.2;
  const legL = box(0.18, 0.54, 0.2, lam(0x3b4a8f)); legL.position.set(-0.13, 0.27, 0);
  const legR = legL.clone(); legR.position.x = 0.13;
  g.add(head, body, armL, armR, legL, legR);
  g.userData = { legL, legR, armL, armR };
  return g;
}

function buildCreeper() {
  const g = new THREE.Group();
  const tex = creeperTex();
  const skin = new THREE.MeshLambertMaterial({ map: tex });
  const plain = new THREE.MeshLambertMaterial({ map: tex });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), [plain, plain, plain, plain, skin, plain]);
  head.position.y = 1.28;
  const body = box(0.42, 0.72, 0.28, plain); body.position.y = 0.66;
  const legs = [];
  for (const [x, z] of [[-0.13, 0.18], [0.13, 0.18], [-0.13, -0.18], [0.13, -0.18]]) {
    const l = box(0.2, 0.3, 0.24, plain); l.position.set(x, 0.15, z);
    g.add(l); legs.push(l);
  }
  g.add(head, body);
  g.userData = { legs, mats: [skin, plain] };
  return g;
}

export class Enemies {
  constructor(scene, world, levelCfg) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.field = null;      // BFS distance field from player
    this.fieldTimer = 0;
    const { n, mid } = world.maze;
    const spots = [];
    for (let z = 1; z < n - 1; z++) for (let x = 1; x < n - 1; x++) {
      if (world.typeAt(x, z) !== 0) continue;
      if (Math.abs(x - mid) <= 3 && Math.abs(z - mid) <= 3) continue;
      if (Math.hypot(x - 1, z - 1) < n * 0.45) continue; // far from spawn
      spots.push([x, z]);
    }
    const take = () => spots.length ? spots.splice((Math.random() * spots.length) | 0, 1)[0] : null;
    for (let i = 0; i < levelCfg.zombies; i++) {
      const s = take(); if (!s) break;
      this.add('zombie', s[0], s[1]);
    }
    for (let i = 0; i < levelCfg.creepers; i++) {
      const s = take(); if (!s) break;
      this.add('creeper', s[0], s[1]);
    }
  }

  add(kind, tx, tz) {
    const group = kind === 'zombie' ? buildZombie() : buildCreeper();
    group.position.copy(this.world.centerOf(tx, tz));
    this.scene.add(group);
    this.list.push({
      kind, group, hp: kind === 'zombie' ? 2 : 2.5,
      speed: kind === 'zombie' ? ZOMBIE_SPEED : CREEPER_SPEED,
      stun: 0, walkT: 0, wanderDir: null, wanderT: 0,
      fuse: -1, groanT: Math.random() * 4 + 2, dead: false,
    });
  }

  computeField(playerPos) {
    const { n } = this.world.maze;
    const [px, pz] = this.world.tileAt(playerPos.x, playerPos.z);
    const f = new Uint16Array(n * n).fill(65535);
    const q = [[px, pz]];
    if (px < 0 || pz < 0 || px >= n || pz >= n) { this.field = f; return; }
    f[pz * n + px] = 0;
    while (q.length) {
      const [x, z] = q.shift();
      const d = f[z * n + x] + 1;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
        if (this.world.solid(nx, nz)) continue;
        if (f[nz * n + nx] <= d) continue;
        f[nz * n + nx] = d;
        q.push([nx, nz]);
      }
    }
    this.field = f;
  }

  // returns events array for main to react to (sounds/damage)
  update(dt, time, playerPos, drillPoint, fx) {
    const events = [];
    this.fieldTimer -= dt;
    if (this.fieldTimer <= 0) { this.computeField(playerPos); this.fieldTimer = 0.4; }
    const { n } = this.world.maze;
    for (const e of this.list) {
      if (e.dead) continue;
      const p = e.group.position;
      const distToPlayer = p.distanceTo(playerPos);

      // drill kills / triggers
      if (drillPoint && drillPoint.distanceTo(p) < 0.95) {
        if (e.kind === 'creeper' && e.fuse < 0) e.fuse = 0.5; // drilling a creeper is spicy
        else if (e.kind === 'zombie') { this.kill(e, fx); events.push({ type: 'zombieDie' }); continue; }
      }

      if (e.stun > 0) {
        e.stun -= dt;
        e.group.rotation.z = Math.sin(time * 20) * 0.12;
        continue;
      }
      e.group.rotation.z = 0;

      // creeper fuse
      if (e.kind === 'creeper' && e.fuse >= 0) {
        e.fuse -= dt;
        const flash = Math.floor(e.fuse * 10) % 2 === 0;
        for (const m of e.group.userData.mats) m.color.setScalar(flash ? 3 : 1);
        const s = 1 + (1.15 - Math.max(e.fuse, 0)) * 0.25;
        e.group.scale.set(s, s, s);
        if (e.fuse <= 0) {
          this.kill(e, fx, true);
          events.push({ type: 'creeperBoom', pos: p.clone() });
        }
        continue; // stands still while fusing
      }

      // movement: chase via distance field, else wander
      const [tx, tz] = this.world.tileAt(p.x, p.z);
      const myIdx = tz * n + tx;
      const myDist = this.field ? this.field[myIdx] : 65535;
      let dir = null;
      const chaseRange = e.kind === 'creeper' ? 10 : 8;
      if (e.kind === 'zombie' && myDist < chaseRange && distToPlayer <= ZOMBIE_STOP) {
        // hold position NEXT to the car: face it and flail arms so the kid
        // can see exactly where to aim
        const f = playerPos.clone().sub(p);
        e.group.rotation.y = Math.atan2(f.x, f.z);
        e.walkT += dt * 14;
        const flail = Math.sin(e.walkT) * 0.6;
        e.group.userData.armL.rotation.x = -0.5 + flail;
        e.group.userData.armR.rotation.x = -0.5 - flail;
        e.groanT -= dt;
        if (e.groanT <= 0) { e.groanT = 2.5 + Math.random() * 3; events.push({ type: 'groan', dist: distToPlayer }); }
      } else if (myDist < chaseRange) {
        let best = myDist, bx = 0, bz = 0;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = (tz + dz) * n + (tx + dx);
          if (this.field[ni] < best) { best = this.field[ni]; bx = dx; bz = dz; }
        }
        if (bx || bz) {
          const target = this.world.centerOf(tx + bx, tz + bz);
          dir = target.sub(p); dir.y = 0;
          if (distToPlayer < TS * 1.6) { dir = playerPos.clone().sub(p); dir.y = 0; } // home in when close
        } else if (distToPlayer < TS * 1.4) { dir = playerPos.clone().sub(p); dir.y = 0; }
        if (e.kind === 'zombie') { e.groanT -= dt; if (e.groanT <= 0) { e.groanT = 2.5 + Math.random() * 3; events.push({ type: 'groan', dist: distToPlayer }); } }
      } else {
        e.wanderT -= dt;
        if (e.wanderT <= 0 || !e.wanderDir) {
          const opts = [];
          for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
            if (!this.world.solid(tx + dx, tz + dz)) opts.push(new THREE.Vector3(dx, 0, dz));
          e.wanderDir = opts.length ? opts[(Math.random() * opts.length) | 0] : new THREE.Vector3();
          e.wanderT = 0.8 + Math.random() * 1.5;
        }
        dir = e.wanderDir.clone();
      }

      if (dir && dir.lengthSq() > 0.001) {
        dir.normalize();
        const step = dir.multiplyScalar(e.speed * dt * (myDist < chaseRange ? 1 : 0.5));
        const nx = p.x + step.x, nz = p.z + step.z;
        const [ntx, ntz] = this.world.tileAt(nx + Math.sign(step.x) * 0.3, p.z);
        if (!this.world.solid(ntx, ntz)) p.x = nx;
        const [ntx2, ntz2] = this.world.tileAt(p.x, nz + Math.sign(step.z) * 0.3);
        if (!this.world.solid(ntx2, ntz2)) p.z = nz;
        e.group.rotation.y = Math.atan2(dir.x, dir.z);
        e.walkT += dt * e.speed * 2.4;
        const sw = Math.sin(e.walkT) * 0.5;
        if (e.kind === 'zombie') {
          e.group.userData.legL.rotation.x = sw; e.group.userData.legR.rotation.x = -sw;
        } else {
          e.group.userData.legs.forEach((l, i) => l.rotation.x = (i % 2 ? sw : -sw));
        }
      }

      // creeper starts fuse near player
      if (e.kind === 'creeper' && distToPlayer < TS * 1.35 && e.fuse < 0) {
        e.fuse = 1.15;
        events.push({ type: 'hiss' });
      }
      // zombie touch hurts (they lunge from their standing spot)
      if (e.kind === 'zombie' && distToPlayer < ZOMBIE_REACH) {
        events.push({ type: 'zombieHit', from: p.clone() });
      }
    }
    // keep monsters from piling onto the same spot
    for (let a = 0; a < this.list.length; a++) {
      const ea = this.list[a];
      if (ea.dead) continue;
      for (let b = a + 1; b < this.list.length; b++) {
        const eb = this.list[b];
        if (eb.dead) continue;
        const pa = ea.group.position, pb = eb.group.position;
        const dx = pb.x - pa.x, dz = pb.z - pa.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.85 || d < 0.001) continue;
        const push = (0.85 - d) / d * 0.5;
        pa.x -= dx * push; pa.z -= dz * push;
        pb.x += dx * push; pb.z += dz * push;
      }
    }
    this.list = this.list.filter(e => !e.dead);
    return events;
  }

  // weapon hit; returns true if it killed
  damage(e, dmg, stun, fx) {
    e.hp -= dmg;
    if (stun) e.stun = Math.max(e.stun, stun);
    if (e.hp <= 0) { this.kill(e, fx); return true; }
    return false;
  }

  kill(e, fx, silent = false) {
    e.dead = true;
    this.scene.remove(e.group);
    if (!silent && fx) {
      const c = e.kind === 'zombie' ? 0x66cc55 : 0x77dd66;
      fx.chunkBurst(e.group.position.x, 0.8, e.group.position.z, c, 16, 4);
    }
  }

  dispose() { for (const e of this.list) this.scene.remove(e.group); this.list = []; }
}
