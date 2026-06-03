import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  Bell,
  BellRing,
  Check,
  ChevronRight,
  Clock,
  Database,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Info,
  Loader2,
  Settings,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useStatsStore } from '../store/useStatsStore';
import { notificationService } from '../services/notificationService';
import { SnapshotHistoryModal } from '../components/shared/SnapshotHistoryModal';
import { PremiumScreenHeader } from '../components/shared/PremiumScreenShell';
import { dedupeIds, getCanonicalMembers } from '../lib/memberSelectors';
import type { UserStats } from '../types/stats';
import {
  MemberCard,
  MemberVisibilityChip,
  PreferenceRow,
  SettingsGroup,
  SettingsPanel,
  ToggleSwitch,
} from '../components/settings/SettingsUI';

interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'error';
  timestamp: string;
}

const NAV_ITEMS = [
  { id: 'profile', label: 'Perfil' },
  { id: 'privacy', label: 'Privacidade' },
  { id: 'home', label: 'Home' },
  { id: 'share', label: 'Snaps' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'sync', label: 'Dados' },
  { id: 'system', label: 'Sistema' },
] as const;

type SettingsSectionId = typeof NAV_ITEMS[number]['id'];

const getFirstName = (name?: string) => (name || '').trim().split(/\s+/)[0] || name || '';
const sectionDivider = <div className="h-px w-full bg-white/5" />;

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
  const fetchGroup = useStatsStore(state => state.fetchGroup);
  const isRefreshing = useStatsStore(state => state.isRefreshing);
  const lastFetchTime = useStatsStore(state => state.lastFetchTime);
  const historyOrder = useStatsStore(state => state.historyOrder);
  const setHistoryOrder = useStatsStore(state => state.setHistoryOrder);
  const historyCustomOrder = useStatsStore(state => state.historyCustomOrder);
  const setHistoryCustomOrder = useStatsStore(state => state.setHistoryCustomOrder);

  const members = useMemo(() => getCanonicalMembers(groupStats), [groupStats]);
  const alphabeticalMembers = useMemo(
    () => [...members].sort((a, b) => getFirstName(a.name).localeCompare(getFirstName(b.name), 'pt-BR', { sensitivity: 'base' })),
    [members]
  );
  const customSortedMembers = useMemo(() => {
    const order = historyCustomOrder || [];
    return [...members].sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  }, [historyCustomOrder, members]);

  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    notificationService.getPermissionState()
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isResettingApp, setIsResettingApp] = useState(false);
  const [arenaNameDraft, setArenaNameDraft] = useState(arenaName || '');
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('profile');
  const arenaNameSaveButtonRef = useRef<HTMLButtonElement | null>(null);
  const manualSectionUntilRef = useRef(0);
  const featuredMember = useMemo(
    () => members.find(member => member.id === featuredUserId) || members[0],
    [featuredUserId, members]
  );

  useEffect(() => {
    setArenaNameDraft(arenaName || '');
  }, [arenaName]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const nodes = NAV_ITEMS
      .map(item => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (nodes.length === 0) return;

    const observer = new IntersectionObserver(
      entries => {
        if (Date.now() < manualSectionUntilRef.current) return;

        const isAtPageEnd =
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12;
        if (isAtPageEnd) {
          setActiveSection('system');
          return;
        }

        const visibleEntry = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target?.id) {
          setActiveSection(visibleEntry.target.id as SettingsSectionId);
        }
      },
      { rootMargin: '-22% 0px -62% 0px', threshold: [0, 0.2, 0.45, 0.7] }
    );

    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: SettingsSectionId) => {
    manualSectionUntilRef.current = Date.now() + 1500;
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => setActiveSection(id), 900);
  };

  const showToast = (title: string, message: string, type: ToastItem['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setToasts(prev => [...prev, { id, title, message, type, timestamp }]);
    window.setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), 4200);
  };

  const handleFeaturedUserChange = (user: UserStats) => {
    if (!user?.id) return;
    if (user.id === featuredUserId) {
      showToast('Usuário em Destaque', `${user.name} já está carregado como referência principal.`, 'info');
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

  const toggleHideUser = (id: string, name: string) => {
    const isHidden = hiddenUsers.includes(id);
    setHiddenUsers(isHidden ? dedupeIds(hiddenUsers.filter(userId => userId !== id)) : dedupeIds([...hiddenUsers, id]));
    showToast(
      'Privacidade Atualizada',
      isHidden
        ? `${name} voltou para listas e rankings deste dispositivo.`
        : `${name} foi ocultado de listas e rankings deste dispositivo.`,
      isHidden ? 'success' : 'info'
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
    showToast('Nome da Arena', 'Nome salvo para relatórios e compartilhamentos.', 'success');
  };

  const handleTogglePush = async () => {
    if (pushNotificationsEnabled) {
      setPushNotificationsEnabled(false);
      showToast('Notificações Desativadas', 'Alertas de atividade foram pausados neste dispositivo.', 'info');
      return;
    }

    try {
      const permission = await notificationService.requestPermission();
      setPermissionState(permission);
      if (permission !== 'granted') {
        setPushNotificationsEnabled(false);
        showToast('Permissão Negada', 'Libere notificações no navegador para ativar os alertas.', 'error');
        return;
      }
      setPushNotificationsEnabled(true);
      showToast('Notificações Ativadas', 'Alertas da Arena foram configurados para este dispositivo.', 'success');
      window.setTimeout(() => notificationService.sendTestNotification(), 500);
    } catch (error) {
      console.error(error);
      showToast('Erro na Configuração', 'Não foi possível registrar as notificações agora.', 'error');
    }
  };

  const handleResetApp = async () => {
    const confirmed = window.confirm(
      'Limpar cache e reiniciar?\n\nIsso remove dados locais deste dispositivo e recarrega o app. Seus dados do stats.fm não serão apagados.'
    );
    if (!confirmed) return;

    setIsResettingApp(true);
    try {
      [
        'stats-lc-storage',
        'stats-cache_groupStats',
        'stats-cache_groupStats_timestamp',
        'stats-cache_userFullStatsCache',
        'stats-cache_userFullStatsCacheMeta',
        'stats-cache_timeRangeStatsCache',
        'stats-cache_timeRangeStatsCacheMeta',
        'stats-cache_topItemsCache',
        'stats-cache_topItemsCacheMeta',
      ].forEach(key => localStorage.removeItem(key));

      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('stats-cache_')) localStorage.removeItem(key);
      });
      sessionStorage.clear();

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(key => caches.delete(key).catch(() => false)));
      }

      showToast('Cache Limpo', 'Reiniciando o app...', 'success');
      await new Promise(resolve => window.setTimeout(resolve, 300));
      window.location.href = '/#/';
    } catch (error) {
      console.error('Failed to reset app:', error);
      setIsResettingApp(false);
      showToast('Erro ao Limpar', 'Não foi possível limpar tudo. Tente fechar e abrir o app.', 'error');
    }
  };

  const reorderCustomMember = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const items = [...customSortedMembers];
    const [draggedItem] = items.splice(fromIndex, 1);
    items.splice(toIndex, 0, draggedItem);
    setHistoryCustomOrder(dedupeIds(items.map(member => member.id)));
    showToast('Ordem Atualizada', 'Prioridade personalizada da Home foi salva.', 'success');
  };

  return (
    <div className="flex flex-col gap-5 px-4 pb-32">
      <PremiumScreenHeader
        eyebrow="Preferências"
        title="Ajustes"
        description="Controle perfil em destaque, privacidade, alertas e dados locais com a mesma densidade visual da Órbita."
        icon={<Settings className="h-5 w-5" />}
      >
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-2xl border border-white/7 bg-black/22 px-3 py-2">
            <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">Perfil</span>
            <span className="mt-1 block truncate text-[12px] font-black text-white/90">{getFirstName(featuredMember?.name) || 'Leo'}</span>
          </div>
          <div className="rounded-2xl border border-white/7 bg-black/22 px-3 py-2">
            <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">Ocultos</span>
            <span className="mt-1 block text-[12px] font-black text-white/90">{hiddenUsers.length}</span>
          </div>
          <div className="rounded-2xl border border-white/7 bg-black/22 px-3 py-2">
            <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-white/30">Arena</span>
            <span className="mt-1 block truncate text-[12px] font-black text-white/90">{arenaName || 'Arena'}</span>
          </div>
        </div>
      </PremiumScreenHeader>

      <nav className="sticky top-[max(env(safe-area-inset-top),12px)] z-30 -mx-1 px-1 py-2">
        <div className="relative overflow-hidden rounded-[26px] border border-white/8 bg-black/68 shadow-[0_14px_34px_rgba(0,0,0,0.26)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-black/85 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-black/85 to-transparent" />
          <div className="no-scrollbar scrolling-touch flex min-w-full gap-0.5 overflow-x-auto p-1.5 scroll-fade-h">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                aria-current={activeSection === item.id ? 'page' : undefined}
                className={clsx(
                  'relative z-20 min-w-0 flex-1 rounded-2xl px-1.5 py-2 text-[7.5px] font-black uppercase tracking-[0.07em] transition-[background-color,color,box-shadow,transform] duration-200 active:scale-[0.96]',
                  activeSection === item.id
                    ? 'bg-orange-500/16 text-orange-300 shadow-[inset_0_0_0_1px_rgba(255,95,0,0.18)]'
                    : 'text-white/42 hover:bg-white/[0.045] hover:text-white/72'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="flex flex-col gap-8">
        <SettingsGroup
          id="profile"
          eyebrow="Perfil"
          title="Usuário em destaque"
          description="Define quem guia a Home. A troca reinicia a Home para carregar o perfil completo."
          action={<Users className="h-4 w-4" />}
        >
          <SettingsPanel>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5 lg:grid-cols-7">
              {alphabeticalMembers.map(user => (
                <MemberCard
                  key={user.id}
                  user={user}
                  active={featuredUserId === user.id}
                  onClick={() => handleFeaturedUserChange(user)}
                />
              ))}
            </div>
          </SettingsPanel>
        </SettingsGroup>

        <SettingsGroup
          id="privacy"
          eyebrow="Privacidade"
          title="Visibilidade"
          description="Ocultar membros afeta listas e rankings, sem resetar o usuário em destaque."
          action={<EyeOff className="h-4 w-4" />}
        >
          <SettingsPanel className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-bold text-white/90">Membros ocultos</div>
                <div className="mt-1 text-[10px] font-medium text-white/34">
                  {hiddenUsers.length === 0 ? 'Todos os membros estão visíveis.' : `${hiddenUsers.length} membro(s) oculto(s).`}
                </div>
              </div>
              <button
                type="button"
                disabled={hiddenUsers.length === 0}
                onClick={() => {
                  setHiddenUsers([]);
                  showToast('Privacidade Atualizada', 'Todos os membros voltaram a aparecer.', 'success');
                }}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-white/55 transition-[background-color,border-color,color,transform,opacity] duration-200 active:scale-95 disabled:opacity-25"
              >
                Mostrar todos
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {alphabeticalMembers.map(user => (
                <MemberVisibilityChip
                  key={user.id}
                  user={user}
                  hidden={hiddenUsers.includes(user.id)}
                  featured={featuredUserId === user.id}
                  onClick={() => toggleHideUser(user.id, user.name)}
                />
              ))}
            </div>
            {sectionDivider}
            <PreferenceRow
              title="Distintivo de Ranking"
              description="Oculta medalhas de 1o, 2o e 3o na Arena."
              control={
                <ToggleSwitch
                  label="Alternar distintivo de ranking"
                  checked={hideRankingBadge}
                  onClick={() => {
                    const nextValue = !hideRankingBadge;
                    setHideRankingBadge(nextValue);
                    showToast('Ranking', nextValue ? 'Medalhas ocultadas.' : 'Medalhas voltaram a aparecer.', 'info');
                  }}
                />
              }
            />
          </SettingsPanel>
        </SettingsGroup>

        <SettingsGroup
          id="home"
          eyebrow="Home"
          title="Ordem do histórico"
          description="Controla a ordem dos cards de histórico e atividade no painel principal."
          action={<Clock className="h-4 w-4" />}
        >
          <SettingsPanel className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { id: 'lastPlayed', title: 'Última reprodução', desc: 'Atividade recente' },
                { id: 'alphabetical', title: 'Ordem alfabética', desc: 'A - Z' },
                { id: 'custom', title: 'Personalizada', desc: 'Manual' },
              ].map(option => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setHistoryOrder(option.id as 'lastPlayed' | 'alphabetical' | 'custom');
                    if (option.id === 'custom' && historyCustomOrder.length === 0) {
                      setHistoryCustomOrder(dedupeIds(members.map(member => member.id)));
                    }
                    showToast('Ordem da Home', `${option.title} selecionada.`, 'success');
                  }}
                  className={clsx(
                    'min-h-[64px] rounded-2xl border p-3 text-left transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98]',
                    historyOrder === option.id
                      ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                      : 'border-white/6 bg-white/[0.035] text-white/64 hover:bg-white/[0.06]'
                  )}
                >
                  <div className="text-[12px] font-black leading-tight">{option.title}</div>
                  <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-white/30">{option.desc}</div>
                </button>
              ))}
            </div>

            {historyOrder === 'custom' && (
              <div className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-black/12 p-2">
                {customSortedMembers.map((user, index) => (
                  <div
                    key={user.id}
                    draggable
                    onDragStart={event => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(index));
                    }}
                    onDragOver={event => event.preventDefault()}
                    onDrop={event => {
                      event.preventDefault();
                      const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                      if (!Number.isNaN(fromIndex)) reorderCustomMember(fromIndex, index);
                    }}
                    className="flex min-h-[48px] items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
                  >
                    <span className="w-6 font-mono text-[10px] font-bold text-white/32">{index + 1}o</span>
                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white/78">{user.name}</span>
                    <GripVertical className="h-4 w-4 shrink-0 text-white/25" />
                  </div>
                ))}
              </div>
            )}
          </SettingsPanel>
        </SettingsGroup>

        <SettingsGroup
          id="share"
          eyebrow="Compartilhamento"
          title="Snaps"
          description="Nome da Arena e galeria de snapshots usados em relatórios e compartilhamentos."
          action={<ImageIcon className="h-4 w-4" />}
        >
          <SettingsPanel className="flex flex-col gap-5">
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-bold text-white/90" htmlFor="arena-name">Nome da Arena</label>
              <input
                id="arena-name"
                type="text"
                value={arenaNameDraft}
                onChange={event => setArenaNameDraft(event.target.value.slice(0, 50))}
                onBlur={event => {
                  if (event.relatedTarget === arenaNameSaveButtonRef.current) return;
                  if (arenaNameDraft.trim() && arenaNameDraft.trim() !== (arenaName || '').trim()) handleSaveArenaName();
                }}
                maxLength={50}
                placeholder="Nome da sua Arena"
                className="h-11 rounded-2xl border border-white/10 bg-black/25 px-4 text-sm font-bold text-white outline-none transition-[background-color,border-color,color] duration-200 placeholder:text-white/22 focus:border-orange-500/60"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">{arenaNameDraft.length}/50</span>
                <button
                  ref={arenaNameSaveButtonRef}
                  type="button"
                  onClick={handleSaveArenaName}
                  disabled={arenaNameDraft.trim() === (arenaName || '').trim()}
                  className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[9px] font-black uppercase tracking-[0.12em] text-white/60 transition-[background-color,border-color,color,transform,opacity] duration-200 active:scale-95 disabled:opacity-30"
                >
                  Salvar
                </button>
              </div>
            </div>
            {sectionDivider}
            <PreferenceRow
              icon={<Swords className="h-4 w-4" />}
              title="Histórico de Visualizações"
              description="Reabra snapshots recentes para compartilhar novamente."
              control={
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(true)}
                  className="flex h-10 items-center gap-2 rounded-2xl bg-orange-500 px-3 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-orange-500/15 transition-[background-color,box-shadow,transform] duration-200 active:scale-95"
                >
                  Abrir
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              }
            />
          </SettingsPanel>
        </SettingsGroup>

        <SettingsGroup
          id="alerts"
          eyebrow="Alertas"
          title="Notificações Push"
          description="Preferências locais para alertas de atividade da Arena."
          action={<Bell className="h-4 w-4" />}
        >
          <SettingsPanel className="flex flex-col gap-5">
            <PreferenceRow
              title="Alertas de Atividade"
              description={permissionState === 'denied' ? 'Bloqueado pelo navegador.' : 'Receber updates em tempo real neste dispositivo.'}
              control={
                <ToggleSwitch
                  label="Alternar notificações push"
                  checked={pushNotificationsEnabled && permissionState === 'granted'}
                  disabled={permissionState === 'denied'}
                  onClick={handleTogglePush}
                />
              }
            />
            {permissionState === 'denied' && (
              <div className="rounded-2xl border border-red-500/15 bg-red-500/8 p-3 text-[10px] font-medium leading-relaxed text-red-300/85">
                Notificações estão bloqueadas. Libere a permissão nas configurações do navegador.
              </div>
            )}
            {sectionDivider}
            <div className={clsx('flex flex-col gap-5', (!pushNotificationsEnabled || permissionState !== 'granted') && 'pointer-events-none opacity-35')}>
              <PreferenceRow
                icon={<Activity className="h-4 w-4" />}
                title="Novos streams de amigos"
                description="Avisar quando alguém der play em uma nova faixa."
                control={<ToggleSwitch size="sm" label="Alertas de novos streams" checked={notifyOnNewStreams} onClick={() => setNotifyOnNewStreams(!notifyOnNewStreams)} />}
              />
              <PreferenceRow
                icon={<Sparkles className="h-4 w-4" />}
                title="Destaques do grupo"
                description="Recordes, picos e marcos diários."
                control={<ToggleSwitch size="sm" label="Alertas de destaques" checked={notifyOnGroupHighlights} onClick={() => setNotifyOnGroupHighlights(!notifyOnGroupHighlights)} />}
              />
              <PreferenceRow
                icon={<Swords className="h-4 w-4" />}
                title="Arena Battle"
                description="Ultrapassagens no ranking diário."
                control={<ToggleSwitch size="sm" label="Alertas de ultrapassagem" checked={notifyOnArenaBattle} onClick={() => setNotifyOnArenaBattle(!notifyOnArenaBattle)} />}
              />
            </div>
            {permissionState === 'granted' && pushNotificationsEnabled && (
              <button
                type="button"
                onClick={() => {
                  notificationService.sendTestNotification();
                  showToast('Sinal Enviado', 'Notificação de teste disparada.', 'success');
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-white/5 bg-white/[0.04] text-[11px] font-black uppercase tracking-[0.12em] text-white/70 transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98]"
              >
                <BellRing className="h-4 w-4" />
                Testar notificação
              </button>
            )}
          </SettingsPanel>
        </SettingsGroup>

        <SettingsGroup
          id="sync"
          eyebrow="Dados"
          title="Sincronização"
          description="Atualização completa do banco local."
          action={<Database className="h-4 w-4" />}
        >
          <SettingsPanel className="flex flex-col gap-5">
            <button
              type="button"
              disabled={isRefreshing}
              onClick={async () => {
                try {
                  await fetchGroup(true);
                  showToast('Sincronia Completa', 'Banco de dados do grupo atualizado do zero.', 'success');
                } catch (error: any) {
                  console.error(error);
                  showToast('Erro de Sincronia', error?.message || 'Falha ao sincronizar dados completos.', 'error');
                }
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 text-[11px] font-black uppercase tracking-[0.1em] text-white shadow-[0_10px_25px_rgba(249,115,22,0.15)] transition-[background-color,box-shadow,transform,opacity] duration-200 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
            >
              {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {isRefreshing ? 'Atualizando...' : 'Atualizar banco completo'}
            </button>
            {(import.meta as any).env.DEV && (
              <div className="rounded-2xl border border-red-500/15 bg-red-950/10 p-3 font-mono text-[10px] leading-relaxed text-white/62">
                Último live: {new Date(lastFetchTime.live || 0).toLocaleTimeString()}<br />
                Último grupo: {new Date(lastFetchTime.group || 0).toLocaleTimeString()}<br />
                NowPlaying: {members.filter(member => member.nowPlaying?.isNow).length}<br />
                Endpoint: /api/group-live
              </div>
            )}
          </SettingsPanel>
        </SettingsGroup>

        <SettingsGroup
          id="system"
          eyebrow="Sistema"
          title="Cache local"
          description="Ações de manutenção deste navegador/app."
          action={<AlertTriangle className="h-4 w-4 text-orange-400" />}
        >
          <SettingsPanel className="flex flex-col gap-4">
            <div className="rounded-2xl border border-orange-500/12 bg-orange-500/7 p-3 text-[10px] font-medium leading-relaxed text-orange-300/80">
              Seus dados do stats.fm não serão apagados. Apenas cache e preferências locais deste dispositivo são removidos.
            </div>
            <button
              type="button"
              onClick={handleResetApp}
              disabled={isResettingApp}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 text-[11px] font-black uppercase tracking-[0.12em] text-orange-400 transition-[background-color,border-color,color,transform,opacity] duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isResettingApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
              {isResettingApp ? 'Limpando...' : 'Limpar e reiniciar'}
            </button>
          </SettingsPanel>
        </SettingsGroup>

        <footer className="flex flex-col items-center gap-1 py-8 opacity-40">
          <span className="text-[10px] font-black uppercase tracking-widest text-white">stats.lc</span>
          <span className="text-[9px] font-medium text-white/50">feito por leo saquetto</span>
        </footer>
      </main>

      <ToastStack toasts={toasts} onClose={id => setToasts(prev => prev.filter(toast => toast.id !== id))} />
      <SnapshotHistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} />
    </div>
  );
}

function ToastStack({ toasts, onClose }: { toasts: ToastItem[]; onClose: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed left-1/2 top-24 z-50 flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-3">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -16, scale: 0.96, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, scale: 0.96, filter: 'blur(8px)' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-auto relative overflow-hidden rounded-[24px] border bg-black/70 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.4)] backdrop-blur-2xl"
            style={{
              borderColor: toast.type === 'error' ? 'rgba(239,68,68,0.22)' : toast.type === 'success' ? 'rgba(249,115,22,0.24)' : 'rgba(255,255,255,0.1)',
            }}
          >
            <div className="flex items-start gap-3">
              <div className={clsx(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border',
                toast.type === 'error' ? 'border-red-500/20 bg-red-500/15 text-red-400' : toast.type === 'success' ? 'border-orange-500/20 bg-orange-500/15 text-orange-400' : 'border-white/10 bg-white/10 text-white/65'
              )}>
                {toast.type === 'error' ? <AlertTriangle className="h-4 w-4" /> : toast.type === 'success' ? <Check className="h-4 w-4" /> : <Info className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1 pr-6">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{toast.title}</span>
                  <span className="font-mono text-[7px] font-black text-white/20">{toast.timestamp}</span>
                </div>
                <p className="mt-1 text-[12px] font-bold leading-tight text-white/90">{toast.message}</p>
              </div>
              <button
                type="button"
                onClick={() => onClose(toast.id)}
                className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-white/25 transition-colors hover:bg-white/5 hover:text-white/80"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
