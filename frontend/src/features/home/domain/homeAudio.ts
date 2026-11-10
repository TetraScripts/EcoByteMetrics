export function createHomeAudio(createContext = () => new AudioContext()) {
  let disposed = false, lastClick = -Infinity;
  let context: AudioContext | null = null;
  const taps = new Set<AudioBufferSourceNode>();
  const stopTaps = () => { for (const tap of taps) tap.stop(); taps.clear(); };
  return {
    interact() {
      const now = performance.now();
      if (disposed || now - lastClick < 140) return;
      lastClick = now;
      // A short, quiet filtered tap has no pitch or notification-like chime.
      try {
        context ??= createContext();
        const ctx = context;
        void ctx.resume().then(() => {
          if (disposed) return;
          const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .018), ctx.sampleRate);
          const samples = buffer.getChannelData(0);
          for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * .0025));
          const source = ctx.createBufferSource(); source.buffer = buffer;
          const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 1100;
          const gain = ctx.createGain(); gain.gain.value = .22 * .035;
          source.connect(filter).connect(gain).connect(ctx.destination);
          taps.add(source);
          source.onended = () => { taps.delete(source); source.disconnect(); filter.disconnect(); gain.disconnect(); };
          source.start();
        }).catch(() => {});
      } catch { /* Interaction sounds are optional when Web Audio is unavailable. */ }
    },
    dispose() {
      disposed = true; stopTaps();
      void context?.close().catch(() => {});
    },
  };
}
