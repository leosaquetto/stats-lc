/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const BassPulseIcon = () => {
  return (
    <div className="relative flex items-center justify-center w-6 h-6">
      {/* Núcleo do grave (O ponto central que brilha) */}
      <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] relative z-10" />

      {/* Explosão 1: Linhas explodindo rápido */}
      <div
        className="absolute inset-0 rounded-full border-2 border-dashed border-white/60 animate-ping"
        style={{ animationDuration: '1.2s' }}
      />

      {/* Explosão 2: Linhas com cor (Aura neon) com delay para dar ritmo duplo de grave */}
      <div
        className="absolute inset-[-4px] rounded-full border-[1.5px] border-dashed border-cyan-400/50 animate-ping"
        style={{ animationDuration: '1.2s', animationDelay: '300ms' }}
      />

      {/* Explosão 3: Onda de choque contínua e suave (Sólida, opacidade bem baixa) */}
      <div
        className="absolute inset-1 rounded-full bg-pink-500/20 animate-ping blur-sm"
        style={{ animationDuration: '2s', animationDelay: '600ms' }}
      />
    </div>
  );
};
