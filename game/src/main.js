// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps (several in a slow frame, none in a fast one), the HUD
// updates and the renderer paints what is there. Screens: title, play,
// paused, busted, wasted and story complete.
//
// ?seed=N fixes the world. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP, GAME_TITLE, STORY } from './config.js';
import { createWorld } from './world.js';
import { createHUD } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const hudEl = document.getElementById('hud');
const world = createWorld(canvas, seed);
const hud = createHUD(hudEl, world.city);

function announce(message) {
  status.textContent = message;
}

const screens = {
  title: document.getElementById('screen-title'),
  pause: document.getElementById('screen-pause'),
  busted: document.getElementById('screen-busted'),
  wasted: document.getElementById('screen-wasted'),
  story: document.getElementById('screen-story'),
};
function showScreen(name) {
  for (const [key, el] of Object.entries(screens)) {
    el.style.display = key === name ? 'flex' : 'none';
  }
  if (name) hud.hide();
  else hud.show();
}

// Wire the world's events to the HUD and the screens.
world.callbacks.onMissionComplete = (m) => {
  // In a staged screenshot (?shot=...) the capture happens seconds after
  // staging, so the banner must stay up; in real play it fades as usual.
  hud.banner('MISSION COMPLETE', `${m.title} — $${m.reward.toLocaleString('en-US')}`, shot !== null);
  hud.toast(`Next job: press M when you are ready.`);
  world.save();
  announce(`Mission complete: ${m.title}. $${m.reward}.`);
};
world.callbacks.onMissionFailed = (m, reason) => {
  hud.banner('MISSION FAILED', reason || '');
  hud.toast('Press M to retry the mission.');
  announce(`Mission failed. ${reason || ''}`);
};
world.callbacks.onStoryComplete = () => {
  document.getElementById('story-cash').textContent = `$${world.cash.toLocaleString('en-US')}`;
  showScreen('story');
  announce('Story complete. Neon Bay is yours, Rio.');
};
world.callbacks.onBusted = () => {
  document.getElementById('busted-cash').textContent = `$${world.cash.toLocaleString('en-US')}`;
  showScreen('busted');
  announce('Busted. The police took you in.');
};
world.callbacks.onWasted = () => {
  showScreen('wasted');
  announce('Wasted. Rio is down.');
};

function startNewGame() {
  world.reset(seed);
  world.setPlaying(true);
  showScreen(null);
  announce(`${GAME_TITLE}. ${STORY.intro}`);
}
function continueGame() {
  world.reset(seed);
  world.load();
  world.setPlaying(true);
  showScreen(null);
  announce('Welcome back to Neon Bay.');
}
function resumeGame() {
  world.setPlaying(true);
  showScreen(null);
  announce('Playing.');
}
function pauseGame() {
  world.setPlaying(false);
  world.save();
  showScreen('pause');
  announce('Paused. Progress saved.');
}

document.getElementById('btn-new').addEventListener('click', () => { world.audio.unlock(); startNewGame(); });
document.getElementById('btn-continue').addEventListener('click', () => { world.audio.unlock(); continueGame(); });
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-save').addEventListener('click', () => {
  hud.toast(world.save() ? 'Progress saved.' : 'Could not save.');
});
document.getElementById('btn-restart-mission').addEventListener('click', () => {
  world.missions.retryMission(world);
  resumeGame();
});
document.getElementById('btn-quit-title').addEventListener('click', () => {
  world.setPlaying(false);
  showScreen('title');
  refreshTitleButtons();
});
for (const id of ['btn-retry', 'btn-busted-title', 'btn-wasted-title', 'btn-story-title']) {
  const el = document.getElementById(id);
  if (!el) continue;
  el.addEventListener('click', () => {
    if (id === 'btn-retry') {
      world.respawn();
      showScreen(null);
      announce('Back on the streets.');
    } else {
      world.setPlaying(false);
      showScreen('title');
      refreshTitleButtons();
    }
  });
}

function refreshTitleButtons() {
  document.getElementById('btn-continue').style.display = world.hasSave() ? 'inline-block' : 'none';
}

// --- Input: keyboard, mouse drag for the camera, click to shoot. ---
const keys = new Set();
let mouseDX = 0;
let mouseDY = 0;
let dragging = false;
let dragMoved = 0;
let lastX = 0;
let lastY = 0;
let shootFlag = false;
let interactFlag = false;
let missionFlag = false;

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === 'KeyE') interactFlag = true;
  if (e.code === 'KeyM') missionFlag = true;
  if ((e.code === 'Escape' || e.code === 'KeyP')) {
    if (world.playing) pauseGame();
    else if (screens.pause.style.display === 'flex') resumeGame();
  }
  if (e.code === 'Space') e.preventDefault();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
canvas.addEventListener('mousedown', (e) => {
  dragging = true;
  dragMoved = 0;
  lastX = e.clientX;
  lastY = e.clientY;
});
window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  dragMoved += Math.abs(dx) + Math.abs(dy);
  mouseDX += dx;
  mouseDY += dy;
});
window.addEventListener('mouseup', () => {
  if (dragging && dragMoved < 6 && world.playing) shootFlag = true;
  dragging = false;
});

function readInput() {
  const input = {
    forward: keys.has('KeyW') || keys.has('ArrowUp'),
    back: keys.has('KeyS') || keys.has('ArrowDown'),
    left: keys.has('KeyA') || keys.has('ArrowLeft'),
    right: keys.has('KeyD') || keys.has('ArrowRight'),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
    handbrake: keys.has('Space'),
    shoot: shootFlag,
    interact: interactFlag,
    missionKey: missionFlag,
    mouseDX,
    mouseDY,
  };
  mouseDX = 0;
  mouseDY = 0;
  shootFlag = false;
  interactFlag = false;
  missionFlag = false;
  return input;
}

function runShot(name) {
  const staged = stageShot(name, world);
  if (staged.screen === 'title') {
    refreshTitleButtons();
    showScreen('title');
  } else {
    showScreen(null);
    hud.update(world.hudState());
  }
  let painted = 0;
  function paint() {
    world.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  refreshTitleButtons();
  showScreen('title');
  announce(`${GAME_TITLE}. Press New Game to start.`);

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const input = readInput();
    if (world.playing) {
      while (accumulator >= STEP) {
        world.update(STEP, input);
        accumulator -= STEP;
      }
      hud.update(world.hudState());
    } else {
      accumulator = 0;
      world.update(STEP, input);
    }
    world.render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && world.playing) pauseGame();
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
