// The world: everything wired together — renderer, city, traffic, people,
// player, police, combat, missions, effects, HUD state, save/load.
// main.js owns the screens and the loop; this owns the simulation.
import * as THREE from 'three';
import { CITY, PLAYER, MISSIONS, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createCity, collideCircleBox, clampToCity, districtAt } from './city.js';
import { createCarMesh, createTrafficManager } from './vehicles.js';
import { createPedestrianManager } from './pedestrians.js';
import { createPlayerController } from './player.js';
import { createDrivenCar, nearestCar } from './driving.js';
import { createCombat } from './combat.js';
import { createWantedSystem } from './wanted.js';
import { createMissionManager } from './missions.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';

export function createWorld(canvas, seed) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fc0e8);
  scene.fog = new THREE.Fog(0x9ec3dd, 140, 480);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1200);

  // Day lighting: warm sun, soft sky fill.
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0xbcd8ff, 0.9));
  const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.5);
  scene.add(hemi);

  const city = createCity(scene);
  const effects = createEffects(scene);
  const audio = createAudio();

  let dynamic = null;
  let traffic = null;
  let peds = null;
  let player = null;
  let combat = null;
  let wanted = null;
  let missions = null;
  let packages = [];
  let driven = null;
  let missionCar = null;
  let shootCooldown = 0;
  let lastShotAt = -100;

  const state = {
    cash: 150,
    clockMinutes: 9 * 60,
    elapsed: 0,
    playing: false,
    busted: false,
    wasted: false,
    storyComplete: false,
    cameraYaw: Math.PI,
    cameraPitch: 0.35,
    carHealth: 100,
  };
  const callbacks = {
    onMissionComplete: null,
    onMissionFailed: null,
    onStoryComplete: null,
    onBusted: null,
    onWasted: null,
  };

  function resize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  function initDynamic(randomSeed) {
    if (dynamic) {
      scene.remove(dynamic);
      dynamic.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    dynamic = new THREE.Group();
    dynamic.name = 'DynamicWorld';
    scene.add(dynamic);
    const random = createRandom(randomSeed);
    traffic = createTrafficManager(dynamic, city, random);
    peds = createPedestrianManager(dynamic, city, random);
    player = createPlayerController(dynamic, 0, 20);
    combat = createCombat(dynamic);
    wanted = createWantedSystem(dynamic, audio, (amount) => damagePlayer(amount, 'shot'));
    missions = createMissionManager(dynamic, audio);
    packages = [];
    driven = null;
    // The mission car: a red coupe parked at the Harbor docks for mission 1.
    const mc = {
      mesh: createCarMesh(0xd94f4f, false),
      x: -195,
      z: 26,
      axis: 'z',
      dir: 1,
      speed: 0,
      heading: 0,
      parked: true,
      driver: false,
      isMissionCar: true,
    };
    mc.mesh.position.set(mc.x, 0, mc.z);
    mc.mesh.rotation.y = mc.heading;
    dynamic.add(mc.mesh);
    traffic.parked.push(mc);
    missionCar = mc;
    state.carHealth = 100;
    state.busted = false;
    state.wasted = false;
  }
  initDynamic(seed);

  function playerPos() {
    if (driven) return { x: driven.x, z: driven.z };
    return { x: player.x, z: player.z };
  }

  function damagePlayer(amount, cause) {
    if (state.wasted || !state.playing) return;
    player.health = Math.max(0, player.health - amount);
    audio.hurt();
    effects.addShake(0.4);
    if (player.health <= 0) {
      state.wasted = true;
      state.playing = false;
      audio.stopSiren();
      audio.stopEngine();
      if (callbacks.onWasted) callbacks.onWasted(cause);
    }
  }

  function damageCar(amount) {
    state.carHealth = Math.max(0, state.carHealth - amount);
    if (state.carHealth <= 0 && driven) {
      effects.smoke(driven.x, 1.5, driven.z);
      audio.crash();
      exitCar(true);
      damagePlayer(20, 'crash');
    }
  }

  function enterCar(car) {
    // Pull the driver out of a traffic car; a parked car is just taken.
    if (car.driver) {
      const ped = peds.peds.find((p) => Math.hypot(p.x - car.x, p.z - car.z) < 6);
      if (ped) peds.knockDown(ped);
      wanted.addCrime(1);
    } else {
      wanted.addCrime(1);
    }
    const fromTraffic = traffic.cars.indexOf(car);
    if (fromTraffic >= 0) traffic.cars.splice(fromTraffic, 1);
    const fromParked = traffic.parked.indexOf(car);
    if (fromParked >= 0) traffic.parked.splice(fromParked, 1);
    driven = createDrivenCar(dynamic, car.mesh);
    driven.x = car.x;
    driven.z = car.z;
    driven.heading = car.heading;
    driven.isMissionCar = !!car.isMissionCar;
    player.mesh.visible = false;
    player.x = car.x;
    player.z = car.z;
    state.carHealth = 100;
    audio.engineStart();
    missions.onCarStolen(car, api);
  }

  function exitCar(wrecked) {
    if (!driven) return;
    const mesh = driven.mesh;
    const side = Math.cos(driven.heading) > 0 ? 1 : -1;
    player.x = driven.x + side * 3;
    player.z = driven.z;
    player.mesh.visible = true;
    player.mesh.position.set(player.x, 0, player.z);
    if (!wrecked) {
      traffic.parked.push({
        mesh,
        x: driven.x,
        z: driven.z,
        axis: 'z',
        dir: 1,
        speed: 0,
        heading: driven.heading,
        parked: true,
        driver: false,
        isMissionCar: driven.isMissionCar,
      });
    } else {
      dynamic.remove(mesh);
    }
    driven = null;
    audio.stopEngine();
  }

  function shoot() {
    if (shootCooldown > 0 || driven) return;
    shootCooldown = 0.25;
    audio.shoot();
    wanted.addCrime(1);
    lastShotAt = state.elapsed;
    const gunPos = new THREE.Vector3(player.x, 1.2, player.z)
      .add(new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading)).multiplyScalar(0.8));
    effects.muzzle(gunPos.x, gunPos.y, gunPos.z);
    const targets = combat.enemies.filter((e) => !e.dead);
    const hit = combat.shoot(camera, targets.map((e) => e.mesh));
    if (hit && hit.target && hit.target.userData.enemy) {
      const enemy = hit.target.userData.enemy;
      enemy.health -= 34;
      effects.burst(hit.point.x, hit.point.y, hit.point.z, 0xff5533, 10);
      if (enemy.health <= 0) {
        enemy.dead = true;
        effects.burst(enemy.x, 1.2, enemy.z, 0xff3333, 30);
        combat.removeEnemy(enemy);
        state.cash += 25;
        audio.pickup();
      }
    }
  }

  const api = {
    renderer,
    scene,
    camera,
    audio,
    city,
    callbacks,
    get cash() {
      return state.cash;
    },
    get missions() {
      return missions;
    },
    get wanted() {
      return wanted;
    },
    get playing() {
      return state.playing;
    },
    playerX() {
      return playerPos().x;
    },
    playerZ() {
      return playerPos().z;
    },
    addCash(amount) {
      state.cash += amount;
    },
    setPlaying(value) {
      state.playing = value;
    },
    onMissionComplete(m) {
      if (callbacks.onMissionComplete) callbacks.onMissionComplete(m);
    },
    onMissionFailed(m, reason) {
      if (callbacks.onMissionFailed) callbacks.onMissionFailed(m, reason);
    },
    onStoryComplete() {
      state.storyComplete = true;
      if (callbacks.onStoryComplete) callbacks.onStoryComplete();
    },
    spawnPackage(x, z) {
      const geo = new THREE.BoxGeometry(1.2, 0.9, 1.2);
      const mat = new THREE.MeshLambertMaterial({ color: 0x2ecc71, emissive: 0x1a7a3a });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, 0.7, z);
      mesh.name = 'Package';
      dynamic.add(mesh);
      const pkg = { mesh, x, z };
      packages.push(pkg);
      return pkg;
    },
    collectPackage(pkg) {
      dynamic.remove(pkg.mesh);
      const i = packages.indexOf(pkg);
      if (i >= 0) packages.splice(i, 1);
      effects.pickupSparkle(pkg.x, 1, pkg.z);
      state.cash += 50;
    },
    spawnVaultGuards() {
      const guards = [];
      for (const [dx, dz] of [[-6, 0], [6, 0], [0, 8]]) {
        const g = combat.spawnEnemy(120 + dx, 120 + dz, 50);
        g.mesh.userData.enemy = g;
        g.mesh.userData.isTarget = true;
        guards.push(g);
      }
      return guards;
    },
    setWanted(n) {
      wanted.setStars(n);
    },
    teleportPlayer(x, z) {
      if (driven) exitCar(false);
      player.x = x;
      player.z = z;
      player.mesh.position.set(x, 0, z);
    },
    spawnDrivenCarAt(x, z, color) {
      if (driven) exitCar(false);
      const mesh = createCarMesh(color || 0x2ecc71, false);
      mesh.position.set(x, 0, z);
      dynamic.add(mesh);
      driven = createDrivenCar(dynamic, mesh);
      driven.x = x;
      driven.z = z;
      driven.heading = 0;
      player.mesh.visible = false;
      player.x = x;
      player.z = z;
      audio.engineStart();
      return driven;
    },
    setTime(hour) {
      state.clockMinutes = hour * 60;
    },
    startMission(i) {
      missions.startMission(i, api);
    },
    respawn() {
      state.wasted = false;
      state.busted = false;
      player.health = PLAYER.maxHealth;
      state.cash = Math.max(0, state.cash - 250);
      wanted.clear();
      api.teleportPlayer(0, 20);
      state.playing = true;
      if (missions.state === 'failed') missions.retryMission(api);
    },
    save() {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          cash: state.cash,
          missionIndex: missions.missionIndex,
          missionState: missions.state,
          playerX: player.x,
          playerZ: player.z,
          health: player.health,
          clockMinutes: state.clockMinutes,
        }));
        return true;
      } catch (e) {
        return false;
      }
    },
    load() {
      try {
        const raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        state.cash = data.cash || 0;
        state.clockMinutes = data.clockMinutes || 9 * 60;
        player.health = data.health || PLAYER.maxHealth;
        api.teleportPlayer(data.playerX || 0, data.playerZ || 20);
        if (data.missionState === 'complete' && data.missionIndex + 1 < MISSIONS.length) {
          missions.setMissionIndex(data.missionIndex + 1);
        } else {
          missions.setMissionIndex(data.missionIndex || 0);
        }
        return true;
      } catch (e) {
        return false;
      }
    },
    hasSave() {
      try {
        return !!localStorage.getItem(SAVE_KEY);
      } catch (e) {
        return false;
      }
    },
    reset(newSeed) {
      state.cash = 150;
      state.clockMinutes = 9 * 60;
      state.elapsed = 0;
      player.health = PLAYER.maxHealth;
      state.cameraYaw = Math.PI;
      state.cameraPitch = 0.35;
      initDynamic(newSeed || 1);
      missions.reset();
    },
    hudState() {
      const pos = playerPos();
      const hours = Math.floor(state.clockMinutes / 60) % 24;
      const mins = Math.floor(state.clockMinutes % 60);
      return {
        health: player.health,
        cash: state.cash,
        stars: wanted.stars,
        clock: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
        district: districtAt(pos.x, pos.z),
        missionTitle: missions.missionTitle(),
        objectiveText: missions.objectiveText(),
        driving: !!driven,
        speed: driven ? driven.speed : 0,
        dialogue: missions.currentLine ? missions.currentLine : null,
        playerX: pos.x,
        playerZ: pos.z,
        playerHeading: driven ? driven.heading : player.heading,
        marker: missions.markerPos(),
        traffic: traffic.cars.slice(0, 12),
        police: wanted.policeCars,
      };
    },
    update(dt, input) {
      if (!state.playing) {
        // Still render the city behind menus; idle camera drift.
        const t = performance.now() / 1000;
        camera.position.set(Math.sin(t * 0.05) * 160, 90, Math.cos(t * 0.05) * 160);
        camera.lookAt(0, 10, 0);
        return;
      }
      state.elapsed += dt;
      state.clockMinutes += dt / 2; // a game minute every 2 real seconds
      shootCooldown = Math.max(0, shootCooldown - dt);
      state.cameraYaw -= (input.mouseDX || 0) * 0.004;
      state.cameraPitch = Math.max(
        -0.1,
        Math.min(1.1, state.cameraPitch + (input.mouseDY || 0) * 0.003),
      );

      const pos = playerPos();
      // Missions first: objectives may complete from the current position.
      missions.update(dt, api);
      missions.updateBeacon(dt);

      if (driven) {
        const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
        const others = traffic.cars.concat(traffic.parked).map((c) => ({ x: c.x, z: c.z, mesh: c.mesh }));
        const result = driven.update(
          dt,
          !!input.forward,
          !!input.back,
          steer,
          !!input.handbrake,
          city,
          others,
          (speed) => {
            effects.sparks(driven.x, 0.8, driven.z);
            effects.addShake(Math.min(0.6, speed / 40));
            audio.crash();
            damageCar(speed * 0.8);
          },
        );
        audio.setEnginePitch(Math.abs(result.speed) / 34);
        // Hit pedestrians with the car.
        for (const ped of peds.peds) {
          if (ped.state === 'down') continue;
          const d = Math.hypot(ped.x - driven.x, ped.z - driven.z);
          if (d < 2.4 && Math.abs(driven.speed) > 5) {
            peds.knockDown(ped);
            effects.burst(ped.x, 1, ped.z, 0xff5533, 16);
            wanted.addCrime(1);
            audio.crash();
            damageCar(5);
          }
        }
        if (input.interact) exitCar(false);
        driven.placeCamera(camera, state.cameraYaw, state.cameraPitch);
      } else {
        const move = {
          x: (input.right ? 1 : 0) - (input.left ? 1 : 0),
          z: (input.forward ? 1 : 0) - (input.back ? 1 : 0),
        };
        player.update(dt, move, !!input.sprint, state.cameraYaw, state.cameraPitch);
        const hit = collideCircleBox(player.x, player.z, 0.7, city.colliders);
        player.x = hit.x;
        player.z = hit.z;
        const clamped = clampToCity(player.x, player.z, city.half);
        player.x = clamped.x;
        player.z = clamped.z;
        player.mesh.position.set(player.x, 0, player.z);
        if (input.shoot) shoot();
        if (input.interact) {
          const car = nearestCar(player.x, player.z, traffic.allCars(), 5);
          if (car) enterCar(car);
        }
        player.placeCamera(camera, player.x, player.z, 0);
      }

      // Threats that make pedestrians flee.
      const threats = [{ x: pos.x, z: pos.z, radius: 6 }];
      if (state.elapsed - lastShotAt < 2) threats.push({ x: pos.x, z: pos.z, radius: 25 });
      if (driven) threats.push({ x: driven.x, z: driven.z, radius: 12 });
      traffic.update(dt, driven ? null : pos);
      peds.update(dt, threats);

      // Police: chase, ram, arrest.
      const policeResult = wanted.update(dt, playerPos(), !!driven, city, combat);
      for (const car of wanted.policeCars) {
        const d = Math.hypot(car.x - pos.x, car.z - pos.z);
        if (d < 3.5) {
          if (driven) {
            damageCar(8);
            effects.sparks(car.x, 0.8, car.z);
            audio.crash();
            car.speed = 0;
          } else {
            damagePlayer(6, 'rammed');
          }
        }
      }
      if (policeResult.busted && !state.busted) {
        state.busted = true;
        state.playing = false;
        audio.stopSiren();
        audio.stopEngine();
        if (callbacks.onBusted) callbacks.onBusted();
      }

      // Enemies shoot back (vault guards and officers already fire via wanted).
      for (const enemy of combat.enemies) {
        if (enemy.dead) continue;
        const dist = Math.hypot(enemy.x - pos.x, enemy.z - pos.z);
        if (dist < 40 && !wanted.officers.includes(enemy)) {
          combat.enemyFire(enemy, pos, dt, (amount) => damagePlayer(amount, 'shot'));
        }
      }
      combat.update(dt);
      effects.update(dt);
      const shake = effects.shakeOffset();
      camera.position.x += shake.x;
      camera.position.y += shake.y;
      // Mission packages bob.
      for (const pkg of packages) {
        pkg.mesh.rotation.y += dt * 2;
        pkg.mesh.position.y = 0.7 + Math.sin(state.elapsed * 3 + pkg.x) * 0.15;
      }
      if (input.missionKey && missions.state !== 'active') {
        missions.startMission(missions.missionIndex, api);
      }
    },
    render() {
      renderer.render(scene, camera);
    },
  };
  return api;
}
