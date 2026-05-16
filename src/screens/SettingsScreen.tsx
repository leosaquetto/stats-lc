import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Settings, Users, EyeOff, MinusCircle } from 'lucide-react';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { clsx } from 'clsx';
import { SectionHeader, SmartImage } from '../components/MusicUI';

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
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white/95">Ajustes</h1>
          <p className="text-white/60 text-sm">Personalize sua experiência</p>
        </div>
        <div className="h-10 w-10 glass rounded-2xl flex items-center justify-center">
          <Settings className="h-5 w-5 text-white/40" />
        </div>
      </header>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Usuário Principal" />
        <div className="glass-card flex flex-col gap-2 p-4">
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2 px-2">Quem é você?</p>
          {members.map(user => (
            <button
              key={user.id}
              onClick={() => setFeaturedUserId(user.id)}
              className={clsx(
                "flex items-center gap-3 p-3 rounded-2xl transition-all",
                featuredUserId === user.id ? "bg-orange-500/10 border border-orange-500/20" : "hover:bg-white/5 border border-transparent"
              )}
            >
              <SmartImage src={coreUtils.getUserAvatar(user.id, user.avatar)} rounded="full" className={clsx("h-10 w-10 border", featuredUserId === user.id ? "border-orange-500" : "border-white/10 grayscale opacity-60")} />
              <span className={clsx("text-sm font-bold", featuredUserId === user.id ? "text-white" : "text-white/60")}>{user.name}</span>
              {featuredUserId === user.id && <div className="ml-auto w-2 h-2 rounded-full bg-orange-500" />}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Visibilidade de Amigos" />
        <div className="glass-card flex flex-col gap-2 p-4">
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-2 px-2">Ocultar dos Rankings</p>
          {members.filter(m => m.id !== featuredUserId).map(user => {
            const isHidden = hiddenUsers.includes(user.id);
            return (
              <button
                key={user.id}
                onClick={() => toggleHideUser(user.id)}
                className={clsx(
                  "flex items-center gap-3 p-3 rounded-2xl transition-all",
                  isHidden ? "bg-red-500/10 border border-red-500/20" : "hover:bg-white/5 border border-transparent"
                )}
              >
                <div className="relative h-10 w-10">
                  <SmartImage src={coreUtils.getUserAvatar(user.id, user.avatar)} rounded="full" className={clsx("h-full w-full border border-white/10", isHidden && "grayscale opacity-40")} />
                  {isHidden && <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full"><EyeOff className="h-4 w-4 text-red-500" /></div>}
                </div>
                <div className="flex flex-col items-start">
                   <span className={clsx("text-sm font-bold", isHidden ? "text-red-400" : "text-white/90")}>{user.name}</span>
                   <span className="text-[9px] font-black uppercase text-white/30">{isHidden ? "Oculto" : "Visível"}</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader title="Interface" />
        <div className="glass-card flex flex-col gap-4 p-4">
          <button
            onClick={() => setHideRankingBadge(!hideRankingBadge)}
            className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/5 transition-all w-full text-left border border-transparent"
          >
             <div className="flex items-center gap-3">
               <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center">
                 <MinusCircle className="h-4 w-4 text-white/40" />
               </div>
               <div className="flex flex-col">
                 <span className="text-sm font-bold text-white/90">Layout Limpo (LeoHeader)</span>
                 <span className="text-[9px] font-black uppercase text-white/40 tracking-widest mt-0.5">Ocultar Badge de Ranking</span>
               </div>
             </div>
             <div className={clsx("w-10 h-6 rounded-full flex items-center px-1 transition-all", hideRankingBadge ? "bg-orange-500" : "bg-white/10")}>
                <div className={clsx("w-4 h-4 rounded-full bg-white transition-all", hideRankingBadge ? "translate-x-4" : "translate-x-0 opacity-40")} />
             </div>
          </button>
        </div>
      </section>
    </div>
  );
}
