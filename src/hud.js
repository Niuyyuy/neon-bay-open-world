// The HUD: health, cash, wanted stars, mission objective, speed, clock,
// minimap and dialogue. All DOM except the minimap, which is a 2D canvas.
import { WANTED } from './config.js';

export function createHUD(container, city) {
  container.innerHTML = `
    <div id="hud-topleft">
      <div id="hud-health"><div id="hud-health-fill"></div><span id="hud-health-text">100</span></div>
      <div id="hud-cash">$<span id="hud-cash-value">0</span></div>
      <div id="hud-clock"><span id="hud-clock-value">09:00</span> · Neon Bay</div>
    </div>
    <div id="hud-topright"><div id="hud-stars"></div><div id="hud-district">Downtown</div></div>
    <div id="hud-objective"><div id="hud-mission-title"></div><div id="hud-mission-text"></div></div>
    <div id="hud-minimap-wrap"><canvas id="hud-minimap" width="190" height="190"></canvas><div id="hud-compass">N</div></div>
    <div id="hud-speed"><span id="hud-speed-value">0</span><span id="hud-speed-unit"> km/h</span></div>
    <div id="hud-dialogue"><span id="hud-dialogue-speaker"></span><span id="hud-dialogue-line"></span></div>
    <div id="hud-toast"></div>
    <div id="hud-crosshair">+</div>
    <div id="hud-damage"></div>
    <div id="hud-banner"></div>
  `;
  const el = (id) => container.querySelector(`#${id}`);
  const minimap = el('hud-minimap');
  const mctx = minimap.getContext('2d');
  let toastTimer = null;
  let bannerTimer = null;

  function drawMinimap(state) {
    const s = 190;
    const half = city.half;
    const toMap = (x, z) => [((x + half) / (half * 2)) * s, ((z + half) / (half * 2)) * s];
    mctx.clearRect(0, 0, s, s);
    mctx.fillStyle = 'rgba(10, 20, 30, 0.85)';
    mctx.fillRect(0, 0, s, s);
    // Roads.
    mctx.strokeStyle = '#5a6068';
    mctx.lineWidth = 4;
    for (const line of city.lines) {
      const [x1, y1] = toMap(line, -half);
      const [x2, y2] = toMap(line, half);
      mctx.beginPath();
      mctx.moveTo(x1, y1);
      mctx.lineTo(x2, y2);
      mctx.stroke();
      const [x3, y3] = toMap(-half, line);
      const [x4, y4] = toMap(half, line);
      mctx.beginPath();
      mctx.moveTo(x3, y3);
      mctx.lineTo(x4, y4);
      mctx.stroke();
    }
    // Buildings.
    mctx.fillStyle = '#2a323e';
    for (const b of city.buildings) {
      const [x, y] = toMap(b.x - b.w / 2, b.z - b.d / 2);
      const [x2, y2] = toMap(b.x + b.w / 2, b.z + b.d / 2);
      mctx.fillRect(x, y, x2 - x, y2 - y);
    }
    // Mission marker.
    if (state.marker) {
      const [x, y] = toMap(state.marker.x, state.marker.z);
      const pulse = 6 + Math.sin(performance.now() / 200) * 2;
      mctx.fillStyle = '#f2c94c';
      mctx.beginPath();
      mctx.arc(x, y, pulse, 0, Math.PI * 2);
      mctx.fill();
    }
    // Traffic dots, police red, player white arrow.
    for (const car of state.traffic || []) {
      const [x, y] = toMap(car.x, car.z);
      mctx.fillStyle = '#f2c94c';
      mctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    for (const cop of state.police || []) {
      const [x, y] = toMap(cop.x, cop.z);
      mctx.fillStyle = '#ff3344';
      mctx.beginPath();
      mctx.arc(x, y, 3, 0, Math.PI * 2);
      mctx.fill();
    }
    const [px, py] = toMap(state.playerX, state.playerZ);
    mctx.save();
    mctx.translate(px, py);
    mctx.rotate(state.playerHeading || 0);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -7);
    mctx.lineTo(5, 6);
    mctx.lineTo(-5, 6);
    mctx.closePath();
    mctx.fill();
    mctx.restore();
  }

  return {
    update(state) {
      el('hud-health-fill').style.width = `${Math.max(0, state.health)}%`;
      el('hud-health-fill').style.background = state.health > 50 ? '#2ecc71' : state.health > 25 ? '#f2c94c' : '#e74c3c';
      el('hud-health-text').textContent = Math.ceil(state.health);
      el('hud-cash-value').textContent = state.cash.toLocaleString('en-US');
      el('hud-clock-value').textContent = state.clock;
      // The district arrives as a plain name string (world.js hands over
      // districtAt(...).name, never the district object itself).
      el('hud-district').textContent = typeof state.district === 'string'
        ? state.district
        : (state.district && state.district.name ? state.district.name : '');
      let stars = '';
      for (let i = 0; i < WANTED.maxStars; i += 1) {
        stars += `<span class="${i < state.stars ? 'star on' : 'star'}">★</span>`;
      }
      el('hud-stars').innerHTML = stars;
      el('hud-mission-title').textContent = state.missionTitle;
      el('hud-mission-text').textContent = state.objectiveText;
      el('hud-speed').style.display = state.driving ? 'block' : 'none';
      if (state.driving) el('hud-speed-value').textContent = Math.round(Math.abs(state.speed) * 3.6);
      el('hud-crosshair').style.display = state.driving ? 'none' : 'block';
      const dialogue = el('hud-dialogue');
      if (state.dialogue) {
        dialogue.style.display = 'block';
        el('hud-dialogue-speaker').textContent = state.dialogue[0];
        el('hud-dialogue-line').textContent = state.dialogue[1];
      } else {
        dialogue.style.display = 'none';
      }
      drawMinimap(state);
    },
    toast(text, ms) {
      const t = el('hud-toast');
      t.textContent = text;
      t.style.opacity = '1';
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        t.style.opacity = '0';
      }, ms || 3000);
    },
    banner(text, subtext) {
      const b = el('hud-banner');
      b.innerHTML = `<div class="banner-title">${text}</div><div class="banner-sub">${subtext || ''}</div>`;
      b.style.opacity = '1';
      if (bannerTimer) clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => {
        b.style.opacity = '0';
      }, 4000);
    },
    damageFlash() {
      const d = el('hud-damage');
      d.style.opacity = '0.55';
      setTimeout(() => {
        d.style.opacity = '0';
      }, 180);
    },
    show() {
      container.style.display = 'block';
    },
    hide() {
      container.style.display = 'none';
    },
  };
}
