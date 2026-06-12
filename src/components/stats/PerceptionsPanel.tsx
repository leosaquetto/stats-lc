import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Clock3, Music2, Sparkles, UserCircle } from 'lucide-react';
import { coreUtils } from '../../services/statsCore';
import { statsService } from '../../services/statsService';
import { SmartImage } from '../shared/CommonUI';
import { MONTHS_SHORT, type ReplayFilterPeriod, type ReplaySelectedSubValues } from '../home/replayUtils';
import { useAutoOrbitRotation } from '../../hooks/useAutoOrbitRotation';
import { useViewportMotionGate } from '../../hooks/useViewportMotionGate';
import { cn } from '../../lib/utils';

const latestDiscoveryCache = new Map<string, any>();
const REPLAY_MONTHS_LONG = MONTHS_SHORT.map((month, index) => (
  new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, index, 1))
));

const getReplayItemCount = (item: any) => Number(item?.playedCount || item?.playcount || item?.streams || item?.count || 0) || 0;

const getReplayItemArtist = (item: any) => {
  const direct = item?.artistName || item?.artist?.name || item?.album?.artist?.name || item?.track?.artist?.name || item?.albumArtist || item?.artist;
  if (typeof direct === 'string' && direct.trim()) return direct;
  if (Array.isArray(item?.artists) && item.artists.length > 0) {
    return item.artists.map((artist: any) => typeof artist === 'string' ? artist : artist?.name).filter(Boolean).join(', ');
  }
  if (Array.isArray(item?.track?.artists) && item.track.artists.length > 0) {
    return item.track.artists.map((artist: any) => typeof artist === 'string' ? artist : artist?.name).filter(Boolean).join(', ');
  }
  return '';
};

const getReplayItemImage = (item: any) => item?.image || item?.albumImage || item?.album?.image || item?.artist?.image || item?.track?.image || item?.track?.albumImage || '';

const getPerceptionPeriodSentence = (
  activeTab: ReplayFilterPeriod,
  selected: ReplaySelectedSubValues
) => {
  const now = new Date();
  if (activeTab === 'today') return 'hoje';
  if (activeTab === 'week') {
    return selected.weekMode === 'current' ? 'nesta semana' : 'nos últimos 7 dias';
  }
  if (activeTab === 'month') {
    const month = Number(selected.month ?? now.getMonth());
    return `em ${REPLAY_MONTHS_LONG[month] || 'mês'} de ${selected.year || now.getFullYear()}`;
  }
  if (activeTab === 'year') return `em ${selected.year || now.getFullYear()}`;
  return 'em todo o histórico';
};

