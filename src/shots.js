// The screenshot scenes behind ?shot=start|play|chase|end. Each one stages
// the real world from a fresh state with a fixed seed and drives it forward
// with a simple autopilot, so the frame is what real play looks like and the
// same seed always gives the same frame.
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

/**
 * Stage `world` to the named scene and return the screen to draw over it.
 * start: the title screen over the city. play: Rio on foot by the Harbor
 * docks with mission 1 live and traffic passing. chase: a 3-star chase in
 * the red coupe. end: mission 1 delivered at the Marina garage.
 */
export function stageShot(name, world) {
  world.reset(1);
  if (name === 'play') {
    world.setPlaying(true);
    world.teleportPlayer(-186, 18);
    world.startMission(0);
    driveFor(world, 3, IDLE);
    return { screen: 'play' };
  }
  if (name === 'chase') {
    world.setPlaying(true);
    world.spawnDrivenCarAt(-20, -60, 0x2ecc71);
    world.setWanted(3);
    driveFor(world, 4, DRIVE);
    return { screen: 'play' };
  }
  if (name === 'end') {
    world.setPlaying(true);
    world.startMission(0);
    world.spawnDrivenCarAt(178, -30, 0xd94f4f);
    driveFor(world, 1.5, DRIVE);
    // Park beside the garage, step out, hand the car over.
    world.update(SAMPLE, { interact: true, mouseDX: 0, mouseDY: 0 });
    world.missions.completeMission(world);
    driveFor(world, 0.5, IDLE);
    return { screen: 'play' };
  }
  // start: title screen over a slow orbit of the city.
  world.setPlaying(false);
  return { screen: 'title' };
}
