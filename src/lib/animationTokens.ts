export const animationTokens = {
  ease: {
    smooth: [0.16, 1, 0.3, 1] as const,
    standard: [0.4, 0, 0.2, 1] as const,
    softOut: [0.22, 1, 0.36, 1] as const,
  },
  durationMs: {
    number: 620,
    numberAdaptiveMin: 360,
    numberAdaptiveMax: 900,
    arenaNumber: 700,
  },
  duration: {
    fast: 0.18,
    normal: 0.32,
    swap: 0.58,
  },
};

export const easeOutQuart = (progress: number) => 1 - Math.pow(1 - progress, 4);
