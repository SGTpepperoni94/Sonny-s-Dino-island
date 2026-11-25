import { CALM_AUDIO_URL } from '../config/assets';

const DEFAULT_MUSIC_VOLUME = 0.35;
const FADE_IN_SECONDS = 1.5;

export class AudioEngine {
  private audioEl: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private muted: boolean;
  private musicActive = false;
  private fadeElapsed = 0;
  private fadingIn = false;

  constructor(initialMuted = false) {
    this.muted = initialMuted;
  }

  private ensureMusicElement(): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!this.audioEl) {
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.loop = true;
      el.preload = 'none';
      el.volume = 0;
      el.src = CALM_AUDIO_URL;
      this.audioEl = el;
    }
    return this.audioEl;
  }

  private hasUserGesture(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } })
      .userActivation;
    return ua ? ua.hasBeenActive : true;
  }

  private ensureWebAudio(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      if (!this.hasUserGesture()) return null;
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.audioCtx = new Ctor();
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public unlock(): void {
    this.ensureWebAudio();
  }

  /**
   * Title Screen stays silent; Play starts calm.mp3 with a smooth 1.5s fade-in.
   */
  public startIslandMusic(): void {
    if (this.hasUserGesture()) {
      this.unlock();
    }
    this.musicActive = true;
    const el = this.ensureMusicElement();
    if (!el) return;
    el.muted = this.muted;
    el.volume = 0;
    this.fadeElapsed = 0;
    this.fadingIn = true;
    void el.play().catch(() => {
      // Autoplay blocked in headless/non-gesture environment; stays graceful
    });
  }

  public update(dt: number): void {
    if (!this.fadingIn || !this.audioEl) return;
    this.fadeElapsed += dt;
    const t = Math.min(1, this.fadeElapsed / FADE_IN_SECONDS);
    this.audioEl.volume = this.muted ? 0 : DEFAULT_MUSIC_VOLUME * t;
    if (t >= 1) {
      this.fadingIn = false;
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.audioEl) {
      this.audioEl.muted = muted;
      if (!muted && this.musicActive && !this.fadingIn) {
        this.audioEl.volume = DEFAULT_MUSIC_VOLUME;
      }
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  public playFootstep(inWater: boolean): void {
    if (this.muted) return;
    const ctx = this.ensureWebAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;

    if (inWater) {
      this.playNoiseBurst(ctx, now, 0.11, 900 * jitter, 0.08);
      return;
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(62, now + 0.065);
    gain.gain.setValueAtTime(0.055, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playJump(): void {
    if (this.muted) return;
    const ctx = this.ensureWebAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const jitter = 0.94 + Math.random() * 0.12;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(560 * jitter, now + 0.14);
    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playSplash(): void {
    if (this.muted) return;
    const ctx = this.ensureWebAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const jitter = 0.92 + Math.random() * 0.16;
    this.playNoiseBurst(ctx, now, 0.22, 1300 * jitter, 0.12);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520 * jitter, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.12);
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playWaveChime(): void {
    if (this.muted) return;
    const ctx = this.ensureWebAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const start = now + i * 0.065;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.09, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  }

  private playNoiseBurst(
    ctx: AudioContext,
    startTime: number,
    duration: number,
    filterFreq: number,
    volume: number,
  ): void {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterFreq, startTime);
    filter.Q.setValueAtTime(1.1, startTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startTime);
  }

  public dispose(): void {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}
