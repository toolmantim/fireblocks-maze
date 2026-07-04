import * as THREE from 'three';

// Two pooled THREE.Points systems: additive "sparks" and gravity "chunks".
class Pool {
  constructor(scene, max, size, additive) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);      // seconds remaining, <=0 -> dead
    this.grav = additive ? 1.5 : 9;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size, vertexColors: true, transparent: true, opacity: 0.95,
      depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(this.geo, mat);
    this.points.frustumCulled = false;
    this.cursor = 0;
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -999;
    scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, r, g, b, life) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([vx, vy, vz], i * 3);
    this.col.set([r, g, b], i * 3);
    this.life[i] = life;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this.pos[i * 3 + 1] = -999; continue; }
      this.vel[i * 3 + 1] -= this.grav * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.4; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

export class Particles {
  constructor(scene) {
    this.sparks = new Pool(scene, 400, 0.16, true);
    this.chunks = new Pool(scene, 300, 0.3, false);
  }
  update(dt) { this.sparks.update(dt); this.chunks.update(dt); }

  burst(pool, x, y, z, color, count, speed, life = 0.7) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1;
      const s = speed * (0.4 + Math.random() * 0.8);
      pool.spawn(x, y, z,
        Math.cos(a) * Math.sqrt(1 - u * u) * s, Math.abs(u) * s + speed * 0.4, Math.sin(a) * Math.sqrt(1 - u * u) * s,
        c.r, c.g, c.b, life * (0.6 + Math.random() * 0.8));
    }
  }
  sparkBurst(x, y, z, color, count = 10, speed = 3) { this.burst(this.sparks, x, y, z, color, count, speed, 0.5); }
  chunkBurst(x, y, z, color, count = 14, speed = 4) { this.burst(this.chunks, x, y, z, color, count, speed, 1.0); }
  explosion(x, y, z) {
    this.sparkBurst(x, y, z, 0xffaa33, 30, 7);
    this.sparkBurst(x, y, z, 0xff4411, 20, 5);
    this.chunkBurst(x, y, z, 0x555555, 16, 6);
  }
  confetti(x, y, z) {
    for (const c of [0xff3b30, 0xffd60a, 0x34c759, 0x0a84ff, 0xbf5af2])
      this.chunkBurst(x, y + 1, z, c, 8, 5);
  }
  hearts(x, y, z) { this.sparkBurst(x, y, z, 0xff66aa, 14, 2.5); }
}