export const PerceptionsPanel = ({
  tracks,
  artists,
  userId,
  activeTab,
  selectedSubValues,
  className,
}: {
  tracks: any[];
  artists: any[];
  userId: string;
  activeTab: ReplayFilterPeriod;
  selectedSubValues: ReplaySelectedSubValues;
  className?: string;
}) => {
  const shouldReduceMotion = useReducedMotion();
  const { ref: sectionRef, isInViewport: isSectionVisible } = useViewportMotionGate<HTMLElement>({ rootMargin: '180px' });
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [latestDiscovery, setLatestDiscovery] = useState<any>(
    () => latestDiscoveryCache.get(userId) || null
  );
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const topTrack = tracks[0];
  const lowRepeatTrack = tracks.find((track) => getReplayItemCount(track) <= 2) || tracks[tracks.length - 1];
  const topTrackArtist = topTrack ? getReplayItemArtist(topTrack) : '';
  const lowRepeatArtist = lowRepeatTrack ? getReplayItemArtist(lowRepeatTrack) : '';
  const discoveryTrack = latestDiscovery?.coverage?.complete
    ? latestDiscovery.item?.track || latestDiscovery.item
    : null;
  const discoveryArtist = discoveryTrack ? getReplayItemArtist(discoveryTrack) : '';
  const discoveryDate = latestDiscovery?.firstPlayedAt
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        timeZone: 'America/Sao_Paulo',
      }).format(new Date(latestDiscovery.firstPlayedAt))
    : '';
  const periodSentence = getPerceptionPeriodSentence(activeTab, selectedSubValues);
  const perceptions = [
    topTrack && {
      title: 'Ritual recente',
      text: `Você ouviu ${topTrack.name || topTrack.track?.name}${topTrackArtist ? `, de ${topTrackArtist}` : ''}, ${coreUtils.formatNumber(getReplayItemCount(topTrack))} vezes ${periodSentence}.`,
      icon: Music2,
      image: getReplayItemImage(topTrack),
    },
    artists[0] && {
      title: 'Sequência',
      text: `${artists[0].name} dominou seus charts ${periodSentence} com ${coreUtils.formatNumber(getReplayItemCount(artists[0]))} reproduções.`,
      icon: UserCircle,
      image: getReplayItemImage(artists[0]),
    },
    lowRepeatTrack && {
      title: 'Baixa repetição',
      text: `${lowRepeatTrack.name || lowRepeatTrack.track?.name}${lowRepeatArtist ? `, de ${lowRepeatArtist}` : ''}, foi uma das faixas que você menos repetiu ${periodSentence}.`,
      icon: Sparkles,
      image: getReplayItemImage(lowRepeatTrack),
    },
    discoveryTrack && discoveryDate && {
      title: 'Última descoberta',
      text: `${discoveryTrack.name || 'Uma faixa nova'}${discoveryArtist ? `, de ${discoveryArtist}` : ''}, foi a última faixa nova que você reproduziu, em ${discoveryDate}.`,
      icon: Clock3,
      image: getReplayItemImage(discoveryTrack),
    },
  ].filter(Boolean) as Array<{ title: string; text: string; icon: any; image?: string }>;

  useEffect(() => {
    setLatestDiscovery(latestDiscoveryCache.get(userId) || null);
  }, [userId]);

  useEffect(() => {
    if (!isSectionVisible || !userId || latestDiscoveryCache.has(userId)) return;
    const controller = new AbortController();
    statsService.getLatestDiscovery(userId, controller.signal)
      .then((response) => {
        latestDiscoveryCache.set(userId, response);
        setLatestDiscovery(response);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [isSectionVisible, userId]);

  useEffect(() => {
    if (activeIndex >= perceptions.length) setActiveIndex(0);
  }, [activeIndex, perceptions.length]);

  const advance = useCallback(() => {
    if (perceptions.length < 2) return;
    setDirection(1);
    setActiveIndex((index) => (index + 1) % perceptions.length);
  }, [perceptions.length]);

  const { restart: restartRotation, interactionProps } = useAutoOrbitRotation({
    enabled: isSectionVisible && !shouldReduceMotion && perceptions.length > 1,
    intervalMs: 5500,
    onAdvance: advance,
  });

  const goTo = useCallback((index: number, nextDirection?: number) => {
    if (perceptions.length === 0) return;
    setDirection(nextDirection || (index >= activeIndex ? 1 : -1));
    setActiveIndex((index + perceptions.length) % perceptions.length);
    restartRotation();
  }, [activeIndex, perceptions.length, restartRotation]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      event.stopPropagation();
    }
  }, []);

  const handleTouchEnd = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    const touch = event.changedTouches[0];
    touchStartRef.current = null;
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 38 || Math.abs(dx) < Math.abs(dy) * 1.25) return;
    goTo(activeIndex + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  }, [activeIndex, goTo]);

  if (perceptions.length === 0) return null;
  const activePerception = perceptions[activeIndex] || perceptions[0];
  const ActivePerceptionIcon = activePerception.icon;
  const satellitePositions = [
    { x: -132, y: -62, size: 54, opacity: 0.58 },
    { x: 132, y: -48, size: 50, opacity: 0.52 },
    { x: 116, y: 76, size: 46, opacity: 0.42 },
  ];

  return (
    <section ref={sectionRef} className={cn("mt-5", className)}>
      <div className="mb-3 flex items-center gap-3">
        <Sparkles className="h-5 w-5 text-orange-500" />
        <h2 className="text-[13px] font-black uppercase tracking-[0.34em] text-white/86">Perceptions</h2>
      </div>
      <div
        data-home-horizontal-scroll="true"
        className="relative mx-auto h-[210px] max-w-[430px] select-none overflow-visible [perspective:1000px]"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
        {...interactionProps}
      >
        <div className="pointer-events-none absolute left-1/2 top-[46%] h-[198px] w-[198px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.055]" />
        <motion.div
          className="pointer-events-none absolute left-1/2 top-[46%] h-[146px] w-[146px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-orange-500/14"
          animate={!shouldReduceMotion && isSectionVisible ? { rotate: -360 } : {}}
          transition={!shouldReduceMotion && isSectionVisible ? { duration: 46, repeat: Infinity, ease: 'linear' } : {}}
        />
        <div className="pointer-events-none absolute left-1/2 top-[48%] h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/[0.035] blur-2xl" />

        {perceptions.map((item, index) => {
          const relative = (index - activeIndex + perceptions.length) % perceptions.length;
          if (relative === 0 || relative > 3) return null;
          const position = satellitePositions[relative - 1] || satellitePositions[0];
          return (
            <motion.div
              key={`perception-sat-${item.title}-${index}`}
              onClick={() => goTo(index)}
              className="absolute left-1/2 top-[45%] overflow-hidden rounded-[18px] bg-black shadow-[0_16px_34px_rgba(0,0,0,0.42)]"
              initial={{ opacity: 0, scale: 0.72, x: `calc(-50% + ${position.x}px)`, y: `calc(-50% + ${position.y + 10}px)` }}
              animate={{
                opacity: position.opacity,
                scale: 1,
                x: `calc(-50% + ${position.x}px)`,
                y: `calc(-50% + ${position.y}px)`,
              }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1], delay: 0.025 * relative }}
              style={{ width: position.size, height: position.size }}
            >
              <motion.div
                className="relative h-full w-full"
                animate={!shouldReduceMotion && isSectionVisible ? {
                  y: [0, relative % 2 === 0 ? 2 : -2, 0],
                  rotate: [0, relative % 2 === 0 ? -0.45 : 0.45, 0],
                } : {}}
                transition={!shouldReduceMotion && isSectionVisible ? {
                  duration: 6.2 + relative * 0.45,
                  repeat: Infinity,
                  ease: 'easeInOut',
                } : {}}
              >
                {item.image ? <SmartImage src={item.image} className="h-full w-full object-cover" rounded="none" fallback={item.title} /> : null}
                <div className="absolute inset-0 bg-black/20" />
              </motion.div>
            </motion.div>
          );
        })}

        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.article
            key={`perception-active-${activePerception.title}`}
            custom={direction}
            className="absolute left-1/2 top-[50%] z-30 grid w-[82%] -translate-x-1/2 -translate-y-1/2 grid-cols-[78px_minmax(0,1fr)] gap-4"
            initial={{ opacity: 0, scale: 0.94, x: direction * 28 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.94, x: direction * -28 }}
            transition={{ type: 'spring', stiffness: 250, damping: 25, mass: 0.7 }}
          >
            <motion.div
              animate={!shouldReduceMotion && isSectionVisible ? { y: [0, -4, 2, 0], rotate: [0, 0.35, -0.25, 0] } : {}}
              transition={!shouldReduceMotion && isSectionVisible ? { duration: 9.5, repeat: Infinity, ease: 'easeInOut' } : {}}
              className="relative h-[78px] w-[78px] overflow-hidden rounded-[24px] bg-black shadow-[0_18px_42px_rgba(0,0,0,0.45)]"
            >
              {activePerception.image ? <SmartImage src={activePerception.image} className="h-full w-full object-cover" rounded="none" fallback={activePerception.title} /> : null}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/40" />
              <div className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-xl bg-orange-600/90 shadow-[0_10px_24px_rgba(0,0,0,0.35)]">
                <ActivePerceptionIcon className="h-3.5 w-3.5 text-white" />
              </div>
            </motion.div>
            <div className="min-w-0 self-center">
              <span className="block text-[8px] font-black uppercase tracking-[0.22em] text-orange-300">{activePerception.title}</span>
              <p className="mt-1.5 line-clamp-4 text-[12px] font-black leading-snug text-white/92">{activePerception.text}</p>
            </div>
          </motion.article>
        </AnimatePresence>

        {perceptions.length > 1 && (
          <div className="absolute bottom-0 left-0 right-0 z-40 flex justify-center gap-1.5">
            {perceptions.map((item, index) => (
              <button
                key={`perception-dot-${item.title}`}
                type="button"
                onClick={() => goTo(index)}
                className={cn(
                  "h-1.5 rounded-full transition-[width,background-color]",
                  index === activeIndex ? "w-5 bg-orange-500" : "w-1.5 bg-white/18"
                )}
                aria-label={`Abrir ${item.title}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
