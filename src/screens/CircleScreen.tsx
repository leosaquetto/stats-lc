/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion } from 'motion/react';
import { HeartHandshake, Swords, Trophy } from 'lucide-react';
import { clsx } from 'clsx';
import RankingScreen from './RankingScreen';
import AlikeScreen from './AlikeScreen';

type CircleTab = 'ranking' | 'duels' | 'affinity';

interface CircleScreenProps {
  initialTab?: CircleTab;
}

const tabs: Array<{ id: CircleTab; label: string; icon: typeof Trophy }> = [
  { id: 'ranking', label: 'Ranking', icon: Trophy },
  { id: 'duels', label: 'Duelos', icon: Swords },
  { id: 'affinity', label: 'Afinidade', icon: HeartHandshake },
];

export default function CircleScreen({ initialTab = 'ranking' }: CircleScreenProps) {
  const [activeTab, setActiveTab] = useState<CircleTab>(initialTab);

  return (
    <div className="flex flex-col gap-5">
      <div className="px-4">
        <div className="flex gap-2 rounded-3xl bg-white/[0.03] p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "relative flex flex-1 items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.14em] transition-all",
                  isActive ? "text-orange-400" : "text-white/35 hover:text-white/60"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="circle-active-tab"
                    className="absolute inset-0 rounded-2xl border border-orange-500/20 bg-orange-500/10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.45 }}
                  />
                )}
                <Icon className="relative h-3.5 w-3.5" />
                <span className="relative">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'ranking' && <RankingScreen />}
      {activeTab === 'affinity' && <AlikeScreen />}
      {activeTab === 'duels' && (
        <div className="mx-4 flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-[32px] border border-white/5 bg-white/[0.02] px-6 text-center">
          <Swords className="h-7 w-7 text-orange-400/70" />
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-black uppercase tracking-[0.18em] text-white/80">Duelos</h2>
            <p className="max-w-xs text-xs font-medium leading-relaxed text-white/45">
              Em breve, batalhas rápidas do círculo por período.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
