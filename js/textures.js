import * as THREE from 'three';

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

// mottled stone block face
export const stoneTex = () => canvasTex(16, 16, (g) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 118 + Math.random() * 34;
    g.fillStyle = `rgb(${v | 0},${(v * 1.02) | 0},${(v * 1.08) | 0})`;
    g.fillRect(x, y, 1, 1);
  }
});

// cracked drillable block
export const crackTex = () => canvasTex(16, 16, (g) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 120 + Math.random() * 40;
    g.fillStyle = `rgb(${(v * 1.1) | 0},${(v * 0.82) | 0},${(v * 0.55) | 0})`;
    g.fillRect(x, y, 1, 1);
  }
  g.strokeStyle = 'rgba(40,20,5,0.9)'; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(8, 0); g.lineTo(6, 5); g.lineTo(10, 9); g.lineTo(7, 13); g.lineTo(9, 16);
  g.moveTo(2, 8); g.lineTo(6, 7); g.moveTo(10, 9); g.lineTo(14, 11);
  g.stroke();
});

// 4-frame minecraft-ish fire sheet (animated by offsetting)
export const fireTex = () => {
  const tex = canvasTex(64, 16, (g) => {
    for (let f = 0; f < 4; f++) {
      for (let x = 0; x < 16; x++) {
        const h = 6 + Math.sin(x * 1.7 + f * 2.1) * 3 + Math.random() * 5;
        for (let y = 0; y < 16; y++) {
          const fromBottom = 16 - y;
          if (fromBottom > h) continue;
          const p = fromBottom / h;
          g.fillStyle = p > 0.75 ? '#ffd54a' : p > 0.4 ? '#ff9424' : '#ff4d12';
          if (Math.random() > 0.18) g.fillRect(f * 16 + x, y, 1, 1);
        }
      }
    }
  });
  tex.repeat.set(0.25, 1);
  return tex;
};

// classic creeper face on mottled green
export const creeperTex = () => canvasTex(16, 16, (g) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 130 + Math.random() * 80;
    g.fillStyle = `rgb(${(v * 0.35) | 0},${v | 0},${(v * 0.4) | 0})`;
    g.fillRect(x, y, 1, 1);
  }
  g.fillStyle = '#0a0a0a';
  g.fillRect(3, 4, 3, 3); g.fillRect(10, 4, 3, 3);       // eyes
  g.fillRect(6, 7, 4, 4); g.fillRect(5, 9, 2, 4); g.fillRect(9, 9, 2, 4); // mouth
});

// zombie face
export const zombieTex = () => canvasTex(16, 16, (g) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const v = 120 + Math.random() * 50;
    g.fillStyle = `rgb(${(v * 0.45) | 0},${v | 0},${(v * 0.45) | 0})`;
    g.fillRect(x, y, 1, 1);
  }
  g.fillStyle = '#0a0a0a';
  g.fillRect(3, 5, 3, 2); g.fillRect(10, 5, 3, 2); g.fillRect(6, 10, 4, 2);
});

// friendly guard face: big smile
export const guardFaceTex = () => canvasTex(16, 16, (g) => {
  g.fillStyle = '#ffd9b3'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#222';
  g.fillRect(4, 5, 2, 3); g.fillRect(10, 5, 2, 3);
  g.fillRect(4, 10, 8, 1); g.fillRect(3, 9, 1, 1); g.fillRect(12, 9, 1, 1);
  g.fillStyle = '#ff8888'; g.fillRect(2, 8, 2, 1); g.fillRect(12, 8, 2, 1);
});

export const personFaceTex = () => canvasTex(16, 16, (g) => {
  g.fillStyle = '#ffd9b3'; g.fillRect(0, 0, 16, 16);
  g.fillStyle = '#222';
  g.fillRect(4, 6, 2, 2); g.fillRect(10, 6, 2, 2); g.fillRect(5, 11, 6, 1);
});

// per-level floor: grass with stone room patch
export function floorTex(maze) {
  const { n, t, at, mid } = maze;
  return canvasTex(n * 8, n * 8, (g) => {
    for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
      const room = Math.abs(x - mid) <= 2 && Math.abs(z - mid) <= 2;
      for (let py = 0; py < 8; py++) for (let px = 0; px < 8; px++) {
        if (room) {
          const v = 130 + Math.random() * 25;
          g.fillStyle = `rgb(${v | 0},${v | 0},${(v * 1.05) | 0})`;
        } else {
          const v = 95 + Math.random() * 40;
          g.fillStyle = `rgb(${(v * 0.45) | 0},${(v + 25) | 0},${(v * 0.4) | 0})`;
        }
        g.fillRect(x * 8 + px, z * 8 + py, 1, 1);
      }
    }
  });
}
