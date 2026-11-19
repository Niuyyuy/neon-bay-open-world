// The screenshot scenes behind ?shot=start|play|chase|end. Each one stages
// the real world from a fresh state with a fixed seed and drives it forward
// with a simple autopilot, so the frame is what real play looks like and the
// same seed always gives the same frame. Every scene pins the camera
// explicitly at the end (world.setShotCamera), so the frame is the one the
// maker chose: the chase camera following the car is too far and too high
// for a screenshot, and the on-foot camera can end up facing a wall.
import { STEP } from './config.js';
import { createRandom } from './random.js';

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
 * mission 1 live. chase: a 3-star chase in the red coupe, framed from the
 * side with the nearest police car in the background. end: mission 1
 * delivered at the Marina garage.
 *
 * Staging must be deterministic: the simulation draws on Math.random
 * (traffic turns, police spawn angles, enemy fire), so a plain re-stage
 * gives a different frame on every load — the chase can pile the police
 * into the coupe on one load and look clean on the next. The whole stage
 * runs under a seeded replacement for Math.random, restored afterwards,
 * so seed=1 always stages the same frame.
 */
export function stageShot(name, world) {
  const realRandom = Math.random;
  Math.random = createRandom(1);
  try {
    return stageShotSeeded(name, world);
  } finally {
    Math.random = realRandom;
  }
}

function stageShotSeeded(name, world) {
  world.reset(1);
  if (name === 'play') {
    world.setPlaying(true);
    world.teleportPlayer(-210, -22);
    world.startMission(0);
    driveFor(world, 3, IDLE);
    // Camera on the road, east of Rio, looking west: Rio in the right of
    // the frame, the red coupe dead centre, the pier and the bay behind.
    // The camera sits 8 units north of the first framing so the lamp
    // post at (-215, -32) clears the coupe instead of crossing it.
    world.setShotCamera(-204, 7, -36, -226, 1, -20);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    world.setPlaying(true);
    // The red coupe, not a traffic car: the mission is to steal this car,
    // so the chase has to show it fleeing with the police on its tail.
    world.spawnDrivenCarAt(0, -60, 0xd94f4f, 0);
    world.setWanted(3);
    driveFor(world, 2.5, DRIVE);
    // Handbrake to a near-stop, then sit still: the police cars top out
    // slower than the player's car, so they only catch up once it stops.
    driveFor(world, 1.5, BRAKE);
    driveFor(world, 2.5, IDLE);
    // Stage the police by hand. The chase simulation rams them into the
    // coupe — a police car steers straight at its target, never stops,
    // and nothing pushes it back out, so the frame the simulation leaves
    // behind has one car pressed into the coupe's flank and the other
    // wherever it happened to stop. Teleport each police car to a fixed
    // offset from the coupe instead: flanking it on the road, in pursuit
    // formation, stopped. The world is frozen right after staging, so
    // nothing moves again and the frame holds exactly as staged.
    const car = world.drivenCar();
    const cops = world.wanted.policeCars;
    if (car && cops.length) {
      const fx = Math.sin(car.heading);
      const fz = Math.cos(car.heading);
      const rx = Math.cos(car.heading);
      const rz = -Math.sin(car.heading);
      // The police flank the coupe, same heading as it, 5 units to each
      // side. Facing the coupe would turn their long side toward a camera
      // looking down the road and make them overlap the coupe on screen;
      // facing forward they read as a chase formation with a clean gap
      // between the cars. A third car, if there ever is one, goes ahead
      // on the left instead of behind the coupe, where a rear camera
      // would put it on top of the coupe.
      const spots = [
        { dx: -rx * 6, dz: -rz * 6 },
        { dx: rx * 6, dz: rz * 6 },
        { dx: -rx * 6 + fx * 8, dz: -rz * 6 + fz * 8 },
      ];
      for (let i = 0; i < cops.length; i += 1) {
        const cop = cops[i];
        const spot = spots[i % spots.length];
        cop.x = car.x + spot.dx;
        cop.z = car.z + spot.dz;
        cop.heading = car.heading;
        cop.speed = 0;
        cop.mesh.position.set(cop.x, 0, cop.z);
        cop.mesh.rotation.y = cop.heading;
      }
      // Clear the hero cluster: a traffic car the simulation left beside
      // the coupe would crowd the same patch of screen, so move any car
      // within 7 units of the coupe back down the road behind the camera,
      // keeping its lane. It stays a real traffic car, just not in shot.
      let cleared = 0;
      for (const t of world.hudState().traffic) {
        if (Math.hypot(t.x - car.x, t.z - car.z) < 7) {
          t.z = car.z - 30 - cleared * 6;
          t.speed = 0;
          t.mesh.position.set(t.x, 0, t.z);
          t.mesh.rotation.y = t.heading;
          cleared += 1;
        }
      }
      // Frame from behind the coupe's right flank, looking down the road:
      // the coupe centre frame, both police cars flanking it with a clean
      // gap, the road running away ahead of them.
      const camX = car.x + rx * 3 - fx * 16;
      const camZ = car.z + rz * 3 - fz * 16;
      world.setShotCamera(camX, 6.5, camZ, car.x + fx * 2, 1.5, car.z + fz * 2);
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
