// Arcade car physics: accelerate, brake, reverse, steer, drift on the
// handbrake, and crash into buildings, cars and pedestrians. One car is
// driven at a time; the rest are traffic.
import * as THREE from 'three';
import { CAR } from './config.js';
import { collideCircleBox, clampToCity } from './city.js';

export function createDrivenCar(scene, mesh) {
  return {
    mesh,
    x: mesh.position.x,
    z: mesh.position.z,
    heading: mesh.rotation.y,
    speed: 0,
    steer: 0,
    health: CAR.health,
    update(dt, throttle, brake, steerInput, handbrake, city, others, onCrash) {
      // Steering follows the wheel: sharper at low speed, calmer at speed.
      const steerTarget = steerInput * CAR.steerMax * Math.max(0.35, 1 - Math.abs(this.speed) / CAR.maxSpeed);
      this.steer += (steerTarget - this.steer) * Math.min(1, dt * 8);
      if (throttle) this.speed += CAR.accel * dt;
      if (brake) {
        if (this.speed > 0.5) this.speed -= CAR.brake * dt;
        else this.speed -= CAR.reverseAccel * dt;
      }
      if (!throttle && !brake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 8 * dt);
      if (handbrake) {
        this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 20 * dt);
        this.steer *= 1.6;
      }
      this.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, this.speed));
      const turn = this.steer * (this.speed / CAR.length) * (handbrake ? 1.5 : 1) * dt;
      this.heading += turn * Math.sign(this.speed || 1);
      let nx = this.x + Math.sin(this.heading) * this.speed * dt;
      let nz = this.z + Math.cos(this.heading) * this.speed * dt;
      const clamped = clampToCity(nx, nz, city.half);
      nx = clamped.x;
      nz = clamped.z;
      const hit = collideCircleBox(nx, nz, CAR.length / 2, city.colliders);
      if (hit.hit && Math.abs(this.speed) > 6) {
        onCrash(Math.abs(this.speed));
        this.speed *= -0.3;
      }
      this.x = hit.x;
      this.z = hit.z;
      // Bump into other cars.
      for (const other of others) {
        if (other === this || !other.mesh) continue;
        const dx = this.x - other.x;
        const dz = this.z - other.z;
        const d = Math.hypot(dx, dz);
        if (d < 3.6 && d > 0.01) {
          const push = (3.6 - d) / 2;
          this.x += (dx / d) * push;
          this.z += (dz / d) * push;
          if (Math.abs(this.speed) > 8) onCrash(Math.abs(this.speed) * 0.7);
          this.speed *= 0.85;
        }
      }
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.heading;
      const spin = this.speed * dt * 2.5;
      for (const wheel of this.mesh.userData.wheels) wheel.rotation.x += spin;
      return { speed: this.speed };
    },
    placeCamera(camera, yaw, pitch) {
      const d = 11;
      const cx = this.x - Math.sin(this.heading) * Math.cos(pitch) * d;
      const cz = this.z - Math.cos(this.heading) * Math.cos(pitch) * d;
      const cy = 4 + Math.sin(pitch) * d;
      camera.position.set(cx, Math.max(1.5, cy), cz);
      camera.lookAt(this.x + Math.sin(this.heading) * 6, 1.5, this.z + Math.cos(this.heading) * 6);
    },
  };
}

// Walk up to a car and press E: the driver is pulled out (or the car is
// empty) and Rio takes the wheel. Press E again to get out beside it.
export function nearestCar(x, z, cars, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}
