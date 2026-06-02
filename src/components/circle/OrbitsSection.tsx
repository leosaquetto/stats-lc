import React from 'react';
import { motion } from 'motion/react';
import { Check, Eye, Headphones, Inbox, Loader2, Send, Search, Trash2 } from 'lucide-react';
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

const statusLabel: Record<string, string> = {
  sent: 'Enviado',
  seen: 'Visto',
  opened: 'Link aberto',
  listened: 'Ouvido',
  dismissed: 'Arquivado',
};

function OrbitCard({ orbit, members, box, onOpen, onDelete }: { orbit: Orbit; members: any[]; box: OrbitBox; onOpen: (orbit: Orbit) => void; onDelete: (orbit: Orbit) => void }) {
  const personId = box === 'sent' ? orbit.toUserId : orbit.fromUserId;
  const person = members.find(member => member.id === personId);
  const heard = orbit.listenCountSinceSent > 0 || orbit.status === 'listened';

  return (
    <article className="rounded-[24px] border border-white/8 bg-white/[0.025] p-3">
      <div className="flex items-center gap-3">
        <SmartImage src={getTrackImage(orbit.track)} className="h-12 w-12 shrink-0 rounded-2xl" fallback="" rounded="2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white/90">{orbit.track?.name || 'Musica'}</p>
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-white/35">
            {getArtistListString(orbit.track)}
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold text-white/42">
            {box === 'sent' ? 'Para' : 'De'} {person?.name || personId}
          </p>
        </div>
        <div className={clsx(
          "flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.12em]",
          heard ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-white/8 bg-white/[0.03] text-white/40"
        )}>
          {heard ? <Headphones className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {statusLabel[orbit.status] || orbit.status}
        </div>
      </div>
      {orbit.message && <p className="mt-3 rounded-2xl bg-black/20 px-3 py-2 text-xs font-medium text-white/58">{orbit.message}</p>}
      <div className="mt-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.12em] text-white/32">
        <span>{coreUtils.formatRelativeTimeSP(orbit.createdAt)}</span>
        <span>{orbit.listenCountSinceSent || 0} plays</span>
      </div>
      {box === 'received' && orbit.listenUrl && (
        <button
          type="button"
          onClick={() => onOpen(orbit)}
          className="mt-3 w-full rounded-2xl bg-orange-500 px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.18em] text-white"
        >
          Ouvir na minha plataforma
        </button>
      )}
      <button
        type="button"
        onClick={() => onDelete(orbit)}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/35"
      >
        <Trash2 className="h-3 w-3" />
        Excluir
      </button>
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

  const recipients = members.filter(member => member.id && member.id !== currentUserId);

  const sendOrbit = async () => {
    if (!currentUserId || !toUserId || !selectedTrack) return;
    setSending(true);
    try {
      await orbitService.create({ fromUserId: currentUserId, toUserId, track: selectedTrack, message: message.trim() || undefined });
      setBox('sent');
      setSelectedTrack(null);
      setQuery('');
      setMessage('');
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

  return (
    <section ref={sectionRef} className="px-4 sm:px-6 lg:px-8">
      <div className="rounded-[28px] border border-white/8 bg-white/[0.02] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[11px] font-black uppercase tracking-[0.28em] text-white/82">Orbits</h2>
            <p className="mt-1 text-xs font-medium text-white/42">Sugestoes de musicas do circulo.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Recebidos', summary.received],
              ['Enviados', summary.sent],
              ['Ouvidos', summary.sentListened],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-black/20 px-2 py-2">
                <p className="text-sm font-black text-white/90">{value}</p>
                <p className="text-[7px] font-black uppercase tracking-[0.12em] text-white/30">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-black/20 p-1">
          {[
            { id: 'received', label: 'Recebidos', icon: Inbox },
            { id: 'sent', label: 'Enviados', icon: Send },
            { id: 'all', label: 'Criar', icon: Search },
          ].map(tab => {
            const Icon = tab.icon;
            const active = (tab.id === 'all' && box === 'all') || box === tab.id;
            return (
              <button key={tab.id} type="button" onClick={() => setBox(tab.id as OrbitBox)} className={clsx("flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[9px] font-black uppercase tracking-[0.12em]", active ? "bg-orange-500/15 text-orange-400" : "text-white/35")}>
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {box === 'all' ? (
          <div className="flex flex-col gap-3">
            <select value={toUserId} onChange={event => setToUserId(event.target.value)} className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-xs font-bold text-white outline-none">
              <option value="">Escolher amigo</option>
              {recipients.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
            <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar musica" className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-xs font-bold text-white outline-none placeholder:text-white/28" />
            {results.slice(0, 4).map(track => (
              <button key={track.id || track.name} type="button" onClick={() => setSelectedTrack(track)} className={clsx("flex items-center gap-3 rounded-2xl border p-2 text-left", selectedTrack === track ? "border-orange-500/30 bg-orange-500/10" : "border-white/6 bg-white/[0.02]")}>
                <SmartImage src={getTrackImage(track)} className="h-10 w-10 rounded-xl" fallback="" rounded="xl" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-black text-white/88">{track.name}</span>
                  <span className="block truncate text-[10px] font-bold text-white/38">{getArtistListString(track)}</span>
                </span>
                {selectedTrack === track && <Check className="h-4 w-4 text-orange-400" />}
              </button>
            ))}
            <textarea value={message} onChange={event => setMessage(event.target.value)} maxLength={120} placeholder="Mensagem opcional" className="min-h-20 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3 text-xs font-bold text-white outline-none placeholder:text-white/28" />
            <button type="button" disabled={!toUserId || !selectedTrack || sending} onClick={sendOrbit} className="rounded-2xl bg-orange-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white disabled:opacity-40">
              {sending ? 'Enviando...' : 'Enviar Orbit'}
            </button>
          </div>
        ) : status === 'loading' ? (
          <div className="flex items-center justify-center py-8 text-white/35"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : status === 'pending-api' ? (
          <div className="rounded-2xl border border-orange-500/15 bg-orange-500/[0.04] px-4 py-5 text-center text-xs font-bold text-orange-200/70">API de Orbits pendente no backend.</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-5 text-center text-xs font-bold text-white/35">Nenhum Orbit por aqui ainda.</div>
        ) : (
          <motion.div className="flex flex-col gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {items.map(orbit => <OrbitCard key={orbit.id} orbit={orbit} members={members} box={box} onOpen={openOrbit} onDelete={deleteOrbit} />)}
          </motion.div>
        )}
      </div>
    </section>
  );
}
