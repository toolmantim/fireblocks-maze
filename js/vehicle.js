import * as THREE from 'three';
import { TS, ARMORS, WEAPONS, T_BREAK } from './config.js';

const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
const box = (w, h, d, mat) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);

export class Vehicle {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.radius = 0.62;
    this.group.scale.setScalar(1.14);
    this.drillHeat = new Map(); // tileIdx -> progress
    this.build();
  }

  build() {
    const g = this.group;
    while (g.children.length) g.remove(g.children[0]);

    this.bodyMat = lam(0xff3b30);
    // chassis + cabin
    const chassis = box(1.15, 0.42, 1.65, this.bodyMat); chassis.position.y = 0.42;
    const hood = box(0.95, 0.2, 0.5, this.bodyMat); hood.position.set(0, 0.68, 0.5);
    const cabin = box(0.8, 0.44, 0.75, lam(0x2c3444)); cabin.position.set(0, 0.86, -0.18);
    const glass = box(0.68, 0.3, 0.08, lam(0x9fd8ff, { emissive: 0x224455 })); glass.position.set(0, 0.9, 0.22);
    g.add(chassis, hood, cabin, glass);
    // wheels
    this.wheels = [];
    const wGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.24, 12);
    const wMat = lam(0x1b1b22);
    const hubMat = lam(0x888899);
    for (const [x, z] of [[-0.62, 0.55], [0.62, 0.55], [-0.62, -0.55], [0.62, -0.55]]) {
      const w = new THREE.Group();
      const tire = new THREE.Mesh(wGeo, wMat); tire.rotation.z = Math.PI / 2;
      const hub = box(0.26, 0.12, 0.12, hubMat); hub.rotation.z = Math.PI / 2;
      w.add(tire, hub);
      w.position.set(x, 0.3, z);
      g.add(w);
      this.wheels.push(w);
    }
    // THE DRILL — spinning cone with ridges
    this.drillGroup = new THREE.Group();
    this.drillGroup.position.set(0, 0.45, 1.05);
    this.drillGroup.rotation.x = Math.PI / 2;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.95, 12), lam(0xb8bec9, { emissive: 0x222226 }));
    cone.position.y = 0.475;
    for (let i = 0; i < 3; i++) {
      const ridge = box(0.86, 0.3, 0.07, lam(0x6d7480));
      ridge.position.y = 0.28;
      ridge.rotation.y = (i / 3) * Math.PI;
      cone.add(ridge);
    }
    this.drill = cone;
    this.drillGroup.add(cone);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.25, 10), lam(0x555c66));
    this.drillGroup.add(collar);
    g.add(this.drillGroup);
    // armor variants
    this.armorParts = { knight: new THREE.Group(), tank: new THREE.Group() };
    const plateMat = lam(0x7d8794);
    for (const dx of [-0.66, 0.66]) {
      const p = box(0.08, 0.5, 1.5, plateMat); p.position.set(dx, 0.55, 0);
      this.armorParts.knight.add(p);
    }
    const front = box(1.2, 0.45, 0.1, plateMat); front.position.set(0, 0.5, 0.9);
    this.armorParts.knight.add(front);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), lam(0x5a6472));
    dome.position.set(0, 1.05, -0.18);
    const big1 = box(1.4, 0.65, 0.12, plateMat); big1.position.set(0, 0.55, 0.95);
    const spikes = new THREE.Group();
    for (const dx of [-0.5, 0, 0.5]) {
      const s = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), lam(0xccd4dd));
      s.position.set(dx, 1.35, -0.18);
      spikes.add(s);
    }
    const side1 = box(0.12, 0.62, 1.7, plateMat); side1.position.set(-0.7, 0.55, 0);
    const side2 = side1.clone(); side2.position.x = 0.7;
    this.armorParts.tank.add(dome, big1, spikes, side1, side2);
    g.add(this.armorParts.knight, this.armorParts.tank);
    // weapon mounts
    this.weaponParts = { blaster: new THREE.Group(), water: new THREE.Group(), boom: new THREE.Group() };
    const barrel = box(0.14, 0.14, 0.8, lam(0xffdd33, { emissive: 0x553f00 })); barrel.position.set(0, 1.2, 0.2);
    this.weaponParts.blaster.add(barrel);
    const tankc = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 10), lam(0x2f9dff, { emissive: 0x0a2a4a }));
    tankc.rotation.x = Math.PI / 2; tankc.position.set(0, 1.2, -0.1);
    const nozzle = box(0.1, 0.1, 0.5, lam(0x9fd8ff)); nozzle.position.set(0, 1.2, 0.45);
    this.weaponParts.water.add(tankc, nozzle);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.9, 10), lam(0xff7733, { emissive: 0x481500 }));
    tube.rotation.x = Math.PI / 2; tube.position.set(0, 1.2, 0.15);
    this.weaponParts.boom.add(tube);
    g.add(this.weaponParts.blaster, this.weaponParts.water, this.weaponParts.boom);
    // blob shadow
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.95, 16),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02;
    g.add(shadow);
  }

  applyLoadout(colorHex, armorId, weaponId) {
    this.bodyMat.color.set(colorHex);
    this.armorParts.knight.visible = armorId === 'knight';
    this.armorParts.tank.visible = armorId === 'tank';
    for (const k of Object.keys(this.weaponParts)) this.weaponParts[k].visible = k === weaponId;
    this.armor = ARMORS[armorId];
    this.weapon = WEAPONS[weaponId];
  }

  placeAt(worldPos) {
    this.pos.copy(worldPos);
    this.vel.set(0, 0, 0);
    this.group.position.copy(this.pos);
  }

  forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  frontPoint(dist = 1.35) { return this.forward().multiplyScalar(dist).add(this.pos); }

  update(dt, input, world) {
    const maxSpeed = this.armor.speed;
    // input is screen-relative: +x right, +z down(toward camera)
    const want = new THREE.Vector3(input.x, 0, input.z);
    if (want.lengthSq() > 1) want.normalize();
    want.multiplyScalar(maxSpeed);
    const accel = want.lengthSq() > 0.01 ? 22 : 16;
    this.vel.x += (want.x - this.vel.x) * Math.min(1, accel * dt / maxSpeed * 8);
    this.vel.z += (want.z - this.vel.z) * Math.min(1, accel * dt / maxSpeed * 8);

    // axis-separated move+collide => free wall sliding
    this.moveAxis(this.vel.x * dt, 0, world);
    this.moveAxis(0, this.vel.z * dt, world);
    this.group.position.copy(this.pos);

    const speed = this.vel.length();
    if (speed > 0.6) {
      const target = Math.atan2(this.vel.x, this.vel.z);
      let d = target - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * Math.min(1, 12 * dt);
      this.group.rotation.y = this.heading;
    }
    // spin the drill & wheels
    this.drill.rotation.y += dt * (10 + speed * 4);
    for (const w of this.wheels) w.children[0].rotation.x += speed * dt * 3;
    return speed / maxSpeed;
  }

  moveAxis(dx, dz, world) {
    this.pos.x += dx; this.pos.z += dz;
    const [ctx, ctz] = world.tileAt(this.pos.x, this.pos.z);
    for (let z = ctz - 1; z <= ctz + 1; z++) for (let x = ctx - 1; x <= ctx + 1; x++) {
      if (!world.solid(x, z)) continue;
      const minX = x * TS, maxX = (x + 1) * TS, minZ = z * TS, maxZ = (z + 1) * TS;
      const px = Math.max(minX, Math.min(this.pos.x, maxX));
      const pz = Math.max(minZ, Math.min(this.pos.z, maxZ));
      const ddx = this.pos.x - px, ddz = this.pos.z - pz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 < this.radius * this.radius) {
        const d = Math.sqrt(d2) || 0.0001;
        const push = (this.radius - d) / d;
        this.pos.x += ddx * push;
        this.pos.z += ddz * push;
      }
    }
  }

  // drill grinding on cracked blocks; returns 'grind' | 'break' | null
  updateDrill(dt, world) {
    const fp = this.frontPoint(1.15);
    const [tx, tz] = world.tileAt(fp.x, fp.z);
    if (world.typeAt(tx, tz) !== T_BREAK) return null;
    const idx = world.maze.at(tx, tz);
    const heat = (this.drillHeat.get(idx) || 0) + dt * 2.6; // ~0.4s to break
    if (heat >= 1) {
      this.drillHeat.delete(idx);
      world.breakTileAt(tx, tz);
      return 'break';
    }
    this.drillHeat.set(idx, heat);
    return 'grind';
  }

  setBlink(on) { this.group.visible = on; }
}
