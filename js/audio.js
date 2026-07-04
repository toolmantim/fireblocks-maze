// Procedural WebAudio sound effects. No audio files.
let ctx = null, master = null, engineOsc = null, engineGain = null, engineFilter = null;
let muted = false;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ac(); }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.5; }
export function isMuted() { return muted; }

document.addEventListener('visibilitychange', () => {
  if (!ctx) return;
  if (document.hidden) ctx.suspend(); else ctx.resume();
});

function osc(type, f0, f1, t, vol = 0.3, delay = 0) {
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  const t0 = c.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + t);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + t + 0.02);
}

function noise(t, filterType = 'lowpass', freq = 1000, vol = 0.3, delay = 0, f1 = null) {
  const c = ac(), t0 = c.currentTime + delay;
  const len = Math.ceil(c.sampleRate * t);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = filterType;
  f.frequency.setValueAtTime(freq, t0);
  if (f1 !== null) f.frequency.exponentialRampToValueAtTime(Math.max(f1, 10), t0 + t);
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + t);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t0); src.stop(t0 + t);
}

function notes(seq, type = 'sine', dur = 0.14, vol = 0.25) {
  seq.forEach((n, i) => { if (n) osc(type, n, null, dur * 1.6, vol, i * dur); });
}

export const SFX = {
  click:   () => osc('square', 620, 850, 0.06, 0.15),
  pew:     () => osc('sawtooth', 950, 250, 0.13, 0.2),
  splash:  () => { noise(0.16, 'bandpass', 1800, 0.25, 0, 400); osc('sine', 500, 180, 0.15, 0.12); },
  thump:   () => { osc('sine', 130, 40, 0.25, 0.5); noise(0.2, 'lowpass', 500, 0.3); },
  boom:    () => { osc('sine', 110, 28, 0.6, 0.7); noise(0.55, 'lowpass', 350, 0.5); },
  grind:   () => noise(0.09, 'bandpass', 1100 + Math.random() * 500, 0.12),
  breakBlock: () => { osc('sine', 160, 50, 0.2, 0.4); noise(0.25, 'lowpass', 900, 0.35); },
  key:     () => notes([659, 784, 988, 1319], 'sine', 0.09, 0.25),
  jailOpen:() => notes([523, 659, 784, 1047, 1319], 'triangle', 0.11, 0.3),
  cheer:   () => { for (let i = 0; i < 6; i++) osc('sine', 700 + Math.random() * 500, 1100 + Math.random() * 600, 0.18, 0.08, 0.1 + i * 0.07); noise(0.5, 'bandpass', 2500, 0.06, 0.1); },
  groan:   () => { osc('sawtooth', 95, 70, 0.6, 0.16); osc('sawtooth', 63, 48, 0.6, 0.12, 0.05); },
  hiss:    () => noise(1.1, 'highpass', 2500, 0.22, 0, 6000),
  hurt:    () => osc('square', 320, 130, 0.2, 0.25),
  boing:   () => { osc('sine', 220, 520, 0.12, 0.25); osc('sine', 520, 300, 0.16, 0.2, 0.12); },
  zap:     () => { osc('square', 520, 90, 0.16, 0.2); noise(0.1, 'highpass', 1500, 0.12); },
  sizzle:  () => noise(0.35, 'highpass', 3500, 0.2, 0, 800),
  locked:  () => osc('square', 190, 140, 0.18, 0.2),
  portal:  () => notes([784, 988, 1175, 1568], 'triangle', 0.08, 0.2),
  jingle:  () => notes([523, 659, 784, 1047, 784, 1047], 'triangle', 0.15, 0.3),
  fanfare: () => notes([523, 523, 523, 659, 784, 784, 1047, 1319, 1047], 'triangle', 0.17, 0.32),
  spawnIn: () => osc('sine', 200, 600, 0.3, 0.2),
};

// Engine hum: call every frame with speed 0..1
export function engine(speedFrac) {
  if (!ctx || muted) { if (engineGain) engineGain.gain.value = 0; return; }
  if (!engineOsc) {
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass'; engineFilter.frequency.value = 320;
    engineGain = ctx.createGain(); engineGain.gain.value = 0;
    engineOsc.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(master);
    engineOsc.start();
  }
  engineOsc.frequency.value = 50 + speedFrac * 65;
  engineGain.gain.value = 0.02 + speedFrac * 0.075;
}
