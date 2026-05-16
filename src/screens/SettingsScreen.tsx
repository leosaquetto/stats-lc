import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Users, EyeOff, MinusCircle } from 'lucide-react';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { clsx } from 'clsx';
import { SectionHeader, SmartImage } from '../components/shared/CommonUI';

export default function SettingsScreen() {
  const { groupStats, featuredUserId, setFeaturedUserId, hiddenUsers, setHiddenUsers, hideRankingBadge, setHideRankingBadge } = useStatsStore();
  const members = groupStats?.members || Object.values(groupStats?.users || {});

  const toggleHideUser = (id: string) => {
    if (hiddenUsers.includes(id)) {
      setHiddenUsers(hiddenUsers.filter(u => u !== id));
    } else {
      setHiddenUsers([...hiddenUsers, id]);
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32">
      <header className="px-1 flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Privacidade & Grid</span>
          </div>
          <h1 className="text-4xl font-display font-black text-white tracking-tighter">Ajustes</h1>
        </div>
        <div className="h-12 w-12 glass rounded-2xl flex items-center justify-center text-white/40">
           <Settings className="h-5 w-5" />
        </div>
      </header>

      <div className="flex flex-col gap-10 mt-4">
        {/* User Selection */}
        <div className="flex flex-col gap-4">
           <SectionHeader title="Usuário em Destaque" action={<Users className="h-4 w-4 text-white/20" />} />
           <p className="text-[11px] text-white/40 font-medium px-1">Selecione quem aparecerá no topo da sua Arena pessoal.</p>
           
           <div className="grid grid-cols-1 gap-2">
             {members.map((user: any) => (
               <button
                 key={user.id}
                 onClick={() => setFeaturedUserId(user.id)}
                 className={clsx(
                   "flex items-center justify-between p-4 rounded-3xl border transition-all active:scale-[0.98]",
                   featuredUserId === user.id 
                    ? "bg-orange-500/10 border-orange-500/40 shadow-[0_10px_30px_rgba(255,159,10,0.1)]" 
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04]"
                 )}
               >
                 <div className="flex items-center gap-4">
                   <div className={clsx(
                     "h-12 w-12 rounded-full p-1",
                     featuredUserId === user.id ? "bg-orange-500" : "bg-white/10"
                   )}>
                      <SmartImage 
                        src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                        className="h-full w-full rounded-full" 
                        fallback=""
                        rounded="full"
                      />
                   </div>
                   <div className="flex flex-col items-start">
                      <span className={clsx("text-sm font-bold", featuredUserId === user.id ? "text-orange-400" : "text-white/80")}>
                        {user.name}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Membro da Arena</span>
                   </div>
                 </div>
                 {featuredUserId === user.id && (
                   <div className="h-6 w-6 rounded-full bg-orange-500 flex items-center justify-center shadow-lg">
                      <div className="h-2 w-2 rounded-full bg-white" />
                   </div>
                 )}
               </button>
             ))}
           </div>
        </div>

        {/* Visibility */}
        <div className="flex flex-col gap-4">
           <SectionHeader title="Visibilidade" action={<EyeOff className="h-4 w-4 text-white/20" />} />
           <div className="glass-card p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                   <span className="text-[13px] font-bold text-white/90">Distintivo de Ranking</span>
                   <span className="text-[10px] text-white/30">Ocultar a medalha de 1º, 2º e 3º na Arena.</span>
                </div>
                <button 
                  onClick={() => setHideRankingBadge(!hideRankingBadge)}
                  className={clsx(
                    "w-12 h-6 rounded-full relative transition-all duration-300",
                    hideRankingBadge ? "bg-orange-500" : "bg-white/10"
                  )}
                >
                  <motion.div 
                    animate={{ x: hideRankingBadge ? 24 : 4 }}
                    className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-xl"
                  />
                </button>
              </div>

              <div className="h-px w-full bg-white/5" />

              <div className="flex flex-col gap-4">
                 <span className="text-[11px] font-black uppercase tracking-widest text-white/20">Ocultar Membros</span>
                 <div className="flex flex-wrap gap-2">
                    {members.map((user: any) => (
                      <button
                        key={user.id}
                        onClick={() => toggleHideUser(user.id)}
                        className={clsx(
                          "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-[11px] font-bold",
                          hiddenUsers.includes(user.id)
                            ? "bg-red-500/10 border-red-500/20 text-red-400"
                            : "bg-white/5 border-white/5 text-white/40"
                        )}
                      >
                         <SmartImage 
                           src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                           className="h-4 w-4 rounded-full opacity-60" 
                           fallback="" 
                         />
                         {user.name}
                         {hiddenUsers.includes(user.id) && <MinusCircle className="h-3 w-3" />}
                      </button>
                    ))}
                 </div>
              </div>
           </div>
        </div>

        {/* Info */}
        <div className="mt-10 mb-20 flex flex-col items-center gap-4 py-8 opacity-20">
           <div className="h-8 w-8 bg-white/10 rounded-xl" />
           <div className="flex flex-col items-center gap-1">
              <span className="text-[9px] font-black uppercase tracking-[0.4em]">Arena Stats OS</span>
              <span className="text-[8px] font-bold">V 2.5.0 STABLE</span>
           </div>
        </div>
      </div>
    </div>
  );
}
