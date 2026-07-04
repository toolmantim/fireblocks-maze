import * as THREE from 'three';
import { TS, T_FLOOR, T_WALL, T_BREAK, T_BAR, T_DOOR, GUARD_SPEED, PEOPLE_PER_JAIL } from './config.js';
import { stoneTex, crackTex, fireTex, floorTex, guardFaceTex, personFaceTex } from './textures.js';

const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
const lam = (color, opts = {}) => new THREE.MeshLambertMaterial({ color, ...opts });

export class LevelWorld {
  constructor(scene, maze) {
    this.scene = scene;
    this.maze = maze;
    this.group = new THREE.Group();
    scene.add(this.group);
    const { n, t, at } = maze;

    // ---- floor ----
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(n * TS, n * TS),
      new THREE.MeshLambertMaterial({ map: floorTex(maze) })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(n * TS / 2, 0, n * TS / 2);
    this.group.add(floor);
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), lam(0x2a5c28));
    outside.rotation.x = -Math.PI / 2;
    outside.position.set(n * TS / 2, -0.05, n * TS / 2);
    this.group.add(outside);

    // ---- walls (instanced) ----
    // NOTE: keep all walls one block high — taller walls occlude the vehicle
    // near south-facing rows with this camera angle.
    const wallTiles = [];
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      if (t[at(x, z)] === T_WALL) wallTiles.push([x, z]);
    }
    const wallGeo = new THREE.BoxGeometry(TS, TS, TS);
    const wallMat = new THREE.MeshLambertMaterial({ map: stoneTex() });
    this.walls = new THREE.InstancedMesh(wallGeo, wallMat, wallTiles.length);
    this.walls.frustumCulled = false;
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    let i = 0;
    const rnd = maze.seedRnd;
    for (const [x, z] of wallTiles) {
      const border = x === 0 || z === 0 || x === n - 1 || z === n - 1;
      m4.makeTranslation((x + 0.5) * TS, TS / 2, (z + 0.5) * TS);
      this.walls.setMatrixAt(i, m4);
      const v = 0.82 + rnd() * 0.3;
      if (border) this.walls.setColorAt(i, col.setRGB(0.55, 0.62, 0.75));
      else this.walls.setColorAt(i, col.setRGB(v, v, v * 1.04));
      i++;
    }
    this.walls.instanceMatrix.needsUpdate = true;
    if (this.walls.instanceColor) this.walls.instanceColor.needsUpdate = true;
    this.group.add(this.walls);

    // ---- breakable cracked blocks (instanced, scale-0 to remove) ----
    this.breakIndex = new Map(); // tileIdx -> instance index
    const bGeo = new THREE.BoxGeometry(TS, TS, TS);
    const bMat = new THREE.MeshLambertMaterial({ map: crackTex() });
    this.breaks = new THREE.InstancedMesh(bGeo, bMat, Math.max(maze.breaks.length, 1));
    this.breaks.frustumCulled = false;
    maze.breaks.forEach(([x, z], bi) => {
      m4.makeTranslation((x + 0.5) * TS, TS / 2, (z + 0.5) * TS);
      this.breaks.setMatrixAt(bi, m4);
      this.breakIndex.set(at(x, z), bi);
    });
    this.breaks.instanceMatrix.needsUpdate = true;
    this.group.add(this.breaks);

    // ---- fire blocks ----
    this.fireTexture = fireTex();
    this.fires = new Map(); // tileIdx -> group
    for (const [x, z] of maze.fires) this.addFire(x, z);

    // ---- jail cage + door ----
    this.buildJail();
    this.buildPeople();
    this.buildGuard();
    this.buildPortal();

    // ---- objective beacon ----
    const bcGeo = new THREE.CylinderGeometry(0.35, 0.55, 26, 12, 1, true);
    this.beacon = new THREE.Mesh(bcGeo, new THREE.MeshBasicMaterial({
      color: 0xffcc33, transparent: true, opacity: 0.4, side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    this.beacon.position.y = 13;
    this.group.add(this.beacon);
  }

  centerOf(tx, tz) { return new THREE.Vector3((tx + 0.5) * TS, 0, (tz + 0.5) * TS); }
  tileAt(wx, wz) { return [Math.floor(wx / TS), Math.floor(wz / TS)]; }
  typeAt(tx, tz) {
    const { n, t, at } = this.maze;
    if (tx < 0 || tz < 0 || tx >= n || tz >= n) return T_WALL;
    return t[at(tx, tz)];
  }
  solid(tx, tz) {
    const ty = this.typeAt(tx, tz);
    if (ty === T_DOOR) return !this.jailOpen;
    return ty === T_WALL || ty === T_BREAK || ty === T_BAR;
  }

  addFire(x, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      map: this.fireTexture, transparent: true, side: THREE.DoubleSide,
      depthWrite: false, color: 0xffffff,
    });
    for (let k = 0; k < 2; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(TS * 0.95, TS * 1.1), mat);
      p.rotation.y = k * Math.PI / 2 + 0.4;
      p.position.y = TS * 0.55;
      g.add(p);
    }
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(TS * 0.55, 12),
      new THREE.MeshBasicMaterial({ color: 0xff6611, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.03;
    g.add(glow);
    g.position.copy(this.centerOf(x, z));
    this.group.add(g);
    this.fires.set(this.maze.at(x, z), g);
  }

  fireAtWorld(wx, wz) {
    const [tx, tz] = this.tileAt(wx, wz);
    return this.fires.has(this.maze.at(tx, tz));
  }

  douseAtWorld(wx, wz) { // returns center of doused fire or null
    const [tx, tz] = this.tileAt(wx, wz);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      const idx = this.maze.at(tx + dx, tz + dz);
      const g = this.fires.get(idx);
      if (g) {
        this.group.remove(g);
        this.fires.delete(idx);
        return g.position.clone();
      }
    }
    return null;
  }

  breakTileAt(tx, tz) { // cracked block -> floor; returns center or null
    const { t, at } = this.maze;
    const idx = at(tx, tz);
    if (t[idx] !== T_BREAK) return null;
    t[idx] = T_FLOOR;
    const bi = this.breakIndex.get(idx);
    if (bi !== undefined) {
      const m4 = new THREE.Matrix4().makeScale(0.001, 0.001, 0.001);
      this.breaks.setMatrixAt(bi, m4);
      this.breaks.instanceMatrix.needsUpdate = true;
    }
    return this.centerOf(tx, tz);
  }

  buildJail() {
    const { mid } = this.maze;
    this.jailOpen = false;
    const center = this.centerOf(mid, mid);
    const cage = new THREE.Group();
    cage.position.copy(center);
    const barMat = lam(0x8899aa);
    const barGeo = new THREE.CylinderGeometry(0.07, 0.07, 2.6, 6);
    const half = TS * 1.5; // cage is 3x3 tiles
    const addBar = (parent, x, z) => {
      const b = new THREE.Mesh(barGeo, barMat);
      b.position.set(x, 1.3, z);
      parent.add(b);
    };
    for (let d = -half; d <= half + 0.01; d += 0.75) {
      addBar(cage, d, -half); addBar(cage, -half, d); addBar(cage, half, d);
      if (Math.abs(d) > TS / 2) addBar(cage, d, half); // south side has the door gap
    }
    // top rails
    const railMat = lam(0x667788);
    for (const [w, dpos] of [[half * 2 + 0.2, [0, -half]], [half * 2 + 0.2, [0, half]]]) {
      const r = box(w, 0.16, 0.16, railMat); r.position.set(dpos[0], 2.6, dpos[1]); cage.add(r);
    }
    for (const dx of [-half, half]) {
      const r = box(0.16, 0.16, half * 2 + 0.2, railMat); r.position.set(dx, 2.6, 0); cage.add(r);
    }
    // sliding door (fills the gap on south side)
    this.jailDoor = new THREE.Group();
    this.jailDoor.position.set(0, 0, half);
    for (const dx of [-0.66, 0, 0.66]) addBar(this.jailDoor, dx, 0);
    const doorRail = box(TS, 0.14, 0.14, lam(0xffcc44));
    doorRail.position.y = 2.45;
    this.jailDoor.add(doorRail);
    cage.add(this.jailDoor);
    this.group.add(cage);
    this.doorWorld = this.centerOf(mid, mid + 1);
  }

  buildPeople() {
    const { mid } = this.maze;
    this.people = [];
    const shirt = [0xff6b6b, 0x4dabf7, 0xffd43b];
    const face = personFaceTex();
    for (let i = 0; i < PEOPLE_PER_JAIL; i++) {
      const p = new THREE.Group();
      const body = box(0.34, 0.44, 0.22, lam(shirt[i % 3]));
      body.position.y = 0.5;
      const headMat = [lam(0xffd9b3), lam(0xffd9b3), lam(0xffd9b3), lam(0xffd9b3), new THREE.MeshLambertMaterial({ map: face }), lam(0xffd9b3)];
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), headMat);
      head.position.y = 0.9;
      const hair = box(0.32, 0.1, 0.32, lam([0x5c3a21, 0x222222, 0xc98a2c][i % 3]));
      hair.position.y = 1.06;
      const legs = box(0.3, 0.28, 0.2, lam(0x39496b)); legs.position.y = 0.14;
      p.add(body, head, hair, legs);
      const a = (i / PEOPLE_PER_JAIL) * Math.PI * 2;
      p.position.copy(this.centerOf(mid, mid)).add(new THREE.Vector3(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45));
      p.rotation.y = Math.random() * Math.PI * 2;
      p.userData = { state: 'jailed', t: Math.random() * 9, phase: 0 };
      this.group.add(p);
      this.people.push(p);
    }
  }

  buildGuard() {
    const g = new THREE.Group();
    const body = box(0.5, 0.62, 0.3, lam(0x2f6fde));       // bright friendly blue
    body.position.y = 0.65;
    const badge = box(0.12, 0.14, 0.04, lam(0xffd700)); badge.position.set(0.13, 0.75, 0.17); 
    const faceMat = [lam(0xffd9b3), lam(0xffd9b3), lam(0xffd9b3), lam(0xffd9b3), new THREE.MeshLambertMaterial({ map: guardFaceTex() }), lam(0xffd9b3)];
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), faceMat);
    head.position.y = 1.18;
    const hat = box(0.42, 0.12, 0.42, lam(0x1d4fa8)); hat.position.y = 1.42;
    const brim = box(0.46, 0.05, 0.2, lam(0x163d85)); brim.position.set(0, 1.34, 0.16);
    const legs = box(0.44, 0.34, 0.26, lam(0x1a3866)); legs.position.y = 0.17;
    const armL = box(0.12, 0.5, 0.12, lam(0x2f6fde)); armL.position.set(-0.33, 0.68, 0);
    const armR = armL.clone(); armR.position.x = 0.33;
    g.add(body, badge, head, hat, brim, legs, armL, armR);
    g.userData = { armL, armR };
    // golden key floating above his head
    const key = this.makeKey();
    key.position.y = 1.9;
    g.add(key);
    const wp = this.maze.guardPath.map(([x, z]) => this.centerOf(x, z));
    g.position.copy(wp[0]);
    this.guard = { group: g, key, wp, wpIdx: 1, bumped: false, walkT: 0 };
    this.group.add(g);
    // dropped key pickup (hidden until bump)
    this.keyPickup = this.makeKey();
    this.keyPickup.visible = false;
    this.group.add(this.keyPickup);
    this.keyTaken = false;
  }

  makeKey() {
    const k = new THREE.Group();
    const gold = lam(0xffd700, { emissive: 0x664400 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 8, 14), gold);
    const stem = box(0.07, 0.34, 0.07, gold); stem.position.y = -0.3;
    const tooth1 = box(0.14, 0.06, 0.07, gold); tooth1.position.set(0.07, -0.42, 0);
    const tooth2 = tooth1.clone(); tooth2.position.y = -0.32;
    k.add(ring, stem, tooth1, tooth2);
    return k;
  }

  buildPortal() {
    const [ex, ez] = this.maze.exit;
    const g = new THREE.Group();
    g.position.copy(this.centerOf(ex, ez));
    this.portalRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.14, 10, 24),
      new THREE.MeshBasicMaterial({ color: 0x5560c8 })
    );
    this.portalRing.rotation.x = -Math.PI / 2;
    this.portalRing.position.y = 0.22;
    this.portalDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.82, 24),
      new THREE.MeshBasicMaterial({ color: 0x3a2a88, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.portalDisc.rotation.x = -Math.PI / 2;
    this.portalDisc.position.y = 0.14;
    g.add(this.portalRing, this.portalDisc);
    this.portal = g;
    this.portalUnlocked = false;
    this.portalWorld = g.position.clone();
    this.group.add(g);
  }

  unlockPortal() {
    this.portalUnlocked = true;
    this.portalRing.material.color.set(0x33ff88);
    this.portalDisc.material.color.set(0x00ffaa);
  }

  openJail() {
    this.jailOpen = true;
    for (const p of this.people) { p.userData.state = 'cheer'; p.userData.t = 0; }
  }

  setBeacon(worldPos, colorHex) {
    if (!worldPos) { this.beacon.visible = false; return; }
    this.beacon.visible = true;
    this.beacon.position.set(worldPos.x, 13, worldPos.z);
    this.beacon.material.color.set(colorHex);
  }

  update(dt, time, playerPos) {
    // fire animation: shared flipbook + flicker
    this.fireTexture.offset.x = (Math.floor(time * 10) % 4) * 0.25;
    for (const g of this.fires.values()) {
      const s = 1 + Math.sin(time * 9 + g.position.x * 3.1) * 0.08;
      g.scale.set(s, s, s);
    }
    // portal spin/pulse
    this.portalDisc.rotation.z += dt * (this.portalUnlocked ? 3 : 0.6);
    if (this.portalUnlocked) {
      const p = 1 + Math.sin(time * 5) * 0.08;
      this.portal.scale.set(p, 1, p);
    }
    // beacon pulse
    this.beacon.material.opacity = 0.3 + Math.sin(time * 4) * 0.15;
    this.beacon.rotation.y += dt * 1.5;
    // jail door slides up
    if (this.jailOpen && this.jailDoor.position.y < 2.3) this.jailDoor.position.y += dt * 3;
    // guard patrol / flee
    const gd = this.guard;
    if (!this.keyTaken) gd.key.rotation.y += dt * 2.5;
    this.keyPickup.rotation.y += dt * 3;
    this.keyPickup.position.y = 0.75 + Math.sin(time * 4) * 0.12;
    const speed = gd.bumped ? GUARD_SPEED * 2.2 : GUARD_SPEED;
    const target = gd.wp[gd.wpIdx];
    const d = new THREE.Vector3().subVectors(target, gd.group.position); d.y = 0;
    if (d.length() < 0.15) gd.wpIdx = (gd.wpIdx + (gd.bumped ? ((Math.random() * 3) | 0) + 1 : 1)) % gd.wp.length;
    else {
      d.normalize().multiplyScalar(speed * dt);
      gd.group.position.add(d);
      gd.group.rotation.y = Math.atan2(d.x, d.z);
    }
    gd.walkT += dt * speed * 3;
    const sw = Math.sin(gd.walkT) * (gd.bumped ? 1.2 : 0.4);
    gd.group.userData.armL.rotation.x = sw;
    gd.group.userData.armR.rotation.x = -sw;
    if (gd.bumped) { // arms up, waving happily
      gd.group.userData.armL.rotation.z = 2.6 + Math.sin(time * 10) * 0.3;
      gd.group.userData.armR.rotation.z = -2.6 - Math.sin(time * 10) * 0.3;
    }
    // people animations
    for (const p of this.people) {
      const u = p.userData;
      u.t += dt;
      if (u.state === 'jailed') {
        p.position.y = Math.abs(Math.sin(u.t * 2)) * 0.06;
      } else if (u.state === 'cheer') {
        p.position.y = Math.abs(Math.sin(u.t * 8)) * 0.45;
        p.rotation.y += dt * 3;
        if (u.t > 1.6) { u.state = 'leave'; u.target = this.doorWorld.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, TS * (1 + Math.random()))); }
      } else if (u.state === 'leave') {
        const d2 = new THREE.Vector3().subVectors(u.target, p.position); d2.y = 0;
        if (d2.length() < 0.2) { u.state = 'gone'; p.visible = false; }
        else {
          d2.normalize().multiplyScalar(2.6 * dt);
          p.position.add(d2);
          p.rotation.y = Math.atan2(d2.x, d2.z);
          p.position.y = Math.abs(Math.sin(u.t * 10)) * 0.12;
        }
      }
    }
  }

  dispose() { this.scene.remove(this.group); }
}
