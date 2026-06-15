import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock } from 'lucide-react';
import { clsx } from 'clsx';
import { coreUtils } from '../../services/statsCore';

interface HourlyData {
  hour: number;
  streams: number;
  duration: number;
}

interface DailyActivityHeatmapProps {
  data: HourlyData[];
  accentColor?: string;
  periodLabel?: string;
}

export const DailyActivityHeatmap: React.FC<DailyActivityHeatmapProps> = ({ 
  data, 
  accentColor = "#FF9F0A",
  periodLabel = 'Período',
}) => {
  const maxStreams = useMemo(() => {
    return Math.max(...data.map(d => d.streams), 1);
  }, [data]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.hour - b.hour);
  }, [data]);
  const totalStreams = useMemo(() => sortedData.reduce((sum, item) => sum + item.streams, 0), [sortedData]);

  // Group hours for better layout (e.g., 4 groups of 6 hours)
  const timeRanges = [
    { label: 'Madrugada', description: '00h - 05h', range: [0, 5] },
    { label: 'Manhã', description: '06h - 11h', range: [6, 11] },
    { label: 'Tarde', description: '12h - 17h', range: [12, 17] },
    { label: 'Noite', description: '18h - 23h', range: [18, 23] }
  ];

  return (
    <div className="glass-card mt-4 flex flex-col gap-5 border-white/5 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Distribuição Horária</span>
        </div>
        <span className="rounded-full bg-orange-500/12 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-orange-200">
          {periodLabel}
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {/* The Heatmap Grid */}
        <div className="grid grid-cols-12 gap-1.5">
          {sortedData.map((item) => {
            const intensity = item.streams / maxStreams;
            const opacity = 0.05 + (intensity * 0.95);
            const percentage = totalStreams > 0 ? (item.streams / totalStreams) * 100 : 0;
            
            return (
              <motion.div
                key={item.hour}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: item.hour * 0.015 }}
                className="relative group aspect-square flex flex-col items-center justify-center rounded-lg border border-white/5 overflow-hidden"
                style={{ 
                  backgroundColor: intensity > 0 ? accentColor : 'transparent',
                  opacity: intensity > 0 ? opacity : 0.03
                }}
                title={`${item.hour.toString().padStart(2, '0')}h: ${percentage.toFixed(1)}% (${coreUtils.formatNumber(item.streams)} plays)`}
              >
                <div className="absolute inset-0 flex items-center justify-center bg-black/44 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="text-[7px] font-black text-white">{percentage.toFixed(0)}%</span>
                </div>
                {/* Visual indicator for peak hours */}
                {intensity > 0.8 && maxStreams > 5 && (
                  <div className="absolute top-0 right-0 p-0.5">
                    <div className="h-1 w-1 rounded-full bg-white shadow-[0_0_5px_white]" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Labels for hours */}
        <div className="flex justify-between px-1">
          {[0, 4, 8, 12, 16, 20, 23].map((h) => (
            <span key={h} className="text-[9px] font-bold text-white/20 uppercase tracking-tighter">
              {h.toString().padStart(2, '0')}h
            </span>
          ))}
        </div>

        {/* Summary Insights */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {timeRanges.map((range) => {
            const rangeData = sortedData.filter(d => d.hour >= range.range[0] && d.hour <= range.range[1]);
            const rangeStreams = rangeData.reduce((acc, curr) => acc + curr.streams, 0);
            const percentage = totalStreams > 0 ? (rangeStreams / totalStreams) * 100 : 0;
            const isPeak = rangeStreams > 0 && rangeStreams === Math.max(...timeRanges.map(r =>
              sortedData.filter(d => d.hour >= r.range[0] && d.hour <= r.range[1]).reduce((acc, curr) => acc + curr.streams, 0)
            ));

            return (
              <div 
                key={range.label} 
                className={clsx(
                  "p-3 rounded-2xl border transition-[background-color,border-color,opacity,transform] duration-200",
                  isPeak ? "bg-white/[0.03] border-white/10" : "bg-transparent border-transparent"
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className={clsx(
                    "text-[8px] font-black uppercase tracking-widest leading-none",
                    isPeak ? "text-orange-500" : "text-white/30"
                  )}>
                    {range.label}
                  </span>
                  <span className="text-[15px] font-black text-white">{percentage.toFixed(0)}<span className="text-[9px] text-white/50">%</span></span>
                  <span className="mt-0.5 text-[7px] font-medium uppercase tracking-tight text-white/24">{coreUtils.formatNumber(rangeStreams)} plays · {range.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
