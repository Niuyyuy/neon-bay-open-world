// Neon Bay itself: roads, sidewalks, buildings by district, lamps, trees,
// billboards, the bay along the western edge, a dock pier, and two
// landmark buildings — the Marina garage and the Bay Trust vault.
// Returns the colliders the physics needs and the data the minimap draws.
// Everything is procedural boxes — no borrowed art.
import * as THREE from 'three';
import { CITY, PALETTE, DISTRICTS } from './config.js';
import { pick, range } from './random.js';

function roadLines() {
  const half = ((CITY.roads - 1) / 2) * CITY.roadStep;
  const lines = [];
  for (let i = 0; i < CITY.roads; i += 1) lines.push(-half + i * CITY.roadStep);
  return lines;
}

function districtAt(x, z) {
  if (x >= 0 && z < 0) return DISTRICTS[0]; // Downtown
  if (x < 0 && z < 0) return DISTRICTS[1]; // Harbor
  if (x < -200 && z > 0) return DISTRICTS[4]; // Marina (garage strip)
  if (x < 0) return DISTRICTS[2]; // Old Town
  return DISTRICTS[3]; // Palm Row
}

// A window grid painted on a canvas, so glass towers read as glass towers
// without a texture file.
function buildingMaterial(color, random) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  g.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 16) {
      // Lit windows come from the seeded random, not Math.random, so a
      // ?seed= replay builds the same city on every load.
      const lit = random() < 0.35;
      g.fillStyle = lit ? '#ffe9a8' : '#1c2733';
      g.fillRect(x, y, 9, 11);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: tex });
}

