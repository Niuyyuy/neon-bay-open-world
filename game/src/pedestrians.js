// Pedestrians: they stroll the sidewalks, scatter from gunfire and cars,
// and fall down when a car hits them (which the law notices).
import * as THREE from 'three';
import { PEDESTRIANS } from './config.js';
import { pick, range } from './random.js';

const SKINS = [0x8a5a3a, 0xc9a06a, 0x6a4a2a, 0xe8c9a0];
const SHIRTS = [0xd94f4f, 0x4f7ad9, 0x4fd97a, 0xd9c94f, 0x9a4fd9, 0xe8e8e8, 0x333333];

export function createPedestrianMesh(random) {
  const group = new THREE.Group();
  group.name = 'Pedestrian';
  const shirt = new THREE.MeshLambertMaterial({ color: pick(random, SHIRTS) });
  const skin = new THREE.MeshLambertMaterial({ color: pick(random, SKINS) });
  const pants = new THREE.MeshLambertMaterial({ color: pick(random, [0x2a3a5a, 0x3a2a1a, 0x555555]) });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.75, 0.4), shirt);
  torso.position.y = 1.15;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
  head.position.y = 1.75;
  head.castShadow = true;
  group.add(head);
  const legs = [];
  for (const x of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.75, 0.26), pants);
    leg.position.set(x, 0.38, 0);
    group.add(leg);
    legs.push(leg);
  }
  const arms = [];
  for (const x of [-0.48, 0.48]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.2), shirt);
    arm.position.set(x, 1.15, 0);
    group.add(arm);
    arms.push(arm);
  }
  group.userData.legs = legs;
  group.userData.arms = arms;
  return group;
}

export function createPedestrianManager(scene, city, random) {
  const peds = [];
  function spawnOne() {
    const line = pick(random, city.lines);
    const side = random() < 0.5 ? 1 : -1;
    const along = range(random, -city.half + 20, city.half - 20);
    const axis = random() < 0.5 ? 'x' : 'z';
    const ped = {
      mesh: createPedestrianMesh(random),
      x: axis === 'x' ? along : line + side * 8,
      z: axis === 'x' ? line + side * 8 : along,
      axis,
      dir: random() < 0.5 ? 1 : -1,
      speed: range(random, PEDESTRIANS.speed * 0.7, PEDESTRIANS.speed * 1.3),
      heading: 0,
      state: 'walk',
      downTimer: 0,
      walkPhase: random() * Math.PI * 2,
    };
    ped.mesh.position.set(ped.x, 0, ped.z);
    scene.add(ped.mesh);
    return ped;
  }
  for (let i = 0; i < PEDESTRIANS.count; i += 1) peds.push(spawnOne());

  return {
    peds,
    update(dt, threats) {
      for (const ped of peds) {
        if (ped.state === 'down') {
          ped.downTimer -= dt;
          if (ped.downTimer <= 0) {
            ped.state = 'walk';
            ped.mesh.rotation.x = 0;
            ped.mesh.position.y = 0;
          }
          continue;
        }
        // Flee from the nearest threat (gunfire, a speeding car).
        let fleeX = 0;
        let fleeZ = 0;
        for (const threat of threats || []) {
          const dx = ped.x - threat.x;
          const dz = ped.z - threat.z;
          const d = Math.hypot(dx, dz);
          if (d < threat.radius) {
            fleeX += dx / (d || 1);
            fleeZ += dz / (d || 1);
          }
        }
        let speed = ped.speed;
        let hx = 0;
        let hz = 0;
        if (fleeX || fleeZ) {
          const len = Math.hypot(fleeX, fleeZ);
          hx = fleeX / len;
          hz = fleeZ / len;
          speed = ped.speed * 2.6;
          ped.state = 'flee';
        } else {
          ped.state = 'walk';
          if (ped.axis === 'x') {
            hx = ped.dir;
            hz = 0;
          } else {
            hx = 0;
            hz = ped.dir;
          }
          // At an intersection, sometimes turn onto the cross road.
          const nearLine = city.lines.find((l) => Math.abs((ped.axis === 'x' ? ped.x : ped.z) - l) < 1);
          if (nearLine !== undefined && Math.random() < 0.008) {
            ped.axis = ped.axis === 'x' ? 'z' : 'x';
            ped.dir = Math.random() < 0.5 ? 1 : -1;
          }
        }
        ped.x += hx * speed * dt;
        ped.z += hz * speed * dt;
        ped.heading = Math.atan2(hx, hz);
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
        ped.walkPhase += dt * speed * 4;
        const swing = Math.sin(ped.walkPhase) * 0.5;
        ped.mesh.userData.legs[0].rotation.x = swing;
        ped.mesh.userData.legs[1].rotation.x = -swing;
        ped.mesh.userData.arms[0].rotation.x = -swing * 0.7;
        ped.mesh.userData.arms[1].rotation.x = swing * 0.7;
        if (Math.abs(ped.x) > city.half || Math.abs(ped.z) > city.half) {
          const fresh = spawnOne();
          ped.x = fresh.x;
          ped.z = fresh.z;
          ped.axis = fresh.axis;
          ped.dir = fresh.dir;
        }
      }
    },
    knockDown(ped) {
      if (ped.state === 'down') return false;
      ped.state = 'down';
      ped.downTimer = 6;
      ped.mesh.rotation.x = -Math.PI / 2;
      ped.mesh.position.y = 0.4;
      return true;
    },
  };
}
