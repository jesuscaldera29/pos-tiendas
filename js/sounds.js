// ============================================
// SOUNDS.JS - Audio feedback
// ============================================
const Sounds = {
  ctx: null,
  enabled: true,

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },

  play(type) {
    if (!this.enabled || !this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.connect(g);
    g.connect(this.ctx.destination);
    const t = this.ctx.currentTime;

    switch(type) {
      case 'scan':
        o.frequency.setValueAtTime(1200, t);
        o.frequency.setValueAtTime(1600, t + 0.05);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.12);
        o.start(t); o.stop(t + 0.12);
        break;
      case 'sale':
        o.frequency.setValueAtTime(523, t);
        o.frequency.setValueAtTime(659, t + 0.1);
        o.frequency.setValueAtTime(784, t + 0.2);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
        o.start(t); o.stop(t + 0.35);
        break;
      case 'error':
        o.frequency.setValueAtTime(200, t);
        g.gain.setValueAtTime(0.2, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
        o.start(t); o.stop(t + 0.3);
        break;
      case 'click':
        o.frequency.setValueAtTime(800, t);
        g.gain.setValueAtTime(0.08, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        o.start(t); o.stop(t + 0.05);
        break;
      case 'cash':
        o.type = 'triangle';
        o.frequency.setValueAtTime(800, t);
        o.frequency.setValueAtTime(1000, t + 0.05);
        o.frequency.setValueAtTime(1200, t + 0.1);
        g.gain.setValueAtTime(0.12, t);
        g.gain.exponentialRampToValueAtTime(0.01, t + 0.25);
        o.start(t); o.stop(t + 0.25);
        break;
    }
  }
};
