import React from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Check, Clock3, Eye, Headphones, Inbox, Loader2, MessageCircle, Music2, Send, Search, Sparkles, Trash2, UserPlus } from 'lucide-react';
import { clsx } from 'clsx';
import { SmartImage } from '../shared/CommonUI';
import { coreUtils } from '../../services/statsCore';
import { getArtistListString } from '../../lib/artistUtils';
import { orbitService, type Orbit, type OrbitBox, type OrbitSummary } from '../../services/orbitService';

const emptySummary: OrbitSummary = { received: 0, sent: 0, sentListened: 0, unread: 0 };
const LISTEN_CHECK_TTL_MS = 5 * 60 * 1000;
const MAX_PROGRESSIVE_LISTEN_CHECKS = 3;

const getTrackImage = (track: any) => (
  track?.albumImage || track?.album?.image || track?.album?.images?.[0]?.url || track?.image || track?.images?.[0]?.url || ''
);
const getMemberId = (member: any) => String(member?.id || member?.key || '');
const findMember = (members: any[], personId?: string) => members.find((member) => getMemberId(member) === String(personId || ''));

const statusLabel: Record<string, string> = {
  sent: 'Enviado',
  seen: 'Visto',
  opened: 'Link aberto',
  listened: 'Ouvido',
  dismissed: 'Arquivado',
};

