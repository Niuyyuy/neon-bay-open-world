// All sound is synthesized with WebAudio — no audio files, no network.
// Engine hum, sirens, gunshots, crashes, pickups and a low-key bass loop.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let musicTimer = null;
  let engineOsc = null;
  let engineGain = null;

  function ensure() {
    if (ctx) return true;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol || 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function noise(dur, vol, filterFreq) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 1200;
    const gain = ctx.createGain();
    gain.gain.value = vol || 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t);
  }

  // A slow two-tone siren that keeps wailing while police are near.
  let sirenOsc = null;
  let sirenGain = null;
  let sirenStep = 0;
  let sirenTimer = null;

  const api = {
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      noise(0.12, 0.5, 3200);
      tone(180, 0.08, 'square', 0.12, 60);
    },
    crash() {
      noise(0.25, 0.5, 500);
      tone(70, 0.2, 'sine', 0.3, 40);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.2);
      setTimeout(() => tone(990, 0.12, 'sine', 0.2), 90);
    },
    missionComplete() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.22), i * 110));
    },
    missionFail() {
      tone(220, 0.4, 'sawtooth', 0.15, 110);
    },
    horn() {
      tone(370, 0.18, 'square', 0.12);
      tone(466, 0.18, 'square', 0.1);
    },
    door() {
      noise(0.08, 0.2, 900);
    },
    setEngine(rpm) {
      if (!ensure() || muted) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineGain.gain.value = 0.0;
        engineOsc.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + rpm * 140;
      engineGain.gain.value = 0.03 + rpm * 0.05;
    },
    // Called when the player is hurt, starts a car, or drives: these were
    // missing from the API and threw TypeError mid-update.
    hurt() {
      tone(140, 0.15, 'sawtooth', 0.2, 70);
    },
    engineStart() {
      api.setEngine(0);
    },
    setEnginePitch(ratio) {
      api.setEngine(Math.max(0, Math.min(1, ratio || 0)));
    },
    stopEngine() {
      if (engineGain) engineGain.gain.value = 0;
    },
    startSiren() {
      if (!ensure() || sirenOsc) return;
      sirenOsc = ctx.createOscillator();
      sirenGain = ctx.createGain();
      sirenOsc.type = 'triangle';
      sirenGain.gain.value = 0.05;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      sirenTimer = setInterval(() => {
        if (!sirenOsc) return;
        sirenStep = 1 - sirenStep;
        sirenOsc.frequency.value = sirenStep ? 750 : 950;
      }, 380);
    },
    stopSiren() {
      if (sirenTimer) clearInterval(sirenTimer);
      sirenTimer = null;
      if (sirenOsc) {
        try { sirenOsc.stop(); } catch { /* already stopped */ }
      }
      sirenOsc = null;
      sirenGain = null;
    },
    startMusic() {
      if (!ensure() || musicTimer) return;
      // A lazy bass loop: A minor, one note a beat, 100 bpm.
      const notes = [55, 55, 65.41, 49, 55, 55, 82.41, 73.42];
      let i = 0;
      musicTimer = setInterval(() => {
        if (muted) return;
        tone(notes[i % notes.length], 0.5, 'triangle', 0.07);
        if (i % 4 === 2) tone(notes[i % notes.length] * 2, 0.2, 'sine', 0.04);
        i += 1;
      }, 600);
    },
    stopMusic() {
      if (musicTimer) clearInterval(musicTimer);
      musicTimer = null;
    },
  };
  return api;
}
