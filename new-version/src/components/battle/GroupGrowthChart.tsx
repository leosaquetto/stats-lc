import React, { useMemo } from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer
} from 'recharts';
import { coreUtils } from '../../services/statsCore';

interface GroupGrowthChartProps {
  data?: any[];
}

export const GroupGrowthChart: React.FC<GroupGrowthChartProps> = ({ data: customData }) => {
  const data = useMemo(() => {
    if (customData) return customData;

    // Generate mock growth data for the last 30 days
    const days = 30;
    const result = [];
    let cumulativeStreams = 50000 + Math.random() * 20000;
    
    const now = new Date();
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      
      // Daily growth with some randomness
      const dailyIncrease = 500 + Math.random() * 1500;
      cumulativeStreams += dailyIncrease;
      
      result.push({
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        streams: Math.floor(cumulativeStreams),
        daily: Math.floor(dailyIncrease)
      });
    }
    return result;
  }, [customData]);

  return (
    <div className="w-full h-64 mt-4 glass-card p-4 border-white/5 relative overflow-hidden bg-black/20">
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-1">
         <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Tendência de Crescimento</span>
         <span className="text-[8px] text-white/30 uppercase font-bold tracking-tighter">Streams Totais do Grupo (30D)</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 40, right: 0, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorStreams" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="date" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.2)' }} 
            interval={6}
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.2)' }}
            tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#111', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: '12px',
              fontSize: '10px',
              fontFamily: 'Inter, sans-serif'
            }}
            itemStyle={{ color: '#f97316', fontWeight: 'bold' }}
            cursor={{ stroke: 'rgba(249,115,22,0.2)', strokeWidth: 2 }}
          />
          <Area 
            type="monotone" 
            dataKey="streams" 
            stroke="#f97316" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorStreams)" 
            animationDuration={2000}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