function billboardTexture(text, bg, fg) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 96;
  const g = canvas.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = fg;
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 50);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, random) {
  const lines = roadLines();
  const half = lines[lines.length - 1] + CITY.roadWidth / 2 + 20;
  const colliders = [];
  const buildings = [];
  const group = new THREE.Group();
  group.name = 'NeonBayCity';

  // Ground: sun-baked grass and dirt under everything. It stops ten
  // units past the last road, so the bay shows beyond its western edge.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(half * 2 + 20, half * 2 + 20),
    new THREE.MeshLambertMaterial({ color: PALETTE.ground }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const roadMat = new THREE.MeshLambertMaterial({ color: PALETTE.asphalt });
  const walkMat = new THREE.MeshLambertMaterial({ color: PALETTE.sidewalk });
  const lineMat = new THREE.MeshLambertMaterial({ color: PALETTE.lineWhite });
  const yellowMat = new THREE.MeshLambertMaterial({ color: PALETTE.lineYellow });

  // Roads and sidewalks, both axes.
  for (const c of lines) {
    for (const [w, mat] of [[CITY.roadWidth, roadMat], [CITY.roadWidth + 6, walkMat]]) {
      const alongX = new THREE.Mesh(new THREE.PlaneGeometry(half * 2, w), mat);
      alongX.rotation.x = -Math.PI / 2;
      alongX.position.set(0, w === CITY.roadWidth ? 0.02 : 0.01, c);
      alongX.receiveShadow = true;
      group.add(alongX);
      const alongZ = new THREE.Mesh(new THREE.PlaneGeometry(w, half * 2), mat);
      alongZ.rotation.x = -Math.PI / 2;
      alongZ.position.set(c, w === CITY.roadWidth ? 0.02 : 0.01, 0);
      alongZ.receiveShadow = true;
      group.add(alongZ);
    }
    // Dashed centre lines.
    for (let d = -half; d < half; d += 8) {
      const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 4), lineMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(c, 0.03, d);
      group.add(dash);
      const dash2 = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.35), lineMat);
      dash2.rotation.x = -Math.PI / 2;
      dash2.position.set(d, 0.03, c);
      group.add(dash2);
    }
  }

  // Buildings, one or two per block, taller toward Downtown.
  const materials = {};
  function matFor(color) {
    if (!materials[color]) materials[color] = buildingMaterial(color, random);
    return materials[color];
  }
  const blockCenters = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    blockCenters.push((lines[i] + lines[i + 1]) / 2);
  }
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      const district = districtAt(bx, bz);
      // The Bay Trust vault takes its whole Downtown block.
      if (bx === 130 && bz === -130) {
        const vault = new THREE.Mesh(
          new THREE.BoxGeometry(30, 34, 24),
          matFor(PALETTE.downtown[0]),
        );
        vault.position.set(bx, 17, bz);
        vault.castShadow = true;
        vault.receiveShadow = true;
        group.add(vault);
        const vaultTop = new THREE.Mesh(
          new THREE.BoxGeometry(32, 1.5, 26),
          new THREE.MeshLambertMaterial({ color: 0xf2c94c }),
        );
        vaultTop.position.set(bx, 34.7, bz);
        group.add(vaultTop);
        colliders.push({ minX: bx - 15, maxX: bx + 15, minZ: bz - 12, maxZ: bz + 12 });
        buildings.push({ x: bx, z: bz, w: 30, d: 24, h: 34, district: district.name });
        continue;
      }
      // One in eight blocks is a park instead of buildings.
      if (random() < 0.12) {
        const park = new THREE.Mesh(
          new THREE.PlaneGeometry(CITY.blockSize, CITY.blockSize),
          new THREE.MeshLambertMaterial({ color: 0x4a7a3a }),
        );
        park.rotation.x = -Math.PI / 2;
        park.position.set(bx, 0.02, bz);
        park.receiveShadow = true;
        group.add(park);
        for (let t = 0; t < 4; t += 1) {
          const tree = makeTree(range(random, 1.6, 2.6));
          tree.position.set(bx + range(random, -12, 12), 0, bz + range(random, -12, 12));
          group.add(tree);
        }
        continue;
      }
      const count = random() < 0.4 ? 2 : 1;
      for (let k = 0; k < count; k += 1) {
        const w = range(random, 12, 18);
        const d = range(random, 12, 18);
        const h = range(random, district.minH, district.maxH);
        const x = bx + (count === 2 ? (k === 0 ? -9 : 9) : 0) + range(random, -3, 3);
        const z = bz + range(random, -3, 3);
        const color = pick(random, PALETTE[district.palette]);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), matFor(color));
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        const roof = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.5, 1.2, d * 0.5),
          new THREE.MeshLambertMaterial({ color: 0x2a2f36 }),
        );
        roof.position.set(x, h + 0.6, z);
        roof.castShadow = true;
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        buildings.push({ x, z, w, d, h, district: district.name });
      }
    }
  }

  // The Marina garage: a low wide shed with a yellow roller door, just
  // west of the road at (-208, 130) — the drop-off for mission 1.
  const garage = new THREE.Mesh(
    new THREE.BoxGeometry(16, 7, 20),
    new THREE.MeshLambertMaterial({ color: 0x8a7a68 }),
  );
  garage.position.set(-220, 3.5, 130);
  garage.castShadow = true;
  garage.receiveShadow = true;
  group.add(garage);
  const garageDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 5, 12),
    new THREE.MeshLambertMaterial({ color: 0xf2c94c }),
  );
  garageDoor.position.set(-211.8, 2.5, 130);
  group.add(garageDoor);
  colliders.push({ minX: -228, maxX: -212, minZ: 120, maxZ: 140 });
  buildings.push({ x: -220, z: 130, w: 16, d: 20, h: 7, district: 'Marina' });

  // Lamps along every road, trees in Palm Row, billboards downtown.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
  for (const c of lines) {
    for (let d = -half + 20; d < half - 10; d += 52) {
      for (const [x, z] of [[c + 7, d], [c - 7, d + 26]]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
        pole.position.set(x, 3, z);
        group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
        lamp.position.set(x, 6.1, z);
        group.add(lamp);
      }
    }
  }
  const signs = [
    ['NEON BAY', '#0a2a5a', '#7fd4ff', 130, -104],
    ['SOLANO DOCKS', '#3a1a2a', '#ff9ad4', -130, -182],
    ['BAY TRUST', '#1a3a1a', '#ffe9a8', 104, -130],
    ['PALM ROW', '#5a3a1a', '#ffd27f', 182, 130],
  ];
  for (const [text, bg, fg, x, z] of signs) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 7),
      new THREE.MeshLambertMaterial({ map: billboardTexture(text, bg, fg) }),
    );
    board.position.set(x, 14, z);
    board.rotation.y = Math.PI / 4;
    group.add(board);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 14, 0.8), poleMat);
    post.position.set(x, 7, z);
    group.add(post);
  }

  // The bay itself: open water along the whole western edge, past the
  // ground's edge, so the Harbor looks out over it.
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(160, half * 2 + 20),
    new THREE.MeshLambertMaterial({ color: 0x2a6a9a }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(-half - 10 - 80, 0.02, 0);
  group.add(water);

  // Solano's dock pier: wooden boards running out into the bay at z = 26,
  // with a few crates stacked at its shore end.
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(40, 0.8, 8), pierMat);
  pier.position.set(-264, 0.6, -26);
  pier.castShadow = true;
  pier.receiveShadow = true;
  group.add(pier);
  for (const px of [-248, -262, -276]) {
    for (const pz of [-29, -23]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6), pierMat);
      post.position.set(px, 0, pz);
      group.add(post);
    }
  }
  const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
  for (const [cx, cz, s] of [[-238, -20, 2.2], [-238, -24, 1.8], [-236, -22, 1.6]]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), crateMat);
    crate.position.set(cx, s / 2, cz);
    crate.castShadow = true;
    group.add(crate);
  }

  scene.add(group);
  return {
    colliders,
    buildings,
    lines,
    half,
    districtAt,
    roadY: 0,
  };
}

export function makeTree(height) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.35, height * 0.5, 6),
    new THREE.MeshLambertMaterial({ color: 0x6a4a2a }),
  );
  trunk.position.y = height * 0.25;
  trunk.castShadow = true;
  group.add(trunk);
  const top = new THREE.Mesh(
    new THREE.ConeGeometry(height * 0.45, height * 0.7, 8),
    new THREE.MeshLambertMaterial({ color: 0x3a7a2a }),
  );
  top.position.y = height * 0.75;
  top.castShadow = true;
  group.add(top);
  return group;
}

// Circle (player or car) vs building AABB: push the circle out, report hit.
export function collideCircleBox(x, z, radius, colliders) {
  let hit = false;
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = radius - d;
        x += (dx / d) * push;
        z += (dz / d) * push;
      } else {
        // Dead centre: push out along the smallest penetration axis.
        const pl = x - b.minX;
        const pr = b.maxX - x;
        const pt = z - b.minZ;
        const pb = b.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - radius;
        else if (m === pr) x = b.maxX + radius;
        else if (m === pt) z = b.minZ - radius;
        else z = b.maxZ + radius;
      }
    }
  }
  return { x, z, hit };
}

export function clampToCity(x, z, half) {
  return {
    x: Math.max(-half, Math.min(half, x)),
    z: Math.max(-half, Math.min(half, z)),
  };
}
