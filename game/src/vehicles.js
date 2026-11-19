// Cars: how they look, how traffic drives them, how police chase.
// A car is a group: body, cabin, wheels, lights. Traffic follows the road
// grid; police steer straight at the player and ram.
import * as THREE from 'three';
import { CAR, PALETTE, TRAFFIC } from './config.js';
import { pick, range } from './random.js';

export function createCarMesh(color, isPolice) {
  const group = new THREE.Group();
  group.name = isPolice ? 'PoliceCar' : 'TrafficCar';
  const bodyColor = isPolice ? 0xf0f0f0 : color;
  const bodyMat = new THREE.MeshLambertMaterial({ color: bodyColor });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x18202a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.75, CAR.length), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width * 0.85, 0.65, CAR.length * 0.45), darkMat);
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, 0.38, z);
    group.add(wheel);
    wheels.push(wheel);
  }
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c0, emissive: 0x555533 });
  for (const x of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
    lamp.position.set(x, 0.6, CAR.length / 2 + 0.02);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0x440000 });
  for (const x of [-0.7, 0.7]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    lamp.position.set(x, 0.6, -CAR.length / 2 - 0.02);
    group.add(lamp);
  }
  let lightBar = null;
  if (isPolice) {
    lightBar = new THREE.Group();
    const red = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0xff0000 }),
    );
    red.position.x = -0.35;
    const blue = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x0000ff }),
    );
    blue.position.x = 0.35;
    lightBar.add(red);
    lightBar.add(blue);
    lightBar.position.set(0, 1.65, -0.2);
    group.add(lightBar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(CAR.width + 0.02, 0.3, CAR.length + 0.02),
      new THREE.MeshLambertMaterial({ color: PALETTE.police }),
    );
    stripe.position.y = 0.55;
    group.add(stripe);
  }
  group.userData.wheels = wheels;
  group.userData.lightBar = lightBar;
  return group;
}

// One traffic car: a road, a lane, a direction and a speed.
function spawnTrafficCar(city, random) {
  const axis = random() < 0.5 ? 'x' : 'z';
  const line = pick(random, city.lines);
  const dir = random() < 0.5 ? 1 : -1;
  const lane = line + dir * 3 * (axis === 'x' ? 1 : -1);
  const along = range(random, -city.half + 20, city.half - 20);
  const pos = axis === 'x' ? { x: along, z: lane } : { x: lane, z: along };
  return {
    mesh: createCarMesh(pick(random, PALETTE.carColors), false),
    x: pos.x,
    z: pos.z,
    axis,
    dir,
    speed: range(random, TRAFFIC.speed * 0.7, TRAFFIC.speed * 1.2),
    heading: axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
    parked: false,
    driver: true,
  };
}

export function createTrafficManager(scene, city, random) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const car = spawnTrafficCar(city, random);
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    scene.add(car.mesh);
    cars.push(car);
  }
  // A few parked cars along curbs, ready to steal.
  const parked = [];
  for (let i = 0; i < 6; i += 1) {
    const line = pick(random, city.lines);
    const along = range(random, -city.half + 30, city.half - 30);
    const side = random() < 0.5 ? 1 : -1;
    const x = line + side * 8;
    const car = {
      mesh: createCarMesh(pick(random, PALETTE.carColors), false),
      x,
      z: along,
      axis: 'z',
      dir: side,
      speed: 0,
      heading: side > 0 ? 0 : Math.PI,
      parked: true,
      driver: false,
    };
    car.mesh.position.set(x, 0, along);
    car.mesh.rotation.y = car.heading;
    scene.add(car.mesh);
    parked.push(car);
  }
  return {
    cars,
    parked,
    allCars() {
      return cars.concat(parked);
    },
    update(dt, playerPos) {
      for (const car of cars) {
        // Slow down for the car ahead on the same road.
        let target = car.speed;
        for (const other of cars) {
          if (other === car || other.axis !== car.axis) continue;
          const along = car.axis === 'x' ? other.x - car.x : other.z - car.z;
          const across = car.axis === 'x' ? other.z - car.z : other.x - car.x;
          if (Math.abs(across) < 4 && along * car.dir > 0 && along * car.dir < TRAFFIC.minGap) {
            target = 0;
          }
        }
        // Brake for the player standing in the road.
        if (playerPos) {
          const dx = playerPos.x - car.x;
          const dz = playerPos.z - car.z;
          const ahead = car.axis === 'x' ? dx * car.dir : dz * car.dir;
          const across = car.axis === 'x' ? dz : dx;
          if (ahead > 0 && ahead < 10 && Math.abs(across) < 4) target = 0;
        }
        car.speed += Math.sign(target - car.speed) * 8 * dt;
        if (car.axis === 'x') car.x += car.dir * car.speed * dt;
        else car.z += car.dir * car.speed * dt;
        // At an intersection, sometimes turn onto the cross road.
        const nearLine = city.lines.find((l) => Math.abs((car.axis === 'x' ? car.x : car.z) - l) < 1.5);
        if (nearLine !== undefined && Math.random() < 0.01) {
          const turn = Math.random() < 0.5 ? 1 : -1;
          if (car.axis === 'x') {
            car.axis = 'z';
            car.dir = turn;
            car.z = nearLine + turn * 3;
            car.heading = turn > 0 ? 0 : Math.PI;
          } else {
            car.axis = 'x';
            car.dir = turn;
            car.x = nearLine + turn * 3;
            car.heading = turn > 0 ? Math.PI / 2 : -Math.PI / 2;
          }
        }
        // Out of town: loop back to the far side.
        if (car.x > city.half + 10 || car.x < -city.half - 10 || car.z > city.half + 10 || car.z < -city.half - 10) {
          const fresh = spawnTrafficCar(city, Math.random);
          car.x = fresh.x;
          car.z = fresh.z;
          car.axis = fresh.axis;
          car.dir = fresh.dir;
          car.heading = fresh.heading;
        }
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.heading;
        const spin = car.speed * dt * 2.5;
        for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin;
      }
    },
  };
}

// A police car chases a target: steer toward it, ram it, keep up.
export function createPoliceCar(scene, x, z) {
  const mesh = createCarMesh(0, true);
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  return {
    mesh,
    x,
    z,
    heading: 0,
    speed: 0,
    update(dt, target) {
      const dx = target.x - this.x;
      const dz = target.z - this.z;
      const dist = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let diff = want - this.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = dist > 6 ? 30 : 12;
      this.speed += Math.sign(targetSpeed - this.speed) * 18 * dt;
      this.x += Math.sin(this.heading) * this.speed * dt;
      this.z += Math.cos(this.heading) * this.speed * dt;
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      // Flash the light bar.
      const bar = this.mesh.userData.lightBar;
      if (bar) {
        const on = Math.floor(performance.now() / 250) % 2 === 0;
        bar.children[0].material.emissiveIntensity = on ? 2 : 0.2;
        bar.children[1].material.emissiveIntensity = on ? 0.2 : 2;
      }
      return dist;
    },
  };
}
