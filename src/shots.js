// The screenshot scenes behind ?shot=start|play|chase|end. Each one stages
// the real world from a fresh state with a fixed seed and drives it forward
// with a simple autopilot, so the frame is what real play looks like and the
// same seed always gives the same frame. Every scene pins the camera
// explicitly at the end (world.setShotCamera), so the frame is the one the
// maker chose: the chase camera following the car is too far and too high
// for a screenshot, and the on-foot camera can end up facing a wall.
import { STEP } from './config.js';

const SAMPLE = STEP;

// Drive the world forward for `seconds` with the given input held.
function driveFor(world, seconds, input) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    world.update(SAMPLE, input);
  }
}

const IDLE = { mouseDX: 0, mouseDY: 0 };
const DRIVE = { forward: true, mouseDX: 0, mouseDY: 0 };
const BRAKE = { handbrake: true, mouseDX: 0, mouseDY: 0 };

/**
 * Stage `world` to the named scene and return the screen to draw over it.
 * start: the title screen over a high view of the city. play: Rio on foot
 * at the Harbor docks, the red coupe and the pier and the bay behind him,
 * mission 1 live. chase: a 3-star chase in a green car, framed from the
 * side with the nearest police car in the background. end: mission 1
 * delivered at the Marina garage.
 */
export function stageShot(name, world) {
  world.reset(1);
  if (name === 'play') {
    world.setPlaying(true);
    world.teleportPlayer(-210, -22);
    world.startMission(0);
    driveFor(world, 3, IDLE);
    // Camera on the road, east of Rio, looking west: Rio in the right of
    // the frame, the red coupe dead centre, the pier and the bay behind.
    world.setShotCamera(-204, 6, -44, -226, 1, -20);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    world.setPlaying(true);
    world.spawnDrivenCarAt(0, -60, 0x2ecc71, 0);
    world.setWanted(3);
    driveFor(world, 2.5, DRIVE);
    // Handbrake to a near-stop, then sit still: the police cars top out
    // slower than the player's car, so they only catch up once it stops.
    driveFor(world, 1.5, BRAKE);
    driveFor(world, 2.5, IDLE);
    // Frame the car and the nearest police car together: camera off to
    // the side of their midpoint, about their separation away, looking at
    // the midpoint, so both read at a glance.
    const car = world.drivenCar();
    const cops = world.wanted.policeCars;
    if (car && cops.length) {
      let best = cops[0];
      let bestD = Infinity;
      for (const cop of cops) {
        const d = Math.hypot(cop.x - car.x, cop.z - car.z);
        if (d < bestD) {
          bestD = d;
          best = cop;
        }
      }
      const mx = (car.x + best.x) / 2;
      const mz = (car.z + best.z) / 2;
      const dx = best.x - car.x;
      const dz = best.z - car.z;
      const len = Math.hypot(dx, dz) || 1;
      const off = Math.max(12, bestD);
      const cx = mx + (-dz / len) * off;
      const cz = mz + (dx / len) * off;
      world.setShotCamera(cx, 5, cz, mx, 1.5, mz);
    } else if (car) {
      world.setShotCamera(car.x + 10, 4.5, car.z - 10, car.x, 1.5, car.z);
    }
    return { screen: 'play' };
  }
  if (name === 'end') {
    world.setPlaying(true);
    world.startMission(0);
    world.spawnDrivenCarAt(-208, 100, 0xd94f4f, 0);
    driveFor(world, 1.5, DRIVE);
    // Park at the garage, step out, hand the car over.
    world.update(SAMPLE, { interact: true, mouseDX: 0, mouseDY: 0 });
    world.missions.completeMission(world);
    driveFor(world, 0.5, IDLE);
    // Camera on the road north of the garage, looking south: the garage
    // centre frame, the red coupe and Rio in front of its yellow door.
    world.setShotCamera(-208, 6, 100, -214, 1.5, 130);
    return { screen: 'play' };
  }
  // start: title screen over a high view of the city.
  world.setPlaying(false);
  world.setShotCamera(140, 90, -160, 0, 10, 0);
  return { screen: 'title' };
}
