import React, { useState } from 'react';
import { Sparkles, Loader2, Share2 } from 'lucide-react';
import { snapshotService } from '../../services/snapshotService';
import { statsService } from '../../services/statsService';
import { useStatsStore } from '../../store/useStatsStore';
import { WeeklyReportTemplate } from '../shared/WeeklyReportTemplate';
import { EngineSpinner } from '../shared/CommonUI';
import { createPortal } from 'react-dom';

interface WeeklyReportGeneratorProps {
  userId: string;
  userName: string;
  userAvatar?: string;
}

export const WeeklyReportGenerator: React.FC<WeeklyReportGeneratorProps> = ({ userId, userName, userAvatar }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const arenaName = useStatsStore((s) => s.arenaName);

  const generateReport = async () => {
    if (isGenerating) return;
    
    setIsGenerating(true);
    try {
      // Fetch top items for the week
      const [artists, tracks, albums] = await Promise.all([
        statsService.getTopItems(userId, 'artists', 'week'),
        statsService.getTopItems(userId, 'tracks', 'week'),
        statsService.getTopItems(userId, 'albums', 'week')
      ]);

      setReportData({ artists, tracks, albums });

      // Wait for re-render in portal
      setTimeout(async () => {
        const element = document.getElementById('weekly-report-capture');
        if (element) {
          try {
            const result = await snapshotService.captureElement(
              element, 
              'none',
              `Relatório Semanal - ${userName}`
            );
            
            if (result && navigator.share) {
                 const blob = await (await fetch(result)).blob();
                 const file = new File([blob], `Relatorio-Semanal-${userName}.png`, { type: 'image/png' });
                 
                 // Small delay to ensure browser acknowledges the file
                 await new Promise(r => setTimeout(r, 100));
                 
                 if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: 'Meu Relatório Semanal no Stats.lc',
                        text: `Confira meu top 3 da semana no Stats.lc! 🚀`
                    });
                 }
            }
          } catch (captureError) {
            console.error("Capture failed", captureError);
          }
        }
        setReportData(null); // Clear after capture
        setIsGenerating(false);
      }, 800); // Give it enough time for images to potentially load in the hidden div

    } catch (error) {
      console.error("Failed to generate weekly report", error);
      setIsGenerating(false);
      setReportData(null);
    }
  };

  return (
    <>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          generateReport();
        }}
        disabled={isGenerating}
        className="glass-card flex items-center justify-between p-5 w-full group hover:bg-white/[0.04] active:scale-[0.98] transition-[background-color,border-color,box-shadow,opacity,transform] duration-200 border-orange-500/20 shadow-xl relative overflow-hidden"
      >
        {/* Animated background hint */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-orange-500/20 transition-[background-color,opacity,transform] duration-200" />
        
        <div className="flex items-center gap-4 relative z-10">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                {isGenerating ? (
                  <EngineSpinner className="h-6 w-6 text-black">
                    <Loader2 className="h-full w-full" />
                  </EngineSpinner>
                ) : (
                  <Sparkles className="h-6 w-6 text-black" />
                )}
            </div>
            <div className="flex flex-col items-start gap-1">
                <span className="text-[13px] font-black text-white uppercase tracking-tight group-hover:text-orange-500 transition-colors">Gerar Relatório Semanal</span>
                <span className="text-[9px] text-white/30 font-black uppercase tracking-widest leading-none">Snap do seu Top 3 da semana</span>
            </div>
        </div>
        <div className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:bg-orange-500 group-hover:border-orange-500 transition-[background-color,border-color,transform] duration-200 relative z-10">
            <Share2 className="h-4 w-4 text-white group-hover:text-black transition-colors" />
        </div>
      </button>

      {/* Off-screen rendering for capture using createPortal */}
      {reportData && createPortal(
        <div style={{ position: 'fixed', left: '-5000px', top: '0', zIndex: -100, visibility: 'hidden' }}>
           <WeeklyReportTemplate 
             userName={userName} 
             userAvatar={userAvatar}
             topArtists={reportData.artists}
             topTracks={reportData.tracks}
             topAlbums={reportData.albums}
             arenaName={arenaName}
           />
        </div>,
        document.body
      )}
    </>
  );
};
