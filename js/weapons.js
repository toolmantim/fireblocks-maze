import * as THREE from 'three';
import { TS, T_BREAK } from './config.js';

export class Projectiles {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
    this.geo = new THREE.SphereGeometry(0.16, 8, 6);
  }

  fire(origin, dir, weapon) {
    const mat = new THREE.MeshBasicMaterial({ color: weapon.color });
    const mesh = new THREE.Mesh(weapon.blast ? new THREE.SphereGeometry(0.26, 8, 6) : this.geo, mat);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.list.push({ mesh, vel: dir.clone().multiplyScalar(weapon.speed), weapon, ttl: 1.5 });
  }

  // fx: particles, world: LevelWorld, enemies: Enemies. returns events
  update(dt, world, enemies, fx) {
    const events = [];
    for (const p of this.list) {
      p.ttl -= dt;
      let dead = p.ttl <= 0;
      const steps = 2;
      for (let s = 0; s < steps && !dead; s++) {
        p.mesh.position.addScaledVector(p.vel, dt / steps);
        const pos = p.mesh.position;
        const [tx, tz] = world.tileAt(pos.x, pos.z);
        // douse fire (water)
        if (p.weapon.douse) {
          const doused = world.douseAtWorld(pos.x, pos.z);
          if (doused) {
            events.push({ type: 'douse', pos: doused });
            fx.sparkBurst(doused.x, 0.8, doused.z, 0xbbeeff, 16, 3);
            dead = true; break;
          }
        }
        // hit wall
        if (world.solid(tx, tz)) {
          if (p.weapon.blast) { this.explode(pos, world, enemies, fx, events); }
          else fx.sparkBurst(pos.x, pos.y, pos.z, p.weapon.color, 6, 2);
          dead = true; break;
        }
        // hit monster
        for (const e of enemies.list) {
          if (e.dead) continue;
          if (e.group.position.distanceTo(pos) < 0.75) {
            if (p.weapon.blast) { this.explode(pos, world, enemies, fx, events); }
            else {
              const killed = enemies.damage(e, p.weapon.dmg, p.weapon.stun, fx);
              events.push({ type: killed ? 'monsterDie' : 'monsterHit' });
              fx.sparkBurst(pos.x, 0.9, pos.z, p.weapon.color, 8, 2.5);
            }
            dead = true; break;
          }
        }
      }
      if (p.ttl <= 0 && !dead && p.weapon.blast) { this.explode(p.mesh.position, world, enemies, fx, events); dead = true; }
      if (dead) { this.scene.remove(p.mesh); p.dead = true; }
    }
    this.list = this.list.filter(p => !p.dead);
    return events;
  }

  explode(pos, world, enemies, fx, events, radius = null) {
    const r = radius || 2.4;
    fx.explosion(pos.x, Math.max(pos.y, 0.6), pos.z);
    events.push({ type: 'boom', pos: pos.clone() });
    // break cracked blocks in radius
    const [ctx, ctz] = world.tileAt(pos.x, pos.z);
    const tr = Math.ceil(r / TS);
    for (let z = ctz - tr; z <= ctz + tr; z++) for (let x = ctx - tr; x <= ctx + tr; x++) {
      if (world.typeAt(x, z) !== T_BREAK) continue;
      const c = world.centerOf(x, z);
      if (c.distanceTo(pos) < r + TS * 0.5) {
        world.breakTileAt(x, z);
        fx.chunkBurst(c.x, 1, c.z, 0x9a6b3f, 12, 5);
      }
    }
    // hurt monsters in radius
    for (const e of enemies.list) {
      if (!e.dead && e.group.position.distanceTo(pos) < r) {
        if (enemies.damage(e, 3, 0, fx)) events.push({ type: 'monsterDie' });
      }
    }
  }

  dispose() { for (const p of this.list) this.scene.remove(p.mesh); this.list = []; }
}
