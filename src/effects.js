// Particles and screen shake: crash sparks, smoke, muzzle flashes and
// pickup sparkles, all from one pooled THREE.Points cloud.
import * as THREE from 'three';

const MAX_PARTICLES = 600;

export function createEffects(scene) {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.7,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const particles = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    particles.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1 });
    positions[i * 3 + 1] = -100;
  }
  let shake = 0;

  function spawn(x, y, z, color, count, speed, life, up) {
    let spawned = 0;
    for (const p of particles) {
      if (spawned >= count) break;
      if (p.alive) continue;
      p.alive = true;
      p.x = x;
      p.y = y;
      p.z = z;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      p.vx = Math.cos(a) * s;
      p.vz = Math.sin(a) * s;
      p.vy = (up || 0.5) * speed * (0.5 + Math.random());
      p.life = life * (0.6 + Math.random() * 0.6);
      p.maxLife = p.life;
      const c = new THREE.Color(color);
      const i = particles.indexOf(p);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      spawned += 1;
    }
  }

  return {
    burst(x, y, z, color, count) {
      spawn(x, y, z, color, count || 20, 6, 0.7, 0.8);
    },
    sparks(x, y, z) {
      spawn(x, y, z, 0xffd27f, 26, 9, 0.5, 0.7);
      spawn(x, y, z, 0xff5533, 10, 5, 0.4, 0.5);
    },
    smoke(x, y, z) {
      spawn(x, y, z, 0x888888, 12, 2, 1.4, 1.2);
    },
    muzzle(x, y, z) {
      spawn(x, y, z, 0xffe9a8, 6, 4, 0.12, 0.2);
    },
    pickupSparkle(x, y, z) {
      spawn(x, y, z, 0x2ecc71, 18, 4, 0.8, 1.2);
    },
    addShake(amount) {
      shake = Math.min(1.2, shake + amount);
    },
    update(dt) {
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i];
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
          positions[i * 3 + 1] = -100;
          continue;
        }
        p.vy -= 9 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < 0.05) {
          p.y = 0.05;
          p.vy *= -0.3;
        }
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      shake = Math.max(0, shake - dt * 2.2);
    },
    shakeOffset() {
      if (shake <= 0.01) return { x: 0, y: 0 };
      return {
        x: (Math.random() - 0.5) * shake * 0.5,
        y: (Math.random() - 0.5) * shake * 0.5,
      };
    },
  };
}
