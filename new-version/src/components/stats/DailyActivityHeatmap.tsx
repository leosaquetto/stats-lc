import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock } from 'lucide-react';
import { clsx } from 'clsx';

interface HourlyData {
  hour: number;
  streams: number;
  duration: number;
}

interface DailyActivityHeatmapProps {
  data: HourlyData[];
  accentColor?: string;
}

export const DailyActivityHeatmap: React.FC<DailyActivityHeatmapProps> = ({ 
  data, 
  accentColor = "#FF9F0A" 
}) => {
  const maxStreams = useMemo(() => {
    return Math.max(...data.map(d => d.streams), 1);
  }, [data]);

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => a.hour - b.hour);
  }, [data]);

  // Group hours for better layout (e.g., 4 groups of 6 hours)
  const timeRanges = [
    { label: 'Madrugada', description: '00h - 05h', range: [0, 5] },
    { label: 'Manhã', description: '06h - 11h', range: [6, 11] },
    { label: 'Tarde', description: '12h - 17h', range: [12, 17] },
    { label: 'Noite', description: '18h - 23h', range: [18, 23] }
  ];

  return (
    <div className="glass-card p-6 border-white/5 flex flex-col gap-5 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-orange-500" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Distribuição Horária</span>
        </div>
        <div className="flex items-center gap-1">
           <div className="h-2 w-2 rounded-full border border-white/10" />
           <span className="text-[8px] font-black uppercase tracking-widest text-white/20">Frequência</span>
           <div className="h-2 w-2 rounded-full ml-1" style={{ backgroundColor: accentColor }} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* The Heatmap Grid */}
        <div className="grid grid-cols-12 gap-1.5 sm:gap-2">
          {sortedData.map((item) => {
            const intensity = item.streams / maxStreams;
            const opacity = 0.05 + (intensity * 0.95);
            
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
              >
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-1">
                  <span className="text-[8px] font-bold text-white">{item.streams}</span>
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
          {timeRanges.map((range) => {
            const rangeData = sortedData.filter(d => d.hour >= range.range[0] && d.hour <= range.range[1]);
            const totalStreams = rangeData.reduce((acc, curr) => acc + curr.streams, 0);
            const isPeak = totalStreams > 0 && totalStreams === Math.max(...timeRanges.map(r => 
              sortedData.filter(d => d.hour >= r.range[0] && d.hour <= r.range[1]).reduce((acc, curr) => acc + curr.streams, 0)
            ));

            return (
              <div 
                key={range.label} 
                className={clsx(
                  "p-3 rounded-2xl border transition-all",
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
                  <span className="text-[12px] font-black text-white">{totalStreams} <span className="text-[8px] text-white/40">PLAYS</span></span>
                  <span className="text-[7px] font-medium text-white/20 uppercase mt-0.5 tracking-tight">{range.description}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
