/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useMotionRuntime } from '../../hooks/useMotionRuntime';
import { EnginePulse } from './CommonUI';

export const BassPulseIcon = () => {
  const motionRuntime = useMotionRuntime();
  const shouldRunAmbientMotion = motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';

  return (
    <div className="relative flex items-center justify-center w-6 h-6">
      {/* Núcleo do grave (O ponto central que brilha) */}
      <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] relative z-10" />

      {/* Explosão 1: Linhas explodindo rápido */}
      <EnginePulse
        active={shouldRunAmbientMotion}
        className="absolute inset-0 rounded-full border-2 border-dashed border-white/60 data-[active=false]:opacity-[0.45]"
        duration={1.2}
      />

      {/* Explosão 2: Linhas com cor (Aura neon) com delay para dar ritmo duplo de grave */}
      <EnginePulse
        active={shouldRunAmbientMotion}
        className="absolute inset-[-4px] rounded-full border-[1.5px] border-dashed border-cyan-400/50 data-[active=false]:opacity-[0.35]"
        delay={0.3}
        duration={1.2}
      />

      {/* Explosão 3: Onda de choque contínua e suave (Sólida, opacidade bem baixa) */}
      <EnginePulse
        active={shouldRunAmbientMotion}
        className="absolute inset-1 rounded-full bg-pink-500/20 blur-sm data-[active=false]:opacity-[0.4]"
        delay={0.6}
        duration={2}
      />
    </div>
  );
};
