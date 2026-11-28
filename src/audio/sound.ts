/**
 * 音效与背景音乐：全部用 Web Audio 实时合成，不加载任何音频文件，
 * 所以单文件离线包也能出声，包体积不受影响。
 *
 * 浏览器要求首次发声必须在用户手势之后，调用方在点击「开始实验」时
 * 调一次 unlock() 即可。
 */

export type SfxName =
  | 'tap'
  | 'deal'
  | 'cast'
  | 'hit'
  | 'crit'
  | 'miss'
  | 'tick'
  | 'perfect'
  | 'win'
  | 'lose'
  | 'right'
  | 'wrong'
  | 'phase';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = false;
let bgmRunning = false;
let bgmTimer: number | null = null;
let bgmStep = 0;
let nextNoteTime = 0;

const MASTER_VOLUME = 0.9;
const MUSIC_VOLUME = 0.2;

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(ctx.destination);
    musicBus = ctx.createGain();
    musicBus.gain.value = MUSIC_VOLUME;
    musicBus.connect(master);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 首次用户手势时调用，解锁音频 */
export function unlock(): void {
  ensureContext();
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(next: boolean): void {
  muted = next;
  if (master && ctx) {
    master.gain.setTargetAtTime(next ? 0 : MASTER_VOLUME, ctx.currentTime, 0.05);
  }
}

function noise(): AudioBuffer | null {
  const c = ensureContext();
  if (!c) return null;
  if (!noiseBuffer) {
    const length = Math.floor(c.sampleRate * 0.6);
    noiseBuffer = c.createBuffer(1, length, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

interface ToneOptions {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  attack?: number;
}

function tone({ freq, to, dur, type = 'sine', gain = 0.2, delay = 0, attack = 0.005 }: ToneOptions): void {
  const c = ensureContext();
  if (!c || !master) return;
  const start = c.currentTime + delay;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + dur);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(gain, start + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env);
  env.connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function hiss(opts: {
  dur: number;
  gain?: number;
  delay?: number;
  type?: BiquadFilterType;
  freq?: number;
  q?: number;
}): void {
  const c = ensureContext();
  if (!c || !master) return;
  const buf = noise();
  if (!buf) return;
  const start = c.currentTime + (opts.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filter = c.createBiquadFilter();
  filter.type = opts.type ?? 'bandpass';
  filter.frequency.value = opts.freq ?? 1200;
  filter.Q.value = opts.q ?? 1.2;
  const env = c.createGain();
  env.gain.setValueAtTime(opts.gain ?? 0.18, start);
  env.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
  src.connect(filter);
  filter.connect(env);
  env.connect(master);
  src.start(start);
  src.stop(start + opts.dur + 0.02);
}

/** 播放一个音效 */
export function sfx(name: SfxName): void {
  if (muted) return;
  switch (name) {
    case 'tap':
      tone({ freq: 880, to: 1180, dur: 0.06, type: 'triangle', gain: 0.14 });
      break;
    case 'deal':
      hiss({ dur: 0.09, gain: 0.11, freq: 2600, q: 1.6 });
      break;
    case 'cast':
      tone({ freq: 220, to: 760, dur: 0.22, type: 'sawtooth', gain: 0.12 });
      tone({ freq: 330, to: 1100, dur: 0.2, type: 'triangle', gain: 0.08, delay: 0.02 });
      break;
    case 'hit':
      tone({ freq: 160, to: 60, dur: 0.28, type: 'sine', gain: 0.32 });
      hiss({ dur: 0.18, gain: 0.19, freq: 900, q: 0.9 });
      break;
    case 'crit':
      tone({ freq: 180, to: 55, dur: 0.36, type: 'sine', gain: 0.4 });
      tone({ freq: 920, to: 1320, dur: 0.16, type: 'square', gain: 0.09, delay: 0.02 });
      hiss({ dur: 0.26, gain: 0.24, freq: 1400, q: 0.8 });
      break;
    case 'miss':
      tone({ freq: 180, to: 90, dur: 0.3, type: 'sawtooth', gain: 0.14 });
      break;
    case 'tick':
      tone({ freq: 1500, dur: 0.035, type: 'square', gain: 0.07 });
      break;
    case 'perfect':
      tone({ freq: 784, dur: 0.12, type: 'triangle', gain: 0.17 });
      tone({ freq: 1046, dur: 0.18, type: 'triangle', gain: 0.17, delay: 0.09 });
      tone({ freq: 1568, dur: 0.24, type: 'triangle', gain: 0.14, delay: 0.18 });
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) =>
        tone({ freq: f, dur: 0.3, type: 'triangle', gain: 0.18, delay: i * 0.11 }),
      );
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) =>
        tone({ freq: f, dur: 0.4, type: 'sine', gain: 0.18, delay: i * 0.13 }),
      );
      break;
    case 'right':
      tone({ freq: 880, dur: 0.1, type: 'triangle', gain: 0.16 });
      tone({ freq: 1320, dur: 0.16, type: 'triangle', gain: 0.14, delay: 0.08 });
      break;
    case 'wrong':
      tone({ freq: 220, to: 160, dur: 0.26, type: 'sawtooth', gain: 0.14 });
      break;
    case 'phase':
      tone({ freq: 110, to: 55, dur: 0.7, type: 'sine', gain: 0.28 });
      tone({ freq: 440, to: 880, dur: 0.5, type: 'triangle', gain: 0.1 });
      break;
    default:
      break;
  }
}

/* ---------------- 背景音乐 ---------------- */

/** 每 8 步换一次和弦：Am - F - C - G，低沉、不抢戏 */
const CHORDS: { root: number; tones: number[] }[] = [
  { root: 110.0, tones: [0, 3, 7] },
  { root: 87.31, tones: [0, 4, 7] },
  { root: 130.81, tones: [0, 4, 7] },
  { root: 98.0, tones: [0, 4, 7] },
];

const STEP_SECONDS = 60 / 82 / 4; // 82 BPM，十六分音符

function scheduleStep(step: number, when: number): void {
  const c = ctx;
  if (!c || !musicBus) return;
  const bar = Math.floor(step / 8) % CHORDS.length;
  const chord = CHORDS[bar];
  const inBar = step % 8;

  // 低音：每小节第一拍
  if (inBar === 0) {
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = chord.root;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.4, when + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);
    osc.connect(env);
    env.connect(musicBus);
    osc.start(when);
    osc.stop(when + 1.7);
  }

  // 琶音：每两步一个音
  if (inBar % 2 === 0) {
    const idx = (inBar / 2) % chord.tones.length;
    const freq = chord.root * 2 * Math.pow(2, chord.tones[idx] / 12);
    const osc = c.createOscillator();
    const env = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, when);
    env.gain.exponentialRampToValueAtTime(0.24, when + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, when + 0.5);
    osc.connect(env);
    env.connect(musicBus);
    osc.start(when);
    osc.stop(when + 0.55);
  }
}

function scheduler(): void {
  const c = ctx;
  if (!c) return;
  while (nextNoteTime < c.currentTime + 0.3) {
    scheduleStep(bgmStep, nextNoteTime);
    bgmStep += 1;
    nextNoteTime += STEP_SECONDS;
  }
}

export function startBgm(): void {
  const c = ensureContext();
  if (!c || bgmRunning) return;
  bgmRunning = true;
  bgmStep = 0;
  nextNoteTime = c.currentTime + 0.1;
  bgmTimer = window.setInterval(scheduler, 90);
}

export function stopBgm(): void {
  bgmRunning = false;
  if (bgmTimer !== null) {
    window.clearInterval(bgmTimer);
    bgmTimer = null;
  }
}
