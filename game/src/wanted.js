// The wanted system: stars rise with crime and fall when Rio hides.
// Police cars and officers scale with the stars; get too close to an
// officer on foot and Rio gets busted.
import { WANTED } from './config.js';
import { createPoliceCar } from './vehicles.js';

export function createWantedSystem(scene, audio, onPlayerShot) {
  let stars = 0;
  let quietTimer = 0;
  let bustedTimer = 0;
  const policeCars = [];
  const officers = [];

  function wantedCarCount() {
    return WANTED.policeCars[Math.min(stars, WANTED.maxStars)];
  }
  function wantedOfficerCount() {
    return WANTED.policeOnFoot[Math.min(stars, WANTED.maxStars)];
  }

  return {
    get stars() {
      return stars;
    },
    addCrime(amount) {
      stars = Math.min(WANTED.maxStars, stars + amount);
      quietTimer = 0;
      if (stars > 0) audio.startSiren();
    },
    setStars(value) {
      stars = Math.max(0, Math.min(WANTED.maxStars, value));
      quietTimer = 0;
      if (stars > 0) audio.startSiren();
      else audio.stopSiren();
    },
    clear() {
      stars = 0;
      quietTimer = 0;
      bustedTimer = 0;
      audio.stopSiren();
    },
    policeCars,
    officers,
    update(dt, playerPos, playerInCar, city, combat) {
      // Quiet time decays the heat.
      if (stars > 0) {
        quietTimer += dt;
        if (quietTimer > WANTED.decaySeconds) {
          stars -= 1;
          quietTimer = 0;
          if (stars === 0) audio.stopSiren();
        }
      }
      // Keep the right number of police cars on the road.
      while (policeCars.length < wantedCarCount()) {
        const angle = Math.random() * Math.PI * 2;
        const car = createPoliceCar(
          scene,
          playerPos.x + Math.cos(angle) * 60,
          playerPos.z + Math.sin(angle) * 60,
        );
        policeCars.push(car);
      }
      while (policeCars.length > wantedCarCount()) {
        const car = policeCars.pop();
        scene.remove(car.mesh);
      }
      for (const car of policeCars) {
        const dist = car.update(dt, playerPos);
        if (dist < 4.5 && !playerInCar) {
          // A police car stops beside Rio: the officers move in.
          car.speed = 0;
        }
      }
      // Officers on foot spawn near the player and chase.
      while (officers.length < wantedOfficerCount()) {
        const angle = Math.random() * Math.PI * 2;
        const enemy = combat.spawnEnemy(
          playerPos.x + Math.cos(angle) * 25,
          playerPos.z + Math.sin(angle) * 25,
          40,
        );
        officers.push(enemy);
      }
      while (officers.length > wantedOfficerCount()) {
        const enemy = officers.pop();
        combat.removeEnemy(enemy);
      }
      let busted = false;
      for (const officer of officers) {
        const dx = playerPos.x - officer.x;
        const dz = playerPos.z - officer.z;
        const dist = Math.hypot(dx, dz);
        if (!playerInCar && dist > 2) {
          const step = Math.min(dist, 7 * dt);
          officer.x += (dx / dist) * step;
          officer.z += (dz / dist) * step;
          officer.mesh.position.set(officer.x, 0, officer.z);
          officer.mesh.lookAt(playerPos.x, 0, playerPos.z);
        }
        if (!playerInCar && dist < 2.2) {
          bustedTimer += dt;
          if (bustedTimer > 2) busted = true;
        } else {
          bustedTimer = Math.max(0, bustedTimer - dt);
        }
        if (dist < 45) combat.enemyFire(officer, playerPos, dt, (amount) => { if (onPlayerShot) onPlayerShot(amount); });
      }
      return { busted };
    },
  };
}
