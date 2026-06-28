class AudioManager {
  constructor() {
    this._ctx       = null;
    this._lastCannon = -1;
    this._lastHit    = -1;
  }

  _getCtx() {
    if (!this._ctx) this._ctx = new AudioContext();
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  playCannon() {
    const ctx = this._getCtx();
    const t   = ctx.currentTime;
    if (t - this._lastCannon < 0.06) return;
    this._lastCannon = t;

    // Noise burst (explosion texture)
    const bufLen = Math.floor(ctx.sampleRate * 0.28);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++)
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.07));

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    lpf.frequency.value = 400;

    const gNoise = ctx.createGain();
    gNoise.gain.setValueAtTime(0.4, t);
    gNoise.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    noise.connect(lpf); lpf.connect(gNoise); gNoise.connect(ctx.destination);
    noise.start(t);

    // Low-frequency thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.18);

    const gOsc = ctx.createGain();
    gOsc.gain.setValueAtTime(0.55, t);
    gOsc.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gOsc); gOsc.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.22);
  }

  playHit() {
    const ctx = this._getCtx();
    const t   = ctx.currentTime;
    if (t - this._lastHit < 0.07) return;
    this._lastHit = t;

    const bufLen = Math.floor(ctx.sampleRate * 0.12);
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++)
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.025));

    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass';
    bpf.frequency.value = 900;
    bpf.Q.value = 1.8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    noise.connect(bpf); bpf.connect(g); g.connect(ctx.destination);
    noise.start(t);
  }

  playLightning() {
    const ctx = this._getCtx();
    const t   = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.08);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.12);
  }
}

export const Audio = new AudioManager();
