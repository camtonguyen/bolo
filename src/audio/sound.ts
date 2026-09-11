/**
 * Web Audio sound bed — everything generated from oscillators/noise, no
 * audio files. `primeAudio` must run from a user-gesture handler
 * (autoplay policy throws on a bare `new AudioContext()` otherwise); every
 * other export is a no-op until that has happened, so call sites never need
 * to guard on whether audio is ready.
 */

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getNoiseBuffer(context: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = context.createBuffer(1, context.sampleRate * 0.3, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Low CRT hum bed — a near-silent 60Hz tone, started once and left running; muting gates it via the master gain instead of stopping it. */
function startHum(context: AudioContext, destination: GainNode) {
  const osc = context.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = 60;
  const gain = context.createGain();
  gain.gain.value = 0.015;
  osc.connect(gain).connect(destination);
  osc.start();
}

export function primeAudio(muted: boolean): void {
  if (ctx) return;
  const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return;
  try {
    ctx = new AudioContextCtor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    startHum(ctx, master);
  } catch {
    ctx = null;
    master = null;
  }
}

export function setMuted(muted: boolean): void {
  if (!ctx || !master) return;
  master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
}

function playKeyClick(): void {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 1200;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);
  osc.connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + 0.05);
}

const SILENT_KEYS = new Set(['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab']);

/** Key click for a text input's onKeyDown -- skips modifier keys that don't produce a character. */
export function playKeyClickFor(key: string): void {
  if (SILENT_KEYS.has(key)) return;
  playKeyClick();
}

/** Descending alert tone — the operator record landing in the queue. */
export function playAlertTone(): void {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.5);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.08, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
  osc.connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + 0.6);
}

/** Dispatch radio squelch — a band-passed noise burst, as heard on verdict. */
export function playSquelch(): void {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = getNoiseBuffer(ctx);
  const bandpass = ctx.createBiquadFilter();
  bandpass.type = 'bandpass';
  bandpass.frequency.value = 1800;
  bandpass.Q.value = 0.7;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  src.connect(bandpass).connect(gain).connect(master);
  src.start(now);
  src.stop(now + 0.25);
}
