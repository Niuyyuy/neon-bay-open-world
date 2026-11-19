// Missions and the story: four jobs for Mara Solano, each with objectives,
// dialogue, a beacon marker and a cash reward. Progression saves.
import * as THREE from 'three';
import { MISSIONS } from './config.js';

function makeBeacon(scene, color) {
  const group = new THREE.Group();
  group.name = 'MissionBeacon';
  const geo = new THREE.CylinderGeometry(2.2, 2.2, 30, 16, 1, true);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.25,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.position.y = 15;
  group.add(beam);
  const marker = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.4, 4),
    new THREE.MeshBasicMaterial({ color }),
  );
  marker.position.y = 6;
  marker.rotation.x = Math.PI;
  group.add(marker);
  group.visible = false;
  scene.add(group);
  return group;
}

export function createMissionManager(scene, audio) {
  const beacon = makeBeacon(scene, 0xf2c94c);
  let missionIndex = 0;
  let objectiveIndex = 0;
  let state = 'idle'; // idle | active | complete | failed
  let timer = 0;
  let dialogueQueue = [];
  let dialogueTimer = 0;
  let currentLine = null;
  let collected = 0;
  let robProgress = 0;
  let packages = [];
  let guards = [];

  function mission() {
    return MISSIONS[missionIndex];
  }
  function objective() {
    const m = mission();
    return m ? m.objectives[objectiveIndex] : null;
  }
  function moveBeaconTo(x, z) {
    beacon.position.set(x, 0, z);
    beacon.visible = true;
  }
  function hideBeacon() {
    beacon.visible = false;
  }

  const api = {
    get missionIndex() {
      return missionIndex;
    },
    get state() {
      return state;
    },
    get currentLine() {
      return currentLine;
    },
    get collected() {
      return collected;
    },
    get timer() {
      return timer;
    },
    missionTitle() {
      const m = mission();
      return m ? m.title : 'Free Roam';
    },
    objectiveText() {
      if (state === 'complete') return 'Mission complete — talk to Mara for the next job.';
      if (state === 'failed') return 'Mission failed — try again.';
      const o = objective();
      if (!o) return 'Explore Neon Bay. Press M for a mission from Mara.';
      if (o.kind === 'collect') return `${o.text} (${collected}/${o.count})`;
      if (o.kind === 'rob' && robProgress > 0) return `Cracking the vault… ${Math.floor(robProgress * 100)}%`;
      return o.text;
    },
    markerPos() {
      const o = objective();
      if (!o || !o.target) return null;
      return o.target;
    },
    startMission(index, world) {
      missionIndex = index;
      objectiveIndex = 0;
      collected = 0;
      robProgress = 0;
      state = 'active';
      const m = mission();
      dialogueQueue = m.dialogue.slice();
      dialogueTimer = 0;
      currentLine = null;
      timer = 0;
      if (m.wantedOnStart) world.wanted.setStars(m.wantedOnStart);
      if (m.id === 'package-run') {
        api.spawnPackages(world);
      }
      const o = objective();
      if (o && o.target) moveBeaconTo(o.target.x, o.target.z);
      else hideBeacon();
    },
    spawnPackages(world) {
      const spots = [
        { x: -182, z: 26 },
        { x: 26, z: -182 },
        { x: 182, z: -26 },
        { x: -26, z: 182 },
        { x: 78, z: 78 },
      ];
      packages = spots.map((s) => world.spawnPackage(s.x, s.z));
    },
    advanceObjective(world) {
      objectiveIndex += 1;
      const m = mission();
      if (objectiveIndex >= m.objectives.length) {
        api.completeMission(world);
        return;
      }
      const o = objective();
      if (o && o.target) moveBeaconTo(o.target.x, o.target.z);
      else hideBeacon();
      if (m.id === 'last-score' && o.kind === 'escape') {
        world.wanted.setStars(4);
      }
    },
    completeMission(world) {
      state = 'complete';
      const m = mission();
      world.addCash(m.reward);
      audio.missionComplete();
      hideBeacon();
      world.onMissionComplete(m);
    },
    failMission(world, reason) {
      state = 'failed';
      audio.missionFail();
      hideBeacon();
      world.onMissionFailed(mission(), reason);
    },
    retryMission(world) {
      api.startMission(missionIndex, world);
    },
    nextMission(world) {
      if (missionIndex + 1 < MISSIONS.length) {
        api.startMission(missionIndex + 1, world);
      } else {
        state = 'idle';
        world.onStoryComplete();
      }
    },
    // Called when Rio steals the mission car, reaches a target, etc.
    onCarStolen(car, world) {
      if (state !== 'active') return;
      const o = objective();
      if (o && o.kind === 'steal' && car.isMissionCar) api.advanceObjective(world);
    },
    update(dt, world) {
      // Dialogue lines, one at a time.
      if (dialogueQueue.length || currentLine) {
        dialogueTimer -= dt;
        if (dialogueTimer <= 0) {
          if (dialogueQueue.length) {
            currentLine = dialogueQueue.shift();
            dialogueTimer = 4.5;
          } else {
            currentLine = null;
          }
        }
      }
      if (state !== 'active') return;
      const o = objective();
      if (!o) return;
      timer += dt;
      const px = world.playerX();
      const pz = world.playerZ();
      if (o.timeLimit && timer > o.timeLimit) {
        api.failMission(world, 'Out of time.');
        return;
      }
      if (o.kind === 'deliver' || o.kind === 'drive' || o.kind === 'escape') {
        if (o.target && Math.hypot(px - o.target.x, pz - o.target.z) < 8) {
          api.advanceObjective(world);
        }
      } else if (o.kind === 'collect') {
        for (let i = packages.length - 1; i >= 0; i -= 1) {
          const pkg = packages[i];
          if (Math.hypot(px - pkg.x, pz - pkg.z) < 3.5) {
            world.collectPackage(pkg);
            packages.splice(i, 1);
            collected += 1;
            audio.pickup();
            if (collected >= o.count) api.advanceObjective(world);
          }
        }
      } else if (o.kind === 'rob') {
        if (o.target && Math.hypot(px - o.target.x, pz - o.target.z) < 10) {
          if (guards.length === 0) {
            guards = world.spawnVaultGuards();
          }
          const alive = guards.filter((g) => !g.dead).length;
          if (alive === 0) {
            robProgress += dt / 5;
            if (robProgress >= 1) {
              world.addCash(1500);
              api.advanceObjective(world);
            }
          }
        }
      }
    },
    updateBeacon(dt) {
      if (beacon.visible) {
        beacon.rotation.y += dt * 1.5;
        beacon.children[1].position.y = 6 + Math.sin(performance.now() / 300) * 0.6;
      }
    },
    setMissionIndex(i) {
      missionIndex = i;
    },
    reset() {
      state = 'idle';
      objectiveIndex = 0;
      collected = 0;
      robProgress = 0;
      dialogueQueue = [];
      currentLine = null;
      packages = [];
      guards = [];
      hideBeacon();
    },
  };
  return api;
}