function OrbitCard({ orbit, members, box, onOpen, onDelete }: { orbit: Orbit; members: any[]; box: OrbitBox; onOpen: (orbit: Orbit) => void; onDelete: (orbit: Orbit) => void }) {
  const personId = box === 'sent' ? orbit.toUserId : orbit.fromUserId;
  const person = findMember(members, personId);
  const heard = orbit.listenCountSinceSent > 0 || orbit.status === 'listened';
  const canOpen = box === 'received' && !!orbit.listenUrl;
  const directionLabel = box === 'sent' ? 'Para' : 'De';
  const platformLabel = orbit.targetPlatform ? String(orbit.targetPlatform).toUpperCase() : 'Plataforma';

  return (
    <article className="overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.045),rgba(255,255,255,0.016))] p-3">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <SmartImage src={getTrackImage(orbit.track)} className="h-14 w-14 rounded-[20px] border border-white/8" fallback={orbit.track?.name || 'Musica'} rounded="[20px]" />
          <SmartImage
            src={coreUtils.getUserAvatar(getMemberId(person) || personId, person?.avatar)}
            className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full border border-[#171717]"
            fallback={person?.name || personId}
            rounded="full"
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-black text-white/90">{orbit.track?.name || 'Musica'}</p>
          </div>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
            {getArtistListString(orbit.track)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-white/7 bg-black/[0.24] px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/38">
              {directionLabel} {person?.name || personId}
            </span>
            <span className="rounded-full border border-white/7 bg-black/[0.24] px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em] text-white/32">
              {platformLabel}
            </span>
          </div>
        </div>
        <div className={clsx(
          "flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em]",
          heard ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-white/8 bg-white/[0.03] text-white/40"
        )}>
          {heard ? <Headphones className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {statusLabel[orbit.status] || orbit.status}
        </div>
      </div>

      {orbit.message && (
        <div className="mt-3 flex gap-2 rounded-2xl bg-black/20 px-3 py-2 text-xs font-semibold leading-relaxed text-white/58">
          <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-300/60" />
          <p>{orbit.message}</p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 text-[10px] font-bold uppercase tracking-[0.12em] text-white/32">
        <span className="flex min-w-0 items-center gap-1.5 truncate">
          <Clock3 className="h-3 w-3 shrink-0" />
          {coreUtils.formatRelativeTimeSP(orbit.createdAt)}
        </span>
        <span>{orbit.listenCountSinceSent || 0} plays</span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {canOpen ? (
          <button
            type="button"
            onClick={() => onOpen(orbit)}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.18em] text-white transition-[transform,opacity] duration-200 active:scale-[0.98]"
          >
            Ouvir agora
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        ) : (
          <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/7 bg-white/[0.02] px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/34">
            <Headphones className="h-3.5 w-3.5" />
            {heard ? 'Reproduzido' : box === 'sent' ? 'Aguardando play' : 'Sem link direto'}
          </div>
        )}
        <button
          type="button"
          onClick={() => onDelete(orbit)}
          aria-label="Excluir Orbit"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.02] text-white/35 transition-[color,transform,border-color] duration-200 active:scale-[0.95]"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export function OrbitsSection({ currentUserId, members }: { currentUserId?: string; members: any[] }) {
  const sectionRef = React.useRef<HTMLElement | null>(null);
  const [box, setBox] = React.useState<OrbitBox>('received');
  const [summary, setSummary] = React.useState<OrbitSummary>(emptySummary);
  const [items, setItems] = React.useState<Orbit[]>([]);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'empty' | 'pending-api'>('loading');
  const [toUserId, setToUserId] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = React.useState<any>(null);
  const [message, setMessage] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!currentUserId) return;
    const controller = new AbortController();
    setStatus('loading');

    const load = async () => {
      const summaryRequest = orbitService.summary(currentUserId, controller.signal)
        .then(setSummary)
        .catch(() => {});

      if (box === 'all') {
        setStatus('ready');
        await summaryRequest;
        return;
      }

      const nextItems = await orbitService.list(currentUserId, box, controller.signal);
      setItems(nextItems);
      setStatus(nextItems.length > 0 ? 'ready' : 'empty');
      await summaryRequest;

      if (box === 'received') {
        const unseenItems = nextItems.filter(orbit => !orbit.seenAt);
        if (unseenItems.length > 0) {
          Promise.allSettled(unseenItems.map(orbit => orbitService.markSeen(orbit.id)))
            .then(() => orbitService.summary(currentUserId, controller.signal))
            .then(setSummary)
            .catch(() => {});
        }
        return;
      }

      const staleItems = nextItems
        .filter((orbit) => !orbit.lastCheckedAt || Date.now() - Date.parse(orbit.lastCheckedAt) > LISTEN_CHECK_TTL_MS)
        .slice(0, MAX_PROGRESSIVE_LISTEN_CHECKS);
      if (staleItems.length === 0) return;

      const checked = await Promise.allSettled(staleItems.map((orbit) => orbitService.checkListens(orbit.id)));
      if (controller.signal.aborted) return;
      const refreshedById = new Map(
        checked
          .filter((result): result is PromiseFulfilledResult<Orbit> => result.status === 'fulfilled')
          .map((result) => [result.value.id, result.value])
      );
      if (refreshedById.size === 0) return;
      setItems((current) => current.map((orbit) => refreshedById.get(orbit.id) || orbit));
      orbitService.summary(currentUserId, controller.signal).then(setSummary).catch(() => {});
    };

    load().catch(() => {
      if (!controller.signal.aborted) setStatus('pending-api');
    });
    return () => controller.abort();
  }, [box, currentUserId]);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    orbitService.searchTracks(query.trim(), currentUserId, controller.signal)
      .then(setResults)
      .catch(() => setResults([]));
    return () => controller.abort();
  }, [currentUserId, query]);

  React.useEffect(() => {
    const handleComposeOrbit = (event: Event) => {
      const track = (event as CustomEvent<{ track?: any }>).detail?.track;
      if (!track) return;
      setBox('all');
      setSelectedTrack(track);
      setQuery(track.name || '');
      setResults([track]);
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.addEventListener('stats-lc:compose-orbit', handleComposeOrbit);
    return () => window.removeEventListener('stats-lc:compose-orbit', handleComposeOrbit);
  }, []);

  const recipients = React.useMemo(
    () => members.filter((member) => {
      const memberId = getMemberId(member);
      return memberId && memberId !== currentUserId;
    }),
    [currentUserId, members]
  );
  const selectedRecipient = React.useMemo(() => findMember(recipients, toUserId), [recipients, toUserId]);

  const sendOrbit = async () => {
    if (!currentUserId || !toUserId || !selectedTrack) return;
    setSending(true);
    try {
      await orbitService.create({ fromUserId: currentUserId, toUserId, track: selectedTrack, message: message.trim() || undefined });
      setBox('sent');
      setSelectedTrack(null);
      setQuery('');
      setMessage('');
      setToUserId('');
    } catch {
      setStatus('pending-api');
    } finally {
      setSending(false);
    }
  };

  const openOrbit = async (orbit: Orbit) => {
    if (!orbit.listenUrl) return;
    orbitService.markOpened(orbit.id).catch(() => {});
    window.open(orbit.listenUrl, '_blank', 'noopener,noreferrer');
  };

  const deleteOrbit = async (orbit: Orbit) => {
    if (box === 'sent') await orbitService.deleteSent(orbit.id);
    else await orbitService.deleteReceived(orbit.id);
    setItems(prev => prev.filter(item => item.id !== orbit.id));
    if (currentUserId) {
      orbitService.summary(currentUserId).then(setSummary).catch(() => {});
    }
  };

  const selectedTrackKey = selectedTrack ? String(selectedTrack.id || selectedTrack.name || '') : '';

  return (
    <section ref={sectionRef} className="px-4 pb-28 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[34px] border border-white/8 bg-[radial-gradient(circle_at_12%_12%,rgba(249,115,22,0.17),transparent_34%),linear-gradient(145deg,rgba(255,255,255,0.055),rgba(255,255,255,0.017))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)]">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10 text-orange-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.28em] text-orange-200/82">Orbits</p>
            <h2 className="mt-1 text-2xl font-black leading-none tracking-[-0.04em] text-white">inbox musical</h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-white/45">
              Recomendações entre amigos com leitura rápida, histórico progressivo e ação direta na plataforma certa.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 text-left">
          {[
            { label: 'Recebidos', value: summary.received, icon: Inbox },
            { label: 'Novos', value: summary.unread, icon: Eye },
            { label: 'Enviados', value: summary.sent, icon: Send },
            { label: 'Virou play', value: summary.sentListened, icon: Headphones },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="min-w-0 rounded-[20px] border border-white/6 bg-black/[0.22] px-2.5 py-3">
                <Icon className="mb-1.5 h-3.5 w-3.5 text-orange-300/72" />
                <p className="text-lg font-black leading-none text-white/92">{item.value}</p>
                <p className="mt-1 text-[7px] font-black uppercase tracking-[0.11em] text-white/30">{item.label}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-5 grid grid-cols-3 gap-1 rounded-[22px] bg-black/[0.24] p-1">
          {[
            { id: 'received', label: 'Inbox', icon: Inbox },
            { id: 'sent', label: 'Enviados', icon: Send },
            { id: 'all', label: 'Criar', icon: Search },
          ].map(tab => {
            const Icon = tab.icon;
            const active = (tab.id === 'all' && box === 'all') || box === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setBox(tab.id as OrbitBox)}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  "flex items-center justify-center gap-1.5 rounded-[18px] px-2 py-2.5 text-[9px] font-black uppercase tracking-[0.12em] transition-[color,transform,background-color] duration-200 active:scale-[0.96]",
                  active ? "bg-orange-500/[0.18] text-orange-300" : "text-white/35 hover:text-white/58"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {box === 'all' ? (
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-1">
                <UserPlus className="h-3.5 w-3.5 text-orange-300/70" />
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/42">Escolha quem recebe</p>
              </div>
              {recipients.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {recipients.map((member) => {
                    const memberId = getMemberId(member);
                    const selected = toUserId === memberId;
                    return (
                      <button
                        key={memberId}
                        type="button"
                        onClick={() => setToUserId(memberId)}
                        className={clsx(
                          "flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-2 transition-[border-color,background-color,transform] duration-200 active:scale-[0.96]",
                          selected ? "border-orange-400/[0.45] bg-orange-500/[0.14]" : "border-white/8 bg-white/[0.025]"
                        )}
                      >
                        <SmartImage
                          src={coreUtils.getUserAvatar(member.id, member.avatar)}
                          className="h-6 w-6 rounded-full"
                          fallback={member.name}
                          rounded="full"
                        />
                        <span className={clsx("max-w-[92px] truncate text-[10px] font-black", selected ? "text-orange-200" : "text-white/48")}>
                          {member.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/7 bg-white/[0.02] px-3 py-3 text-xs font-semibold text-white/38">
                  Nenhum amigo disponível para envio agora.
                </div>
              )}
            </div>

            {selectedRecipient && (
              <div className="flex items-center gap-3 rounded-[22px] border border-orange-500/[0.18] bg-orange-500/[0.07] p-3">
                <SmartImage
                  src={coreUtils.getUserAvatar(selectedRecipient.id, selectedRecipient.avatar)}
                  className="h-10 w-10 rounded-full"
                  fallback={selectedRecipient.name}
                  rounded="full"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-white/88">Orbit para {selectedRecipient.name}</p>
                  <p className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-orange-200/55">A recomendação fica independente para cada lado</p>
                </div>
                <Check className="h-4 w-4 text-orange-300" />
              </div>
            )}

            <label className="flex items-center gap-2 rounded-[22px] border border-white/8 bg-white/[0.035] px-3 py-3">
              <Search className="h-4 w-4 shrink-0 text-white/32" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder="Buscar música para enviar"
                className="min-w-0 flex-1 bg-transparent text-xs font-bold text-white outline-none placeholder:text-white/28"
              />
            </label>

            {results.slice(0, 5).map(track => {
              const trackKey = String(track.id || track.name || '');
              const selected = selectedTrackKey === trackKey;
              return (
                <button
                  key={trackKey}
                  type="button"
                  onClick={() => setSelectedTrack(track)}
                  className={clsx(
                    "flex items-center gap-3 rounded-[22px] border p-2.5 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.985]",
                    selected ? "border-orange-500/35 bg-orange-500/10" : "border-white/7 bg-white/[0.02]"
                  )}
                >
                  <SmartImage src={getTrackImage(track)} className="h-11 w-11 rounded-[16px]" fallback={track.name || 'Musica'} rounded="[16px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-white/88">{track.name}</span>
                    <span className="block truncate text-[10px] font-bold text-white/38">{getArtistListString(track)}</span>
                  </span>
                  {selected ? <Check className="h-4 w-4 text-orange-400" /> : <Music2 className="h-4 w-4 text-white/24" />}
                </button>
              );
            })}

            {selectedTrack && (
              <div className="rounded-[22px] border border-white/7 bg-black/20 px-3 py-3">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/32">Selecionada</p>
                <p className="mt-1 truncate text-sm font-black text-white/88">{selectedTrack.name}</p>
                <p className="truncate text-[10px] font-bold text-white/38">{getArtistListString(selectedTrack)}</p>
              </div>
            )}

            <textarea
              value={message}
              onChange={event => setMessage(event.target.value)}
              maxLength={120}
              placeholder="Mensagem opcional"
              className="min-h-20 rounded-[22px] border border-white/8 bg-white/[0.035] px-3 py-3 text-xs font-bold text-white outline-none placeholder:text-white/28"
            />
            <button
              type="button"
              disabled={!toUserId || !selectedTrack || sending}
              onClick={sendOrbit}
              className="flex items-center justify-center gap-2 rounded-[22px] bg-orange-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-[opacity,transform] duration-200 disabled:opacity-40 enabled:active:scale-[0.98]"
            >
              {sending ? 'Enviando...' : 'Enviar Orbit'}
              {!sending && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        ) : status === 'loading' ? (
          <div className="mt-5 flex items-center justify-center gap-3 rounded-[24px] border border-white/7 bg-white/[0.02] py-8 text-white/35">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-[0.18em]">Carregando Orbits</span>
          </div>
        ) : status === 'pending-api' ? (
          <div className="mt-5 rounded-[24px] border border-orange-500/15 bg-orange-500/[0.04] px-4 py-5 text-center text-xs font-bold leading-relaxed text-orange-200/70">
            API de Orbits indisponível agora. A aba continua montada sem fallback falso.
          </div>
        ) : items.length === 0 ? (
          <div className="mt-5 flex flex-col items-center justify-center gap-3 rounded-[24px] border border-white/7 bg-white/[0.02] px-4 py-8 text-center">
            <Inbox className="h-6 w-6 text-orange-300/62" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/68">Nenhum Orbit por aqui ainda</p>
              <p className="mt-2 text-xs font-semibold leading-relaxed text-white/38">
                {box === 'sent' ? 'Envie uma faixa para acompanhar quando ela virar play.' : 'Quando alguém mandar uma música, ela aparece aqui sem ocupar a timeline.'}
              </p>
            </div>
          </div>
        ) : (
          <motion.div className="mt-5 flex flex-col gap-2.5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
            {items.map(orbit => <OrbitCard key={orbit.id} orbit={orbit} members={members} box={box} onOpen={openOrbit} onDelete={deleteOrbit} />)}
          </motion.div>
        )}
      </div>
    </section>
  );
}
