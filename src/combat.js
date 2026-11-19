// Combat: hitscan shooting from the crosshair, tracers, muzzle flash,
// enemies who shoot back, and health. Enemies are police officers and
// vault guards; the player is Rio.
import * as THREE from 'three';

export function createCombat(scene) {
  const raycaster = new THREE.Raycaster();
  const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const tracers = [];
  const enemies = [];

  function spawnTracer(from, to) {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(0.03, 0.03, len, 5);
    const mesh = new THREE.Mesh(geo, tracerMat);
    mesh.position.copy(from).addScaledVector(dir, 0.5);
    mesh.lookAt(to);
    mesh.rotateX(Math.PI / 2);
    scene.add(mesh);
    tracers.push({ mesh, life: 0.08 });
  }

  return {
    enemies,
    // A guard or officer: a pedestrian figure with a gun and hit points.
    spawnEnemy(x, z, health) {
      const group = new THREE.Group();
      group.name = 'Enemy';
      const uniform = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
      const skin = new THREE.MeshLambertMaterial({ color: 0xc9a06a });
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.85, 0.45), uniform);
      torso.position.y = 1.2;
      torso.castShadow = true;
      group.add(torso);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
      head.position.y = 1.85;
      group.add(head);
      const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5),
        new THREE.MeshLambertMaterial({ color: 0x111111 }));
      gun.position.set(0.4, 1.1, 0.4);
      group.add(gun);
      group.position.set(x, 0, z);
      scene.add(group);
      const enemy = { mesh: group, x, z, health, cooldown: 1, dead: false };
      group.userData.isTarget = true;
      group.userData.enemy = enemy;
      enemies.push(enemy);
      return enemy;
    },
    removeEnemy(enemy) {
      scene.remove(enemy.mesh);
      const i = enemies.indexOf(enemy);
      if (i >= 0) enemies.splice(i, 1);
    },
    // Shoot from the camera through the screen centre. Returns what was hit.
    shoot(camera, targets) {
      raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
      const meshes = targets.map((t) => t.mesh || t).filter(Boolean);
      const hits = raycaster.intersectObjects(meshes, true);
      if (!hits.length) return null;
      const hit = hits[0];
      let obj = hit.object;
      while (obj && !obj.userData.isTarget && obj.parent) obj = obj.parent;
      const end = hit.point.clone();
      const start = camera.position.clone();
      spawnTracer(start, end);
      return { point: end, target: obj, distance: hit.distance };
    },
    // Enemies fire at the player with spread; returns true if the player was hit.
    enemyFire(enemy, playerPos, dt, onHit) {
      enemy.cooldown -= dt;
      const dist = Math.hypot(playerPos.x - enemy.x, playerPos.z - enemy.z);
      if (dist > 45 || enemy.dead) return false;
      enemy.mesh.lookAt(playerPos.x, 1.2, playerPos.z);
      if (enemy.cooldown <= 0) {
        enemy.cooldown = 0.9 + Math.random() * 0.7;
        const hitChance = Math.max(0.12, 0.55 - dist / 60);
        if (Math.random() < hitChance) {
          const from = enemy.mesh.position.clone().setY(1.4);
          const to = new THREE.Vector3(playerPos.x, 1.2, playerPos.z);
          spawnTracer(from, to);
          onHit(8 + Math.floor(Math.random() * 8));
          return true;
        }
        const from = enemy.mesh.position.clone().setY(1.4);
        const to = new THREE.Vector3(
          playerPos.x + (Math.random() - 0.5) * 4,
          1.2,
          playerPos.z + (Math.random() - 0.5) * 4,
        );
        spawnTracer(from, to);
      }
      return false;
    },
    update(dt) {
      for (let i = tracers.length - 1; i >= 0; i -= 1) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].mesh);
          tracers.splice(i, 1);
        }
      }
    },
  };
}
