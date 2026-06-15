
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { motion, animate } from 'motion/react';
import { Hash, Calendar, PieChart } from 'lucide-react';
import { UserStats } from '../../types/stats';
import { coreUtils } from '../../services/statsCore';
import { clsx } from 'clsx';

interface UserQuickStatsProps {
  user: UserStats;
  accentColor?: string;
}

const CountUpText: React.FC<{ value: number; formatter: (val: number) => string }> = ({ value, formatter }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const controls = animate(0, value, {
      duration: 1.2,
      ease: [0.16, 1, 0.3, 1], // easeOutExpo
      onUpdate(val) {
        node.textContent = formatter(Math.round(val));
      }
    });

    return () => controls.stop();
  }, [value, formatter]);

  return <span ref={ref}>{formatter(0)}</span>;
};

export const UserQuickStats: React.FC<UserQuickStatsProps> = ({ user, accentColor = "#FF9F0A" }) => {
  const stats = [
    {
      label: 'Hoje',
      value: user.streamsToday || 0,
      icon: Hash,
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
      description: 'Acumulado Diário'
    },
    {
      label: 'Semanal',
      value: user.streamsWeek || 0,
      icon: PieChart,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      description: 'Últimos 7 dias'
    },
    {
      label: 'Mensal',
      value: user.streamsMonth || 0,
      icon: Calendar,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      description: 'Últimos 30 dias'
    }
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="glass-card p-4 flex flex-col gap-4 border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-[background-color,border-color,box-shadow,opacity,transform] duration-200 relative overflow-hidden group"
        >
          <div className="absolute -right-4 -top-4 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
            <stat.icon className="h-16 w-16" />
          </div>
          
          <div className={clsx(
            "h-9 w-9 rounded-xl flex items-center justify-center border",
            stat.bgColor,
            stat.color,
            "border-white/5"
          )}>
            <stat.icon className="h-4.5 w-4.5" />
          </div>

          <div className="flex flex-col relative z-20">
            <span className="text-[17px] font-display font-black text-white leading-none tracking-tight">
              <CountUpText value={stat.value} formatter={coreUtils.formatNumber} />
            </span>
            <div className="flex flex-col mt-2">
              <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.15em]">
                {stat.label}
              </span>
              <span className="text-[6px] font-bold text-white/10 uppercase tracking-widest mt-0.5">
                {stat.description}
              </span>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
