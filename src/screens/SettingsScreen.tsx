import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Users, EyeOff, MinusCircle, Bell, BellRing, Sparkles, Activity, Check, Info, AlertTriangle, X, Clock, Image as ImageIcon, ChevronRight, Swords, Loader2, Database, Disc } from 'lucide-react';
import { useStatsStore } from '../store/useStatsStore';
import { coreUtils } from '../services/statsCore';
import { notificationService } from '../services/notificationService';
import { clsx } from 'clsx';
import { SectionHeader, SmartImage } from '../components/shared/CommonUI';
import { SnapshotHistoryModal } from '../components/shared/SnapshotHistoryModal';
import { dedupeIds, getCanonicalMembers } from '../lib/memberSelectors';

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'error';
  timestamp: string;
}

export default function SettingsScreen() {
  const groupStats = useStatsStore(state => state.groupStats);
  const featuredUserId = useStatsStore(state => state.featuredUserId);
  const setFeaturedUserId = useStatsStore(state => state.setFeaturedUserId);
  const hiddenUsers = useStatsStore(state => state.hiddenUsers);
  const setHiddenUsers = useStatsStore(state => state.setHiddenUsers);
  const hideRankingBadge = useStatsStore(state => state.hideRankingBadge);
  const setHideRankingBadge = useStatsStore(state => state.setHideRankingBadge);
  const pushNotificationsEnabled = useStatsStore(state => state.pushNotificationsEnabled);
  const setPushNotificationsEnabled = useStatsStore(state => state.setPushNotificationsEnabled);
  const notifyOnNewStreams = useStatsStore(state => state.notifyOnNewStreams);
  const setNotifyOnNewStreams = useStatsStore(state => state.setNotifyOnNewStreams);
  const notifyOnGroupHighlights = useStatsStore(state => state.notifyOnGroupHighlights);
  const setNotifyOnGroupHighlights = useStatsStore(state => state.setNotifyOnGroupHighlights);
  const notifyOnArenaBattle = useStatsStore(state => state.notifyOnArenaBattle);
  const setNotifyOnArenaBattle = useStatsStore(state => state.setNotifyOnArenaBattle);
  const arenaName = useStatsStore(state => state.arenaName);
  const setArenaName = useStatsStore(state => state.setArenaName);
  const pollingFrequency = useStatsStore(state => state.pollingFrequency);
  const setPollingFrequency = useStatsStore(state => state.setPollingFrequency);
  const animationDuration = useStatsStore(state => state.animationDuration);
  const setAnimationDuration = useStatsStore(state => state.setAnimationDuration);
  const animationDelay = useStatsStore(state => state.animationDelay);
  const setAnimationDelay = useStatsStore(state => state.setAnimationDelay);
  const shimmerDuration = useStatsStore(state => state.shimmerDuration);
  const setShimmerDuration = useStatsStore(state => state.setShimmerDuration);
  const vinylTextureMode = useStatsStore(state => state.vinylTextureMode);
  const setVinylTextureMode = useStatsStore(state => state.setVinylTextureMode);
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const isRefreshing = useStatsStore(state => state.isRefreshing);
  const lastFetchTime = useStatsStore(state => state.lastFetchTime);
  const historyOrder = useStatsStore(state => state.historyOrder);
  const setHistoryOrder = useStatsStore(state => state.setHistoryOrder);
  const historyCustomOrder = useStatsStore(state => state.historyCustomOrder);
  const setHistoryCustomOrder = useStatsStore(state => state.setHistoryCustomOrder);
  
  const members = getCanonicalMembers(groupStats);

  const customSortedMembers = [...members].sort((a: any, b: any) => {
    const arr = historyCustomOrder || [];
    const indexA = arr.indexOf(a.id);
    const indexB = arr.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    notificationService.getPermissionState()
  );

  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isResettingApp, setIsResettingApp] = useState(false);
  const [arenaNameDraft, setArenaNameDraft] = useState(arenaName || '');
  const arenaNameSaveButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setArenaNameDraft(arenaName || '');
  }, [arenaName]);

  const showToast = (title: string, message: string, type: 'success' | 'info' | 'error' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setToasts(prev => [...prev, { id, title, message, type, timestamp }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500); // Slightly longer for more reading time
  };

  const toggleHideUser = (id: string, name: string) => {
    if (hiddenUsers.includes(id)) {
      setHiddenUsers(dedupeIds(hiddenUsers.filter(u => u !== id)));
      showToast(
        'Privacidade Atualizada',
        `O membro ${name} agora está visível e será contabilizado no ranking global da Arena.`,
        'success'
      );
    } else {
      // Ocultar usuário não muda featuredUserId - ele continua selecionado mas oculto das listas
      setHiddenUsers(dedupeIds([...hiddenUsers, id]));
      showToast(
        'Privacidade Atualizada',
        `O membro ${name} foi ocultado. Seus dados não aparecerão mais no ranking para você.`,
        'info'
      );
    }
  };

  const handleTogglePush = async () => {
    if (!pushNotificationsEnabled) {
      try {
        const perm = await notificationService.requestPermission();
        setPermissionState(perm);
        if (perm === 'granted') {
          setPushNotificationsEnabled(true);
          showToast(
            'Sincronização Ativada', 
            'Alertas de atividade em tempo real foram configurados com sucesso para este dispositivo.', 
            'success'
          );
          setTimeout(() => {
            notificationService.sendTestNotification();
          }, 500);
        } else {
          setPushNotificationsEnabled(false);
          showToast(
            'Permissão Negada', 
            'Não foi possível ativar as notificações pois o acesso foi bloqueado pelo sistema operacional.', 
            'error'
          );
        }
      } catch (err) {
        showToast(
          'Erro na Configuração', 
          'Ocorreu uma falha inesperada ao tentar registrar o serviço de notificações.', 
          'error'
        );
      }
    } else {
      setPushNotificationsEnabled(false);
      showToast(
        'Notificações Desativadas', 
        'Você não receberá mais alertas de atividade. As métricas continuam sendo atualizadas no fundo.', 
        'info'
      );
    }
  };

  const triggerTestNotification = () => {
    notificationService.sendTestNotification();
    showToast(
      'Sinal Enviado',
      'Um pacote de teste foi disparado para validar a integridade da comunicação push.',
      'success'
    );
  };

  const handleSaveArenaName = () => {
    const normalizedName = arenaNameDraft.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      showToast('Nome da Arena', 'Informe um nome para salvar sua Arena.', 'error');
      return;
    }

    if (normalizedName.length > 50) {
      showToast('Nome da Arena', 'Use no máximo 50 caracteres.', 'error');
      return;
    }

    setArenaName(normalizedName);
    setArenaNameDraft(normalizedName);
    showToast('Nome da Arena', 'Nome salvo para os próximos relatórios e compartilhamentos.', 'success');
  };

  const handleFeaturedUserChange = (user: any) => {
    if (!user?.id) return;
    if (user.id === featuredUserId) {
      showToast(
        'Usuário em Destaque',
        `${user.name} já está carregado como referência principal.`,
        'info'
      );
      return;
    }

    const confirmed = window.confirm(
      `Trocar usuário em destaque para ${user.name}?\n\nO app será reiniciado automaticamente na Home para carregar todos os dados desse perfil sem tela preta.`
    );
    if (!confirmed) return;

    setFeaturedUserId(user.id);
    localStorage.setItem('stats-lc-has-selected-user', '1');
    sessionStorage.removeItem('stats-lc-home-boot-ready');
    window.__STATS_LC_HOME_READY__ = false;

    window.location.hash = '#/';
    window.location.reload();
  };

  const handleResetApp = async () => {
    const confirmed = window.confirm(
      'Reiniciar app?\n\nIsso limpa o cache local deste dispositivo e recarrega o app. Seus dados do stats.fm não serão apagados.'
    );

    if (!confirmed) return;

    setIsResettingApp(true);

    try {
      // 1. Clear localStorage keys related to the app
      const keysToRemove = [
        'stats-lc-storage',
        // MockMMKV keys with 'stats-cache_' prefix
        'stats-cache_groupStats',
        'stats-cache_groupStats_timestamp',
        'stats-cache_userFullStatsCache',
        'stats-cache_userFullStatsCacheMeta',
        'stats-cache_timeRangeStatsCache',
        'stats-cache_timeRangeStatsCacheMeta',
        'stats-cache_topItemsCache',
        'stats-cache_topItemsCacheMeta',
      ];

      keysToRemove.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove localStorage key: ${key}`, e);
        }
      });

      // 2. Clear all localStorage keys that start with 'stats-cache_'
      try {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(key => {
          if (key.startsWith('stats-cache_')) {
            try {
              localStorage.removeItem(key);
            } catch (e) {
              console.warn(`Failed to remove localStorage key: ${key}`, e);
            }
          }
        });
      } catch (e) {
        console.warn('Failed to iterate localStorage keys', e);
      }

      // 3. Clear sessionStorage (temporary, safe to clear entirely)
      try {
        sessionStorage.clear();
      } catch (e) {
        console.warn('Failed to clear sessionStorage', e);
      }

      // 4. Clear CacheStorage (service worker caches)
      if ('caches' in window) {
        try {
          const cacheKeys = await caches.keys();
          await Promise.all(
            cacheKeys.map(key =>
              caches.delete(key).catch(err => {
                console.warn(`Failed to delete cache: ${key}`, err);
                return false;
              })
            )
          );
        } catch (e) {
          console.warn('Failed to clear CacheStorage', e);
        }
      }

      // 5. Show success toast
      showToast(
        'Cache Limpo',
        'Cache limpo. Reiniciando o app…',
        'success'
      );

      // 6. Wait and reload
      await new Promise(resolve => setTimeout(resolve, 300));

      // 7. Hard reload to root
      window.location.href = '/#/';
    } catch (error) {
      console.error('Failed to reset app:', error);
      setIsResettingApp(false);
      showToast(
        'Erro ao Limpar',
        'Não foi possível limpar tudo. Tente fechar e abrir o app.',
        'error'
      );
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-32 px-4">
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
           
           <div className="grid grid-cols-4 gap-2">
             {members.map((user: any) => (
               <button
                 key={user.id}
                 onClick={() => handleFeaturedUserChange(user)}
                 className={clsx(
                   "glass group relative flex min-h-[154px] flex-col justify-end overflow-hidden rounded-3xl p-2 text-center transition-all active:scale-[0.98]",
                   featuredUserId === user.id 
                    ? "ring-1 ring-orange-500/70 shadow-[0_10px_30px_rgba(255,159,10,0.1)]" 
                    : "hover:bg-white/[0.04]"
                 )}
                 style={{ border: 0 }}
               >
                 <SmartImage
                   src={coreUtils.getUserAvatar(user.id, user.avatar)}
                   className="absolute inset-0 h-full w-full scale-105 object-cover opacity-78 transition-transform duration-500 group-hover:scale-110"
                   fallback=""
                 />
                 <div className="absolute inset-0 bg-gradient-to-t from-black via-black/28 to-transparent" />
                 <div className="absolute inset-0 bg-black/10" />
                 {featuredUserId === user.id && (
                   <div className="absolute right-3 top-3 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 shadow-lg">
                      <div className="h-2 w-2 rounded-full bg-white" />
                   </div>
                 )}
                 <div className="relative z-10 flex min-h-[42px] w-full items-end justify-center px-1 pb-2">
                   <span className={clsx("w-full whitespace-normal break-words text-[10px] font-black leading-[1.12]", featuredUserId === user.id ? "text-orange-400" : "text-white/88")}>
                     {user.name}
                   </span>
                 </div>
               </button>
             ))}
           </div>
        </div>

        {/* Visibility */}
        <div className="flex flex-col gap-4">
           <SectionHeader title="Visibilidade" action={<EyeOff className="h-4 w-4 text-white/20" />} />
           <div className="glass-card p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-4">
                 <span className="text-[11px] font-black uppercase tracking-widest text-white/20">Ocultar Membros</span>
                 <div className="grid grid-cols-2 gap-2">
                    {members.map((user: any) => (
                      <button
                        key={user.id}
                        onClick={() => toggleHideUser(user.id, user.name)}
                        className={clsx(
                          "flex min-h-[46px] w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-[11px] font-bold transition-all",
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
                         <span className="min-w-0 flex-1 break-words leading-tight">{user.name}</span>
                         {hiddenUsers.includes(user.id) && <MinusCircle className="h-3 w-3" />}
                      </button>
                    ))}
                 </div>
              </div>
           </div>

           <div className="glass-card p-6 flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                 <span className="text-[13px] font-bold text-white/90">Distintivo de Ranking</span>
                 <span className="text-[10px] text-white/30">Ocultar a medalha de 1º, 2º e 3º na Arena.</span>
              </div>
              <button 
                onClick={() => {
                  const nextValue = !hideRankingBadge;
                  setHideRankingBadge(nextValue);
                  showToast(
                    'Visibilidade de Ranking',
                    nextValue 
                      ? 'As medalhas de posição (1º, 2º, 3º) foram ocultadas do layout global.' 
                      : 'As medalhas de ranking voltaram a ser exibidas para todos os membros.',
                    'info'
                  );
                }}
                className={clsx(
                  "relative h-6 w-12 shrink-0 rounded-full transition-all duration-300",
                  hideRankingBadge ? "bg-orange-500" : "bg-white/10"
                )}
              >
                <motion.div 
                  animate={{ x: hideRankingBadge ? 24 : 4 }}
                  className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-xl"
                />
              </button>
           </div>
        </div>

        {/* Ordering Preferences */}
        <div className="flex flex-col gap-4">
           <SectionHeader title="Ordem do Histórico" action={<Clock className="h-4 w-4 text-white/20" />} />
           <p className="text-[11px] text-white/40 font-medium px-1">Configure como os cards de histórico e atividade dos amigos são organizados no painel principal.</p>
           
           <div className="glass-card p-6 flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'lastPlayed', title: 'Última Reprodução', desc: 'Atividade recente' },
                  { id: 'alphabetical', title: 'Ordem Alfabética', desc: 'A - Z' },
                  { id: 'custom', title: 'Personalizada', desc: 'Arrastar membros' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setHistoryOrder(opt.id as any);
                      if (opt.id === 'custom' && (!historyCustomOrder || historyCustomOrder.length === 0)) {
                        setHistoryCustomOrder(dedupeIds(members.map((m: any) => m.id)));
                      }
                      showToast(
                        'Preferência de Ordem',
                        `Ordem do histórico de atividades alterada para: ${opt.title}.`,
                        'success'
                      );
                    }}
                    className={clsx(
                      "flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all cursor-pointer relative",
                      historyOrder === opt.id 
                        ? "bg-orange-500/10 border-orange-500/40 text-orange-400 font-extrabold shadow-[0_4px_15px_rgba(249,115,22,0.1)]" 
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.04] text-white/60 hover:text-white/80"
                    )}
                  >
                    <span className="text-xs font-bold whitespace-nowrap">{opt.title}</span>
                    <span className="text-[9px] text-white/30 font-medium mt-0.5">{opt.desc}</span>
                  </button>
                ))}
              </div>

              {/* Drag and drop section if selected */}
              {historyOrder === 'custom' && (
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Arraste para Alterar a Ordem:</span>
                  <div className="flex flex-col gap-1.5 bg-black/10 p-2 rounded-2xl border border-white/5">
                    {customSortedMembers.map((user: any, idx: number) => (
                      <div
                        key={user.id}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move';
                          (window as any)._draggedIndex = idx;
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const fromIndex = (window as any)._draggedIndex;
                          if (fromIndex === undefined || fromIndex === null || fromIndex === idx) return;
                          
                          const items = [...customSortedMembers];
                          const draggedItem = items[fromIndex];
                          items.splice(fromIndex, 1);
                          items.splice(idx, 0, draggedItem);
                          
                          setHistoryCustomOrder(dedupeIds(items.map((m: any) => m.id)));
                          (window as any)._draggedIndex = null;
                          showToast(
                            'Ordem Atualizada',
                            'Você alterou a disposição personalizada dos seus amigos.',
                            'success'
                          );
                        }}
                        className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-xl cursor-grab active:cursor-grabbing hover:bg-white/[0.06] transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-mono font-bold text-white/30 w-4">
                            {idx + 1}º
                          </span>
                          <SmartImage 
                            src={coreUtils.getUserAvatar(user.id, user.avatar)} 
                            className="h-7 w-7 rounded-full border border-white/10" 
                            fallback="" 
                            rounded="full"
                          />
                          <span className="text-xs font-bold text-white/80">
                            {user.name}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5 items-end text-white/30 pr-1 text-sm select-none">
                          ☰
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-white/40 italic leading-snug px-1">
                    * Segure e arraste as linhas da lista de amigos acima para definir a prioridade de visualização. Essa preferência reflete instantaneamente no carrossel e timeline da página inicial.
                  </p>
                </div>
              )}
           </div>
        </div>

        {/* Snap Gallery */}
        <div className="flex flex-col gap-4">
           <SectionHeader title="Snaps & Compartilhamento" action={<ImageIcon className="h-4 w-4 text-white/20" />} />
            <div className="glass-card p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                   <span className="text-[13px] font-bold text-white/90 flex items-center gap-2">
                     <Swords className="h-3.5 w-3.5 text-orange-500" />
                     Nome da Arena
                   </span>
                   <span className="text-[10px] text-white/30">O título que aparecerá nos relatórios semanais. (Ex: "Arena Stats LC")</span>
                </div>
                <input 
                  type="text" 
                  value={arenaNameDraft}
                  onChange={(e) => setArenaNameDraft(e.target.value.slice(0, 50))}
                  onBlur={(event) => {
                    if (event.relatedTarget === arenaNameSaveButtonRef.current) return;
                    if (arenaNameDraft.trim() && arenaNameDraft.trim() !== (arenaName || '').trim()) {
                      handleSaveArenaName();
                    }
                  }}
                  maxLength={50}
                  placeholder="Nome da sua Arena"
                  className="bg-black/20 border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white outline-none focus:border-orange-500/50 transition-all placeholder:text-white/20"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">
                    {arenaNameDraft.length}/50
                  </span>
                  <button
                    ref={arenaNameSaveButtonRef}
                    type="button"
                    onClick={handleSaveArenaName}
                    disabled={arenaNameDraft.trim() === (arenaName || '').trim()}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-white/60 transition-all active:scale-95 disabled:cursor-default disabled:opacity-30"
                  >
                    Salvar nome
                  </button>
                </div>
              </div>

              <div className="h-px w-full bg-white/5 my-2" />

              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                   <span className="text-[13px] font-bold text-white/90">Histórico de Visualizações</span>
                   <span className="text-[10px] text-white/30">Acesse snapshots gerados recentemente para compartilhar novamente.</span>
                </div>
                <button 
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 rounded-xl text-[11px] font-black text-white hover:bg-orange-600 transition-all active:scale-95 shadow-lg shadow-orange-500/20"
                >
                  ABRIR GALERIA
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
           </div>
        </div>

        {/* Push Notifications Configuration */}
        <div className="flex flex-col gap-4">
           <SectionHeader title="Notificações Push" action={<Bell className="h-4 w-4 text-white/20" />} />
           <div className="glass-card p-6 flex flex-col gap-6">
              
              {/* Main Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                   <div className="flex items-center gap-2">
                     <span className="text-[13px] font-bold text-white/90">Alertas de Atividade</span>
                     {permissionState === 'granted' && pushNotificationsEnabled && (
                       <span className="text-[8px] bg-green-500/10 text-green-400 border border-green-500/20 px-1.5 py-0.5 rounded-full font-black uppercase font-mono">Ativo</span>
                     )}
                     {permissionState === 'denied' && (
                       <span className="text-[8px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-black uppercase font-mono">Bloqueado</span>
                     )}
                   </div>
                   <span className="text-[10px] text-white/30">Ative para receber updates em tempo real da Arena.</span>
                </div>
                <button 
                  onClick={handleTogglePush}
                  disabled={permissionState === 'denied'}
                  className={clsx(
                    "w-12 h-6 rounded-full relative transition-all duration-300",
                    pushNotificationsEnabled && permissionState === 'granted' ? "bg-orange-500" : "bg-white/10 opacity-70",
                    permissionState === 'denied' && "cursor-not-allowed opacity-30"
                  )}
                >
                  <motion.div 
                    animate={{ x: pushNotificationsEnabled && permissionState === 'granted' ? 24 : 4 }}
                    className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-xl"
                  />
                </button>
              </div>

              {permissionState === 'denied' && (
                <div className="text-[9px] text-red-400/80 bg-red-500/5 border border-red-500/10 p-3 rounded-xl flex items-center gap-2">
                  <span>⚠️ Notificações bloqueadas pelo navegador. Por favor, libere as permissões nas configurações do seu navegador para receber alertas.</span>
                </div>
              )}

              <div className="h-px w-full bg-white/5" />

              {/* Advanced settings visible when enabled */}
              <div className={clsx(
                "flex flex-col gap-5 transition-all duration-300",
                (!pushNotificationsEnabled || permissionState !== 'granted') && "opacity-30 pointer-events-none select-none"
              )}>
                {/* Notify on New Streams */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-1.5 text-[12px] font-bold text-white/80">
                       <Activity className="h-3.5 w-3.5 text-orange-500" />
                       <span>Novos streams de amigos</span>
                     </div>
                     <span className="text-[10px] text-white/30">Notificar quando alguém na Arena der play em uma nova faixa.</span>
                  </div>
                  <button 
                    disabled={!pushNotificationsEnabled || permissionState !== 'granted'}
                    onClick={() => {
                      const val = !notifyOnNewStreams;
                      setNotifyOnNewStreams(val);
                      showToast(
                        'Preferência de Alerta',
                        val 
                          ? 'Configurado: Você será notificado sempre que um amigo iniciar uma nova reprodução.' 
                          : 'Configurado: Alertas de novos streams foram silenciados.',
                        'info'
                      );
                    }}
                    className={clsx(
                      "w-10 h-5 rounded-full relative transition-all duration-300",
                      notifyOnNewStreams ? "bg-orange-500" : "bg-white/10"
                    )}
                  >
                    <motion.div 
                      animate={{ x: notifyOnNewStreams ? 20 : 4 }}
                      className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-xl"
                    />
                  </button>
                </div>

                <div className="h-px w-full bg-white/5" />

                {/* Notify on Group Highlights */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-1.5 text-[12px] font-bold text-white/80">
                       <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                       <span>Destaques do grupo</span>
                     </div>
                     <span className="text-[10px] text-white/30">Notificar recordes, picos dramáticos ou novos marcos diários de streams.</span>
                  </div>
                  <button 
                    disabled={!pushNotificationsEnabled || permissionState !== 'granted'}
                    onClick={() => {
                      const val = !notifyOnGroupHighlights;
                      setNotifyOnGroupHighlights(val);
                      showToast(
                        'Preferência de Alerta',
                        val 
                          ? 'Configurado: Destaques, recordes e picos de atividade serão notificados.' 
                          : 'Configurado: Alertas de destaques do grupo foram silenciados.',
                        'info'
                      );
                    }}
                    className={clsx(
                      "w-10 h-5 rounded-full relative transition-all duration-300",
                      notifyOnGroupHighlights ? "bg-orange-500" : "bg-white/10"
                    )}
                  >
                    <motion.div 
                      animate={{ x: notifyOnGroupHighlights ? 20 : 4 }}
                      className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-xl"
                    />
                  </button>
                </div>

                <div className="h-px w-full bg-white/5" />

                {/* Notify on Arena Battle Overtakes */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                     <div className="flex items-center gap-1.5 text-[12px] font-bold text-white/80">
                       <Swords className="h-3.5 w-3.5 text-orange-500" />
                       <span>Arena Battle (Ultrapassagens)</span>
                     </div>
                     <span className="text-[10px] text-white/30">Notificar quando alguém ultrapassar outra pessoa no ranking diário.</span>
                  </div>
                  <button 
                    disabled={!pushNotificationsEnabled || permissionState !== 'granted'}
                    onClick={() => {
                      const val = !notifyOnArenaBattle;
                      setNotifyOnArenaBattle(val);
                      showToast(
                        'Preferência de Alerta',
                        val 
                          ? 'Configurado: Você será avisado de ultrapassagens na Arena.' 
                          : 'Configurado: Avisos de ultrapassagem foram desativados.',
                        'info'
                      );
                    }}
                    className={clsx(
                      "w-10 h-5 rounded-full relative transition-all duration-300",
                      notifyOnArenaBattle ? "bg-orange-500" : "bg-white/10"
                    )}
                  >
                    <motion.div 
                      animate={{ x: notifyOnArenaBattle ? 20 : 4 }}
                      className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-xl"
                    />
                  </button>
                </div>
              </div>

              {/* Action Test Button */}
              {permissionState === 'granted' && pushNotificationsEnabled && (
                <button
                  type="button"
                  onClick={triggerTestNotification}
                  className="mt-2 w-full flex items-center justify-center gap-2 p-3 bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] rounded-2xl text-[11px] font-black text-white/70 hover:text-white uppercase tracking-wider transition-all"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  <span>Testar Sinal de Notificação</span>
                </button>
              )}

           </div>
        </div>

        {/* Polling Frequency Configuration - Independent Premium Section */}
        <div className="flex flex-col gap-4">
           <SectionHeader title="Sincronização de Dados" action={<Clock className="h-4 w-4 text-white/20" />} />
           <p className="text-[11px] text-white/40 font-medium px-1">
             Configure o tempo de resposta do sistema. Defina o intervalo em que a Arena fará requisições de fundo para capturar novos streams e picos de reprodução.
           </p>
           
           <div className="glass-card p-6 flex flex-col gap-6">
              <div className="flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-1">
                   <span className="text-[13px] font-bold text-white/90">Tempo do Intervalo</span>
                   <span className="text-[10px] text-white/30">Determina com precisão a cada quantos segundos os dados são requisitados.</span>
                </div>
                
                {/* Manual Numeric input with visual styling */}
                <div className="flex items-center gap-2 self-start shrink-0">
                   <input 
                     type="number"
                     min={5}
                     max={900}
                     value={pollingFrequency}
                     onChange={(e) => {
                       const val = parseInt(e.target.value, 10);
                       if (!isNaN(val)) {
                         setPollingFrequency(val);
                       }
                     }}
                     onBlur={(e) => {
                       let val = parseInt(e.target.value, 10);
                       if (isNaN(val)) val = 60;
                       const clamped = Math.max(5, Math.min(900, val));
                       setPollingFrequency(clamped);
                        showToast(
                          'Sincronização Ajustada', 
                          `O intervalo de busca de dados foi definido para ${clamped} segundos.`, 
                          'success'
                        );
                     }}
                     style={{ contentVisibility: 'auto' }}
                     className="w-20 px-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-center text-xs font-mono font-bold text-white focus:border-orange-500/50 outline-none hover:border-white/20 transition-all font-mono"
                   />
                   <span className="text-xs font-bold text-white/40 font-mono font-bold">segundos</span>
                </div>
              </div>

              {/* Range Selector slider */}
              <div className="flex flex-col gap-3">
                 <div className="flex justify-between items-center text-[10px] text-white/30 font-black font-mono tracking-wider">
                    <span>RÁPIDO (5s)</span>
                    <span className="text-orange-400 font-extrabold text-[11px] bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/20 font-mono">
                      {pollingFrequency}s ({Math.floor(pollingFrequency / 60)}m {pollingFrequency % 60}s)
                    </span>
                    <span>PAUSADO (15m / 900s)</span>
                 </div>
                 <div className="relative flex items-center">
                   <input 
                     type="range"
                     min={5}
                     max={900}
                     step={1}
                     value={pollingFrequency}
                     onChange={(e) => {
                       const val = parseInt(e.target.value, 10);
                       setPollingFrequency(val);
                     }}
                     className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-0"
                   />
                 </div>
                 <div className="text-[10px] text-white/40 flex items-start gap-1.5 leading-snug">
                   <Info className="h-3 w-3 text-orange-400 shrink-0 mt-0.5" />
                   <span>Recomendado: 30s a 120s. Valores abaixo de 10s podem gerar maior consumo de banda ou sobrecarregar as requisições se houver conexões instáveis.</span>
                 </div>
              </div>

              <div className="h-px w-full bg-white/5 my-2" />

              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  disabled={isRefreshing}
                  onClick={async () => {
                    try {
                      await fetchGroup(true);
                      showToast('Sincronia Completa', 'Banco de dados do grupo atualizado do zero.', 'success');
                    } catch (err: any) {
                      console.error(err);
                      showToast('Erro de Sincronia', err?.message || 'Falha ao sincronizar dados completos.', 'error');
                    }
                  }}
                  className="w-full h-11 flex items-center justify-center gap-2.5 px-4 bg-orange-500 hover:bg-orange-600 border border-orange-600/30 text-white rounded-2xl text-xs font-black uppercase tracking-[0.1em] shadow-[0_10px_25px_rgba(249,115,22,0.15)] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-wait"
                >
                  {isRefreshing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span className="truncate">Atualizando Sincronia...</span>
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 shrink-0" />
                      <span className="truncate">Atualizar banco de dados completo</span>
                    </>
                  )}
                </button>
                <span className="text-[10px] text-white/40 leading-normal px-1">
                  Diferente do refresh live da Home, isso força uma varredura profunda sincronizando do zero os tops, streams e dados históricos de todos os usuários do grupo.
                </span>
              </div>
           </div>
        </div>

        {/* Visual Customizations - Animations & Effects */}
        <div className="flex flex-col gap-4">
           <SectionHeader title="Ajustes Visuais & Animações" action={<Sparkles className="h-4 w-4 text-white/20" />} />
           <p className="text-[11px] text-white/40 font-medium px-1">
             Personalize o ritmo de carregamento, brilho (shimmer) e fade-in dos cards de músicas e histórico de amigos.
           </p>
           
           <div className="glass-card p-6 flex flex-col gap-6">
              <div className="flex flex-col gap-4">
                 <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                       <span className="text-[13px] font-bold text-white/90">Modelo padrão do vinil</span>
                       <span className="text-[10px] text-white/30">Modelo liso fixado enquanto refinamos as outras texturas.</span>
                    </div>
                    <Disc className="h-4 w-4 shrink-0 text-white/25" />
                 </div>

                 <div className="grid grid-cols-1 gap-2">
                   {[
                     { value: '1', label: 'Modelo 1' },
                   ].map((option) => {
                     const active = vinylTextureMode === option.value;
                     return (
                       <button
                         key={option.value}
                         onClick={() => {
                           setVinylTextureMode('1');
                           showToast(
                             'Vinil',
                             'Modelo 1 fixado para todos os vinis.',
                             'info'
                           );
                         }}
                         className={clsx(
                           "glass h-10 rounded-2xl text-[10px] font-black uppercase tracking-[0.14em] transition-all active:scale-[0.97]",
                           active ? "text-orange-400 ring-1 ring-orange-500/50" : "text-white/45 hover:text-white/75"
                         )}
                         style={{ border: 0 }}
                       >
                         {option.label}
                       </button>
                     );
                   })}
                 </div>
              </div>

              <div className="h-px w-full bg-white/5" />

              
              {/* Animation Duration (Fade In) */}
              <div className="flex flex-col gap-4">
                 <div className="flex justify-between items-center bg-transparent">
                    <div className="flex flex-col gap-1">
                       <span className="text-[13px] font-bold text-white/90">Duração do Fade-In</span>
                       <span className="text-[10px] text-white/30">Duração do efeito de esmaecimento ao carregar e expandir cards.</span>
                    </div>
                    <div className="flex items-center gap-1.5 self-start shrink-0">
                       <input 
                         type="number"
                         min="0.05"
                         max="3.0"
                         step="0.05"
                         value={animationDuration}
                         onChange={(e) => {
                           const val = parseFloat(e.target.value);
                           if (!isNaN(val)) {
                             setAnimationDuration(Math.max(0.05, Math.min(3.0, val)));
                             showToast(
                               'Efeito Visual', 
                               `Duração do fade-in ajustada para ${val.toFixed(2)}s.`, 
                               'info'
                             );
                           }
                         }}
                         className="w-16 px-2 py-1 bg-black/40 border border-white/10 rounded-xl text-center text-xs font-mono font-bold text-white focus:border-orange-500/50 outline-none hover:border-white/20 transition-all font-mono"
                       />
                       <span className="text-xs font-bold text-white/40 font-mono font-bold">seg</span>
                    </div>
                 </div>

                 {/* Slider for Duration */}
                 <div className="relative flex items-center">
                   <input 
                     type="range"
                     min="0.05"
                     max="3.0"
                     step="0.05"
                     value={animationDuration}
                     onChange={(e) => {
                       const val = parseFloat(e.target.value);
                       setAnimationDuration(val);
                     }}
                     className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-0"
                   />
                 </div>
              </div>

              <div className="h-px w-full bg-white/5" />

              {/* Animation Delay */}
              <div className="flex flex-col gap-4">
                 <div className="flex justify-between items-center bg-transparent">
                    <div className="flex flex-col gap-1">
                       <span className="text-[13px] font-bold text-white/90">Atraso (Delay) do Cascade</span>
                       <span className="text-[10px] text-white/30">O delay multiplicador entre o surgimento sequencial de cada card.</span>
                    </div>
                    <div className="flex items-center gap-1.5 self-start shrink-0">
                       <input 
                         type="number"
                         min="0.0"
                         max="0.5"
                         step="0.01"
                         value={animationDelay}
                         onChange={(e) => {
                           const val = parseFloat(e.target.value);
                           if (!isNaN(val)) {
                             setAnimationDelay(Math.max(0.0, Math.min(0.5, val)));
                             showToast(
                               'Ritmo de Exibição', 
                               `Atraso do cascade definido em ${val.toFixed(2)}s por item.`, 
                               'info'
                             );
                           }
                         }}
                         className="w-16 px-2 py-1 bg-black/40 border border-white/10 rounded-xl text-center text-xs font-mono font-bold text-white focus:border-orange-500/50 outline-none hover:border-white/20 transition-all font-mono"
                       />
                       <span className="text-xs font-bold text-white/40 font-mono font-bold">seg</span>
                    </div>
                 </div>

                 {/* Slider for Delay */}
                 <div className="relative flex items-center">
                   <input 
                     type="range"
                     min="0.0"
                     max="0.5"
                     step="0.01"
                     value={animationDelay}
                     onChange={(e) => {
                       const val = parseFloat(e.target.value);
                       setAnimationDelay(val);
                     }}
                     className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-0"
                   />
                 </div>
              </div>

              <div className="h-px w-full bg-white/5" />

              {/* Shimmer Speed */}
              <div className="flex flex-col gap-4">
                 <div className="flex justify-between items-center bg-transparent">
                    <div className="flex flex-col gap-1">
                       <span className="text-[13px] font-bold text-white/90">Velocidade do Shimmer</span>
                       <span className="text-[10px] text-white/30">Duração do ciclo de varredura brilhante em imagens carregando.</span>
                    </div>
                    <div className="flex items-center gap-1.5 self-start shrink-0">
                       <input 
                         type="number"
                         min="0.5"
                         max="5.0"
                         step="0.1"
                         value={shimmerDuration}
                         onChange={(e) => {
                           const val = parseFloat(e.target.value);
                           if (!isNaN(val)) {
                             setShimmerDuration(Math.max(0.5, Math.min(5.0, val)));
                             showToast(
                               'Estética de Carregamento', 
                               `Velocidade do brilho (shimmer) ajustada para ${val.toFixed(1)}s.`, 
                               'info'
                             );
                           }
                         }}
                         className="w-16 px-2 py-1 bg-black/40 border border-white/10 rounded-xl text-center text-xs font-mono font-bold text-white focus:border-orange-500/50 outline-none hover:border-white/20 transition-all font-mono"
                       />
                       <span className="text-xs font-bold text-white/40 font-mono font-bold">seg</span>
                    </div>
                 </div>

                 {/* Slider for Shimmer */}
                 <div className="relative flex items-center">
                   <input 
                     type="range"
                     min="0.5"
                     max="5.0"
                     step="0.1"
                     value={shimmerDuration}
                     onChange={(e) => {
                       const val = parseFloat(e.target.value);
                       setShimmerDuration(val);
                     }}
                     className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500 focus:outline-none focus:ring-0"
                   />
                 </div>
              </div>

           </div>
        </div>

        {/* Sistema */}
        <div className="flex flex-col gap-4">
          <SectionHeader title="Sistema" action={<Database className="h-4 w-4 text-white/20" />} />
          <div className="glass-card p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-[13px] font-bold text-white/90">Reiniciar App</span>
              <span className="text-[10px] text-white/30 leading-relaxed">
                Limpa o cache local, dados salvos da Home e força o app a abrir do zero neste dispositivo.
              </span>
              <div className="mt-2 p-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-orange-500/60 shrink-0 mt-0.5" />
                  <span className="text-[9px] text-orange-500/60 leading-relaxed">
                    Seus dados do stats.fm não serão apagados. Apenas o cache local deste navegador/app será limpo.
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleResetApp}
              disabled={isResettingApp}
              className={clsx(
                "w-full py-3 px-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all",
                "flex items-center justify-center gap-2",
                isResettingApp
                  ? "bg-white/5 text-white/30 cursor-not-allowed"
                  : "bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 border border-orange-500/20 active:scale-[0.98]"
              )}
            >
              {isResettingApp ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Limpando...
                </>
              ) : (
                <>
                  <Database className="h-3.5 w-3.5" />
                  Limpar e Reiniciar
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-10 mb-20 flex flex-col items-center gap-4 py-8">
           {(import.meta as any).env.DEV && (
             <div className="flex flex-col gap-4 w-full">
               <SectionHeader title="DEBUG (SYNC)" action={<AlertTriangle className="h-4 w-4 text-red-500" />} />
               <div className="glass-card p-6 bg-red-950/10 border-red-500/20 rounded-3xl">
                 <pre className="text-[10px] text-white/70 font-mono">
                   Ultimo Fetch Live: {new Date(lastFetchTime.live || 0).toLocaleTimeString()}
                   Ultimo Fetch Grupo: {new Date(lastFetchTime.group || 0).toLocaleTimeString()}
                   NowPlaying Count: {members.filter((m: any) => m.nowPlaying?.isNow).length}
                   Endpoint: /api/group-live
                 </pre>
               </div>
             </div>
           )}

           <div className="flex flex-col items-center gap-1 opacity-40 mt-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-white">stats.lc</span>
              <span className="text-[9px] font-medium text-white/50">feito por leo saquetto</span>
           </div>
        </div>
      </div>

      <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -10, scale: 0.9, filter: "blur(8px)" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto flex flex-col gap-2 p-4 rounded-[24px] border backdrop-blur-2xl bg-black/60 shadow-[0_20px_50px_rgba(0,0,0,0.4)] cursor-default overflow-hidden relative group"
              style={{
                borderColor: toast.type === 'success' ? 'rgba(249, 115, 22, 0.2)' : toast.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              }}
            >
              {/* Background Accent glow */}
              <div className={clsx(
                "absolute -right-4 -bottom-4 w-24 h-24 blur-3xl opacity-20 pointer-events-none transition-all duration-500 group-hover:opacity-30",
                toast.type === 'success' ? "bg-orange-500" : toast.type === 'error' ? "bg-red-500" : "bg-white"
              )} />

              <div className="flex items-start gap-3.5 relative z-10">
                {/* Icon Swab */}
                <div className={clsx(
                  "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                  toast.type === 'success' ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : 
                  toast.type === 'error' ? "bg-red-500/15 text-red-500 border border-red-500/20" : 
                  "bg-white/10 text-white/60 border border-white/10"
                )}>
                  {toast.type === 'success' && <Check className="h-4 w-4 stroke-[2.5]" />}
                  {toast.type === 'error' && <AlertTriangle className="h-4 w-4 stroke-[2.5]" />}
                  {toast.type === 'info' && <Info className="h-4 w-4 stroke-[2.5]" />}
                </div>

                <div className="flex flex-col flex-1 gap-1 pr-4">
                  <div className="flex items-center justify-between">
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{toast.title}</span>
                     <span className="text-[7px] font-mono font-black text-white/20">{toast.timestamp}</span>
                  </div>
                  <span className="text-[12px] font-bold text-white/90 leading-tight">
                    {toast.message}
                  </span>
                </div>

                <button 
                  onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                  className="absolute top-0 -right-1 h-6 w-6 rounded-lg hover:bg-white/5 flex items-center justify-center text-white/20 hover:text-white/80 transition-all cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <SnapshotHistoryModal 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
      />
    </div>
  );
}
