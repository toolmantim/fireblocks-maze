import { WEAPONS, ARMORS, COLORS, LEVELS, MAX_HP, T_WALL, T_BREAK, T_BAR, T_DOOR } from './config.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.keys = {};
    this.joy = { active: false, id: null, cx: 0, cy: 0, x: 0, z: 0 };
    this.firing = false;
    this.touchMode = matchMedia('(pointer: coarse)').matches;
    this.buildHearts();
    this.buildGarage();
    this.wireButtons();
    this.wireKeyboard();
    this.wirePointer();
    this.mm = $('minimap').getContext('2d');
    this.mmStatic = document.createElement('canvas');
  }

  // ------- input -------
  wireKeyboard() {
    addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      this.keys[e.code] = true;
      if (e.code === 'Space') this.firing = true;
      if (e.code === 'KeyB') this.h.garageToggle();
    });
    addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') this.firing = false;
    });
  }

  wirePointer() {
    const game = $('game');
    game.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.setTouchMode(true);
      if (e.clientX < innerWidth * 0.55) {
        this.joy.active = true; this.joy.id = e.pointerId;
        this.joy.cx = e.clientX; this.joy.cy = e.clientY;
        this.joy.x = 0; this.joy.z = 0;
        const base = $('joy-base');
        base.classList.remove('hidden');
        base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px';
      } else {
        this.firing = true;
        this.fireId = e.pointerId;
      }
    });
    addEventListener('pointermove', (e) => {
      if (!this.joy.active || e.pointerId !== this.joy.id) return;
      const dx = e.clientX - this.joy.cx, dy = e.clientY - this.joy.cy;
      const len = Math.hypot(dx, dy), max = 52;
      const k = len > max ? max / len : 1;
      this.joy.x = (dx * k) / max; this.joy.z = (dy * k) / max;
      $('joy-knob').style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
    });
    const end = (e) => {
      if (this.joy.active && e.pointerId === this.joy.id) {
        this.joy.active = false; this.joy.x = 0; this.joy.z = 0;
        $('joy-base').classList.add('hidden');
        $('joy-knob').style.transform = 'translate(-50%,-50%)';
      }
      if (e.pointerId === this.fireId) { this.firing = false; this.fireId = null; }
    };
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
    const fire = $('btn-fire');
    fire.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.firing = true; });
    fire.addEventListener('pointerup', () => { this.firing = false; });
    fire.addEventListener('pointercancel', () => { this.firing = false; });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setTouchMode(on) {
    this.touchMode = on;
    $('btn-fire').classList.toggle('hidden', !on);
  }

  getMove() {
    let x = 0, z = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) z -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) z += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) x -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) x += 1;
    x += this.joy.x; z += this.joy.z;
    const l = Math.hypot(x, z);
    if (l > 1) { x /= l; z /= l; }
    return { x, z };
  }

  // ------- HUD -------
  buildHearts() {
    const wrap = $('hearts');
    this.heartFills = [];
    for (let i = 0; i < MAX_HP; i++) {
      const s = document.createElement('span');
      s.className = 'heart';
      s.innerHTML = '<span class="under">❤️</span><span class="fill">❤️</span>';
      wrap.appendChild(s);
      this.heartFills.push(s.querySelector('.fill'));
    }
  }
  setHearts(hp) {
    for (let i = 0; i < MAX_HP; i++) {
      const v = Math.max(0, Math.min(1, hp - i));
      this.heartFills[i].style.width = v >= 1 ? '100%' : v >= 0.5 ? '50%' : '0%';
    }
  }
  setLevel(n) { $('level-badge').textContent = `⭐ Level ${n}`; }
  setKey(has) { $('key-badge').classList.toggle('got', has); }
  setRescued(n) { $('rescued-badge').textContent = `🧑 ${n}`; }
  setBanner(text) {
    const b = $('banner');
    $('banner-text').textContent = text;
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
  }
  toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => t.classList.add('hidden'), 1400);
  }
  setMuteIcons(muted) {
    $('btn-mute').textContent = muted ? '🔇' : '🔊';
    $('btn-title-mute').textContent = muted ? '🔇 Sound' : '🔊 Sound';
  }

  // ------- minimap -------
  initMinimap(world) {
    const n = world.maze.n, px = 6;
    this.mmStatic.width = n * px; this.mmStatic.height = n * px;
    this.mmScale = px;
    this.redrawMinimapStatic(world);
  }
  redrawMinimapStatic(world) {
    const { n, t, at, mid, exit } = world.maze;
    const g = this.mmStatic.getContext('2d'), px = this.mmScale;
    g.clearRect(0, 0, n * px, n * px);
    g.fillStyle = 'rgba(30,45,28,.9)';
    g.fillRect(0, 0, n * px, n * px);
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const ty = t[at(x, z)];
      if (ty === T_WALL) g.fillStyle = '#5b6b7d';
      else if (ty === T_BREAK) g.fillStyle = '#b07a3f';
      else if (ty === T_BAR || ty === T_DOOR) g.fillStyle = '#b28bfa';
      else continue;
      g.fillRect(x * px, z * px, px, px);
    }
    for (const idx of world.fires.keys()) {
      const x = idx % n, z = (idx / n) | 0;
      g.fillStyle = '#ff8822';
      g.beginPath(); g.arc((x + 0.5) * px, (z + 0.5) * px, px * 0.4, 0, 7); g.fill();
    }
    g.fillStyle = world.portalUnlocked ? '#34ff88' : '#9ad0a8';
    g.fillRect(exit[0] * px, exit[1] * px, px, px);
  }
  drawMinimap(world, playerPos, heading, enemies) {
    const c = this.mm.canvas, g = this.mm, n = world.maze.n, px = this.mmScale;
    const s = c.width / (n * px);
    g.clearRect(0, 0, c.width, c.height);
    g.save();
    g.scale(s, s);
    g.drawImage(this.mmStatic, 0, 0);
    const TSpx = px / 2; // world->minimap: worldUnit * (px/TS)
    const dot = (wx, wz, color, r) => {
      g.fillStyle = color;
      g.beginPath(); g.arc(wx * TSpx, wz * TSpx, r, 0, 7); g.fill();
    };
    // guard / dropped key
    if (!world.keyTaken) {
      const kp = world.guard.bumped ? world.keyPickup.position : world.guard.group.position;
      dot(kp.x, kp.z, '#ffd60a', px * 0.55);
    }
    for (const e of enemies.list) {
      dot(e.group.position.x, e.group.position.z, e.kind === 'zombie' ? '#ff5555' : '#16a34a', px * 0.5);
    }
    // player arrow
    g.save();
    g.translate(playerPos.x * TSpx, playerPos.z * TSpx);
    g.rotate(-heading + Math.PI);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(0, -px * 0.9); g.lineTo(px * 0.6, px * 0.7); g.lineTo(-px * 0.6, px * 0.7);
    g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.restore();
  }

  // ------- screens -------
  buildGarage() {
    const wc = $('weapon-cards'), ac = $('armor-cards'), cs = $('color-swatches');
    const mkCard = (parent, id, emoji, name, stats, kind) => {
      const b = document.createElement('button');
      b.className = 'card'; b.dataset.id = id; b.dataset.kind = kind;
      b.innerHTML = `<span class="emoji">${emoji}</span><span class="name">${name}</span><br><span class="stats">${stats}</span>`;
      b.addEventListener('click', () => this.h.loadout(kind, id));
      parent.appendChild(b);
    };
    const wStats = { blaster: 'Zap monsters!', water: 'Puts out fire!', boom: 'Blows up blocks!' };
    for (const [id, w] of Object.entries(WEAPONS)) mkCard(wc, id, w.emoji, w.name, wStats[id], 'weapon');
    for (const [id, a] of Object.entries(ARMORS)) {
      const speed = '🏃'.repeat(Math.round((a.speed - 4) / 1.1));
      const shield = '🛡️'.repeat(Math.round(1 / a.protect));
      mkCard(ac, id, a.emoji, a.name, `${speed}<br>${shield}${a.fireproof ? '<br>🔥 fire-proof!' : ''}`, 'armor');
    }
    for (const col of COLORS) {
      const b = document.createElement('button');
      b.className = 'swatch'; b.dataset.id = col; b.dataset.kind = 'color';
      b.style.background = col;
      b.addEventListener('click', () => this.h.loadout('color', col));
      cs.appendChild(b);
    }
  }
  syncGarage(save) {
    document.querySelectorAll('#garage .card, #garage .swatch').forEach((el) => {
      const val = el.dataset.kind === 'weapon' ? save.weapon : el.dataset.kind === 'armor' ? save.armor : save.color;
      el.classList.toggle('selected', el.dataset.id === val);
    });
  }
  buildLevelGrid(save) {
    $('btn-play').textContent = save.started && save.level > 1 ? `▶️ KEEP PLAYING — Level ${save.level}` : '▶️ PLAY';
    const grid = $('level-grid');
    grid.innerHTML = '';
    for (let i = 1; i <= LEVELS.length; i++) {
      const b = document.createElement('button');
      const locked = i > save.unlocked;
      b.className = 'lvl-btn' + (locked ? ' locked' : '') + (i === 10 ? ' boss' : '');
      b.textContent = locked ? '🔒' : (i === 10 ? '👹' : i);
      if (!locked) b.addEventListener('click', () => this.h.startLevel(i));
      grid.appendChild(b);
    }
  }

  show(id) { $(id).classList.remove('hidden'); }
  hide(id) { $(id).classList.add('hidden'); }
  showOnly(id) {
    for (const s of ['title-screen', 'garage', 'level-done', 'win-screen', 'pause-screen']) this.hide(s);
    if (id) this.show(id);
  }

  wireButtons() {
    $('btn-play').addEventListener('click', () => this.h.play());
    $('btn-reset').addEventListener('click', () => this.h.reset());
    $('btn-title-mute').addEventListener('click', () => this.h.toggleMute());
    $('btn-mute').addEventListener('click', () => this.h.toggleMute());
    $('btn-save').addEventListener('click', () => this.h.saveNow());
    $('btn-garage').addEventListener('click', () => this.h.garageToggle());
    $('btn-garage-close').addEventListener('click', () => this.h.garageToggle());
    $('btn-next').addEventListener('click', () => this.h.nextLevel());
    $('btn-done-menu').addEventListener('click', () => this.h.toMenu());
    $('btn-win-again').addEventListener('click', () => this.h.startLevel(1));
    $('btn-win-menu').addEventListener('click', () => this.h.toMenu());
    $('btn-resume').addEventListener('click', () => this.h.resume());
  }
}
