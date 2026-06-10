/**
 * Constantes e variantes de animação para a seção "Seus Destaques"
 */

import type { Transition, Variants } from 'motion/react';

// Easing curves personalizados
export const EASING = {
  bounce: [0.68, -0.55, 0.265, 1.55] as const,
  smooth: [0.16, 1, 0.3, 1] as const,
  springy: [0.25, 0.46, 0.45, 0.94] as const,
  sharp: [0.4, 0, 0.2, 1] as const,
  elastic: [0.68, -0.6, 0.32, 1.6] as const,
};

// Durações
export const DURATION = {
  fast: 0.18,
  normal: 0.32,
  slow: 0.5,
  categorySwitch: 0.45,
  filterOpen: 0.22,
  cardEntry: 0.35,
};

// Stagger delays
export const STAGGER = {
  cards: 0.035,
  controls: 0.1,
  entry: 0.15,
  categorySwitch: 0.045,
};

// Spring configs
export const SPRING = {
  smooth: {
    type: 'spring' as const,
    stiffness: 300,
    damping: 30,
    mass: 0.8,
  },
  bouncy: {
    type: 'spring' as const,
    stiffness: 400,
    damping: 25,
    mass: 0.6,
  },
  gentle: {
    type: 'spring' as const,
    stiffness: 200,
    damping: 35,
    mass: 1,
  },
};

// Variants para transição de categoria
export const categoryTransitionVariants: Variants = {
  enter: (direction: number) => ({
    opacity: 0,
    scale: 0.92,
    x: direction > 0 ? 30 : -30,
    rotateY: direction > 0 ? 8 : -8,
  }),
  center: {
    opacity: 1,
    scale: 1,
    x: 0,
    rotateY: 0,
    transition: {
      duration: DURATION.categorySwitch,
      ease: EASING.smooth,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    scale: 0.88,
    x: direction < 0 ? 30 : -30,
    rotateY: direction < 0 ? 8 : -8,
    transition: {
      duration: DURATION.categorySwitch * 0.7,
      ease: EASING.sharp,
    },
  }),
};

// Variants para cards do carrossel
export const carouselCardVariants: Variants = {
  hidden: (index: number) => ({
    opacity: 0,
    scale: 0.7,
    y: 20,
    rotateX: 12,
  }),
  visible: (index: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    rotateX: 0,
    transition: {
      ...SPRING.smooth,
      delay: index * STAGGER.cards,
    },
  }),
  exit: (index: number) => ({
    opacity: 0,
    scale: 0.85,
    y: -10,
    transition: {
      duration: DURATION.fast,
      ease: EASING.sharp,
      delay: index * (STAGGER.cards * 0.5),
    },
  }),
};

// Variants para controles de filtro
export const filterControlVariants: Variants = {
  closed: {
    opacity: 0,
    scale: 0.95,
    y: -8,
  },
  open: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      ...SPRING.bouncy,
      duration: DURATION.filterOpen,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    y: -6,
    transition: {
      duration: DURATION.fast,
      ease: EASING.sharp,
    },
  },
};

// Variants para opções do menu
export const menuOptionVariants: Variants = {
  closed: {
    opacity: 0,
    x: -10,
  },
  open: (index: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: DURATION.fast,
      ease: EASING.smooth,
      delay: index * 0.03,
    },
  }),
};

// Variants para badge de período
export const periodBadgeVariants: Variants = {
  initial: {
    scale: 1,
  },
  pulse: {
    scale: [1, 1.08, 1],
    transition: {
      duration: 0.4,
      ease: EASING.bounce,
    },
  },
};

// Variants para header da seção
export const headerVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -15,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: DURATION.slow,
      ease: EASING.smooth,
    },
  },
};

// Variants para anéis orbitais
export const orbitalRingVariants: Variants = {
  hidden: (index: number) => ({
    opacity: 0,
    scale: 0.8,
  }),
  visible: (index: number) => ({
    opacity: [0, 0.5, 0.3, 0.5],
    scale: 1,
    transition: {
      opacity: {
        duration: 1.2,
        ease: 'easeInOut',
        delay: index * 0.15,
      },
      scale: {
        duration: 0.8,
        ease: EASING.smooth,
        delay: index * 0.15,
      },
    },
  }),
};

// Variants para indicadores de navegação (dots)
export const navDotVariants: Variants = {
  inactive: {
    scale: 1,
    opacity: 0.3,
  },
  active: {
    scale: 1,
    opacity: 1,
  },
  hover: {
    scale: 1.2,
    opacity: 0.6,
  },
};

// Transition para card hover
export const cardHoverTransition: Transition = {
  ...SPRING.smooth,
  duration: DURATION.normal,
};

// Transition para card tap
export const cardTapTransition: Transition = {
  duration: DURATION.fast,
  ease: EASING.sharp,
};

// Configuração para scroll momentum (usado no useEffect)
export const SCROLL_CONFIG = {
  snapThreshold: 0.3,
  momentumMultiplier: 0.95,
  snapDuration: 300,
  rafThrottle: 16, // ~60fps
};

// Configuração de blur progressivo
export const BLUR_CONFIG = {
  maxBlur: 4,
  blurStart: 2, // slot position onde começa
  blurEnd: 4, // slot position onde atinge máximo
};

// Configuração de parallax
export const PARALLAX_CONFIG = {
  ringMultiplier: 0.03, // anéis se movem 3% da velocidade do scroll
  dashMultiplier: 0.05, // anel tracejado se move 5%
  glowMultiplier: 0.02, // glow se move 2%
};

// Helper: gera um easing customizado baseado em tipo
export const getEasing = (type: keyof typeof EASING) => EASING[type];

// Helper: gera uma transição customizada
export const createTransition = (
  duration: number,
  easing: keyof typeof EASING,
  delay = 0
): Transition => ({
  duration,
  ease: EASING[easing],
  delay,
});

// Helper: gera stagger para lista de items
export const createStagger = (
  itemCount: number,
  baseDelay: number,
  delayIncrement: number
) => {
  return Array.from({ length: itemCount }, (_, i) => baseDelay + i * delayIncrement);
};

// Configuração para respects reduced motion
export const getReducedMotionConfig = (shouldReduce: boolean) => {
  if (shouldReduce) {
    return {
      duration: 0.01,
      ease: 'linear' as const,
      delay: 0,
    };
  }
  return null;
};
