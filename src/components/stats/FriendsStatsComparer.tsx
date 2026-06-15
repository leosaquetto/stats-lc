/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Heart, 
  Sparkles, 
  Music2, 
  Disc, 
  UserCircle,
  Flame,
  ArrowRightLeft,
  Users,
  ChevronDown,
  Activity
} from 'lucide-react';
import { clsx } from 'clsx';
import { SmartImage } from '../MusicUI';
import { UserStats } from '../../types/stats';
import { coreUtils } from '../../services/statsCore';
import { useMotionRuntime } from '../../hooks/useMotionRuntime';

interface FriendsStatsComparerProps {
  members: UserStats[];
  onArtistClick?: (artist: any) => void;
}

const percentScale = (value: number) => Math.max(0, Math.min(1, value / 100));
const statsSurfaceTransition = "transition-[background-color,border-color,box-shadow,color,opacity,transform] duration-300";
const statsControlTransition = "transition-[background-color,border-color,color,box-shadow,opacity,transform] duration-200";

export const FriendsStatsComparer = ({ members, onArtistClick }: FriendsStatsComparerProps) => {
  const motionRuntime = useMotionRuntime();
  const shouldAnimateComparer = motionRuntime.canRunMotion && motionRuntime.tier !== 'conserve';
  // Initialize friends for comparison
  const [userAId, setUserAId] = useState<string>(members[0]?.id || '');
  const [userBId, setUserBId] = useState<string>(members[1]?.id || members[0]?.id || '');

  // Tab controller: overview, artists, tracks, albums
  const [activeTab, setActiveTab] = useState<'overview' | 'artists' | 'tracks' | 'albums'>('overview');

  // Selection state
  const [selectingFor, setSelectingFor] = useState<'none' | 'A' | 'B'>('none');

  const userA = useMemo(() => members.find(m => m.id === userAId), [members, userAId]);
  const userB = useMemo(() => members.find(m => m.id === userBId), [members, userBId]);

  // Candidates for selection
  const candidatesA = useMemo(() => members.filter(m => m.id !== userBId), [members, userBId]);
  const candidatesB = useMemo(() => members.filter(m => m.id !== userAId), [members, userAId]);

  const norm = (str: string) => coreUtils.normalizeText(str || '');

  const getTrackPlaycount = (user: UserStats, trackName: string) => {
    const normName = norm(trackName);
    const found = user.topItems?.tracks?.find((t: any) => norm(t.name || t.track?.name || '') === normName) as any;
    return found ? (found.playcount || found.streams || found.count || 0) : 0;
  };

  const getArtistPlaycount = (user: UserStats, artistName: string) => {
    const normName = norm(artistName);
    const found = user.topItems?.artists?.find((a: any) => norm(a.name || '') === normName) as any;
    return found ? (found.playcount || found.streams || found.count || 0) : 0;
  };

  const getAlbumPlaycount = (user: UserStats, albumName: string) => {
    const normName = norm(albumName);
    const found = user.topItems?.albums?.find((al: any) => norm(al.name || al.albumName || '') === normName) as any;
    return found ? (found.playcount || found.streams || found.count || 0) : 0;
  };

  // Calculate comparative list intersections and unique elements
  const comparisonData = useMemo(() => {
    if (!userA || !userB) return null;

    // --- ARTISTS ---
    const artistsA = userA.topItems?.artists || [];
    const artistsB = userB.topItems?.artists || [];
    const normArtistsASet = new Set(artistsA.map(a => norm(a.name)));
    const normArtistsBSet = new Set(artistsB.map(b => norm(b.name)));

    const top5ArtistsA = new Set(artistsA.slice(0, 5).map(a => norm(a.name)));
    const top5ArtistsB = new Set(artistsB.slice(0, 5).map(b => norm(b.name)));

    const sharedArtists = artistsB.filter(b => normArtistsASet.has(norm(b.name)));
    const uniqueArtistsA = artistsA.filter(a => !normArtistsBSet.has(norm(a.name)));
    const uniqueArtistsB = artistsB.filter(b => !normArtistsASet.has(norm(b.name)));

    // Combined and sorted artists
    const sharedArtistsSorted = sharedArtists.map(artist => {
      const playsA = getArtistPlaycount(userA, artist.name);
      const playsB = getArtistPlaycount(userB, artist.name);
      return {
        ...artist,
        playsA,
        playsB,
        combinedPlays: playsA + playsB,
        inBothTop5: top5ArtistsA.has(norm(artist.name)) && top5ArtistsB.has(norm(artist.name))
      };
    }).sort((a, b) => b.combinedPlays - a.combinedPlays);

    // --- TRACKS ---
    const tracksA = userA.topItems?.tracks || [];
    const tracksB = userB.topItems?.tracks || [];
    const getTrackName = (t: any) => t.name || t.track?.name || '';

    // Helper to check if two music items match flexibly
    const itemsMatch = (itemA: any, itemB: any, type: 'track' | 'album') => {
      const getName = type === 'track' ? getTrackName : getAlbumName;
      const nameA = getName(itemA);
      const nameB = getName(itemB);
      if (!nameA || !nameB) return false;

      const nA = norm(nameA);
      const nB = norm(nameB);

      const nameMatch = nA === nB || (nA.includes(nB) && nB.length > 5) || (nB.includes(nA) && nA.length > 5);
      if (!nameMatch) return false;

      // Artist check for precision
      const getArtist = (item: any) => {
        const art = item.artists?.[0];
        if (art) return typeof art === 'string' ? art : art.name;
        return item.artistName || item.artist?.name || null;
      };

      const artA = getArtist(itemA);
      const artB = getArtist(itemB);

      if (artA && artB) {
        const naA = norm(artA);
        const naB = norm(artB);
        return naA === naB || naA.includes(naB) || naB.includes(naA);
      }
      return true;
    };

    const sharedTracks = tracksB.filter(b => tracksA.some(a => itemsMatch(a, b, 'track')));
    const uniqueTracksA = tracksA.filter(a => !tracksB.some(b => itemsMatch(a, b, 'track')));
    const uniqueTracksB = tracksB.filter(b => !tracksA.some(a => itemsMatch(a, b, 'track')));

    const normTracksASet = new Set(tracksA.map(t => norm(getTrackName(t))));
    const normTracksBSet = new Set(tracksB.map(t => norm(getTrackName(t))));

    // Combined and sorted tracks
    const sharedTracksSorted = sharedTracks.map(track => {
      const name = getTrackName(track);
      const matchingTrackA = tracksA.find(a => itemsMatch(a, track, 'track'));
      const playsA = matchingTrackA ? (matchingTrackA.playcount || matchingTrackA.streams || 0) : getTrackPlaycount(userA, name);
      const playsB = track.playcount || track.streams || 0;
      return {
        ...track,
        playsA,
        playsB,
        combinedPlays: playsA + playsB,
        inBothTop5: tracksA.slice(0, 5).some(a => itemsMatch(a, track, 'track')) && tracksB.slice(0, 5).some(b => itemsMatch(b, track, 'track'))
      };
    }).sort((a, b) => b.combinedPlays - a.combinedPlays);

    // --- ALBUMS ---
    const albumsA = userA.topItems?.albums || [];
    const albumsB = userB.topItems?.albums || [];
    const getAlbumName = (al: any) => al.name || al.albumName || '';

    const sharedAlbums = albumsB.filter(b => albumsA.some(a => itemsMatch(a, b, 'album')));
    const uniqueAlbumsA = albumsA.filter(a => !albumsB.some(b => itemsMatch(a, b, 'album')));
    const uniqueAlbumsB = albumsB.filter(b => !albumsA.some(a => itemsMatch(a, b, 'album')));

    const normAlbumsASet = new Set(albumsA.map(al => norm(getAlbumName(al))));
    const normAlbumsBSet = new Set(albumsB.map(al => norm(getAlbumName(al))));

    // Combined and sorted albums
    const sharedAlbumsSorted = sharedAlbums.map(album => {
      const name = getAlbumName(album);
      const matchingAlbumA = albumsA.find(a => itemsMatch(a, album, 'album'));
      const playsA = matchingAlbumA ? (matchingAlbumA.playcount || matchingAlbumA.streams || 0) : getAlbumPlaycount(userA, name);
      const playsB = album.playcount || album.streams || 0;
      return {
        ...album,
        playsA,
        playsB,
        combinedPlays: playsA + playsB,
        inBothTop5: albumsA.slice(0, 5).some(a => itemsMatch(a, album, 'album')) && albumsB.slice(0, 5).some(b => itemsMatch(b, album, 'album'))
      };
    }).sort((a, b) => b.combinedPlays - a.combinedPlays);

    // Score of musical affinity
    let score = 15;
    score += sharedArtists.length * 15; // +15% per artist in common
    score += sharedTracks.length * 18;  // +18% per track in common
    score += sharedAlbums.length * 12;  // +12% per album in common

    if (score > 97) score = 98;
    if (sharedArtists.length === 0 && sharedTracks.length === 0 && sharedAlbums.length === 0) {
      const streamDiff = Math.abs((userA.totalStreams || 0) - (userB.totalStreams || 0));
      score = streamDiff < 100 ? 25 : 10;
    }
    score = Math.min(100, Math.max(0, score));

    // Relations text
    let relationLabel = 'Mundos Sonoros Separados';
    let labelColor = 'text-white/40';
    if (score >= 85) {
      relationLabel = 'Gêmeos Cósmicos do Som';
      labelColor = 'text-orange-500';
    } else if (score >= 60) {
      relationLabel = 'Almas Gêmeas Musicais';
      labelColor = 'text-amber-400';
    } else if (score >= 35) {
      relationLabel = 'Sintonizados de Playlist';
      labelColor = 'text-yellow-400';
    } else if (score >= 15) {
      relationLabel = 'Exploradores Compartilhados';
      labelColor = 'text-white/70';
    }

    return {
      score,
      relationLabel,
      labelColor,
      artists: {
        allA: artistsA,
        allB: artistsB,
        shared: sharedArtists,
        sharedSorted: sharedArtistsSorted,
        uniqueA: uniqueArtistsA,
        uniqueB: uniqueArtistsB,
        setA: normArtistsASet,
        setB: normArtistsBSet,
      },
      tracks: {
        allA: tracksA,
        allB: tracksB,
        shared: sharedTracks,
        sharedSorted: sharedTracksSorted,
        uniqueA: uniqueTracksA,
        uniqueB: uniqueTracksB,
        setA: normTracksASet,
        setB: normTracksBSet,
      },
      albums: {
        allA: albumsA,
        allB: albumsB,
        shared: sharedAlbums,
        sharedSorted: sharedAlbumsSorted,
        uniqueA: uniqueAlbumsA,
        uniqueB: uniqueAlbumsB,
        setA: normAlbumsASet,
        setB: normAlbumsBSet,
      }
    };
  }, [userA, userB]);

  if (members.length < 2) {
    return (
      <div className="glass-card p-6 border-white/5 flex flex-col items-center justify-center text-center py-12">
        <Users className="h-8 w-8 text-white/30 mb-3" />
        <p className="text-xs font-bold text-white/70">Adicione mais amigos para compará-los.</p>
      </div>
    );
  }

  if (!userA || !userB || !comparisonData) return null;

  const streamsTotalA = userA.totalStreams || 0;
  const streamsTotalB = userB.totalStreams || 0;
  const totalStreamsMax = Math.max(1, streamsTotalA + streamsTotalB);
  const proportionStreamsA = (streamsTotalA / totalStreamsMax) * 100;
  const proportionStreamsB = (streamsTotalB / totalStreamsMax) * 100;

  const durationA = userA.totalDurationMs || 0;
  const durationB = userB.totalDurationMs || 0;
  const maxDuration = Math.max(1, durationA + durationB);
  const proportionDurationA = (durationA / maxDuration) * 100;
  const proportionDurationB = (durationB / maxDuration) * 100;

  const todayStreamsA = userA.streamsToday || 0;
  const todayStreamsB = userB.streamsToday || 0;
  const maxToday = Math.max(1, todayStreamsA + todayStreamsB);
  const proportionTodayA = (todayStreamsA / maxToday) * 100;
  const proportionTodayB = (todayStreamsB / maxToday) * 100;

  const monthStreamsA = userA.streamsMonth || 0;
  const monthStreamsB = userB.streamsMonth || 0;
  const maxMonth = Math.max(1, monthStreamsA + monthStreamsB);
  const proportionMonthA = (monthStreamsA / maxMonth) * 100;
  const proportionMonthB = (monthStreamsB / maxMonth) * 100;

  const [showAllSharedArtists, setShowAllSharedArtists] = useState(false);
  const [showAllSharedTracks, setShowAllSharedTracks] = useState(false);
  const [showAllSharedAlbums, setShowAllSharedAlbums] = useState(false);

  const swapUsers = () => {
    setUserAId(userBId);
    setUserBId(userAId);
  };

  const tabsInfo = [
    { id: 'overview' as const, label: 'Geral', icon: Activity },
    { id: 'artists' as const, label: 'Artistas', icon: UserCircle },
    { id: 'tracks' as const, label: 'Músicas', icon: Music2 },
    { id: 'albums' as const, label: 'Álbuns', icon: Disc },
  ];

  const getTrackName = (t: any) => t.name || t.track?.name || '';
  const getAlbumName = (al: any) => al.name || al.albumName || '';

  return (
    <div className="flex flex-col gap-5">
      {/* Selector Deck */}
      <div className="glass-card p-5 border-white/5 relative overflow-hidden flex flex-col items-center">
        <div className="absolute inset-0 bg-gradient-to-b from-orange-500/[0.02] to-transparent pointer-events-none" />

        <div className="flex items-center justify-between w-full gap-4 relative z-10">
          {/* Card Friend A */}
          <button
            type="button"
            onClick={() => setSelectingFor(selectingFor === 'A' ? 'none' : 'A')}
            className={clsx(
              "flex-1 flex flex-col items-center gap-3 p-3 rounded-[24px] border transition-[background-color,border-color,color,transform] active:scale-95 duration-200",
              selectingFor === 'A' ? "bg-orange-600/15 border-orange-500/30" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
            )}
          >
            <div className="relative h-14 w-14 rounded-full p-0.5 bg-gradient-to-tr from-orange-500 to-amber-400">
               <SmartImage
                 src={coreUtils.getUserAvatar(userA.id, userA.avatar)}
                 className="h-full w-full rounded-full border border-black animate-none"
                 fallback={userA.name}
                 rounded="full"
               />
               <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-orange-600 border border-white/10 text-[6px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full text-white whitespace-nowrap">
                 Amigo A
               </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-[11px] font-black text-white/95 truncate max-w-[95px]">{userA.name}</span>
              <span className="text-[7px] text-white/40 uppercase tracking-widest font-bold mt-0.5 flex items-center gap-1">
                Alterar <ChevronDown className="h-2 w-2" />
              </span>
            </div>
          </button>

          {/* VS Bridge */}
          <div className="flex flex-col items-center shrink-0">
            <button
              type="button"
              onClick={swapUsers}
              className="h-8 w-8 flex items-center justify-center rounded-full bg-white/5 border border-white/10 shadow-lg hover:bg-orange-600 hover:border-orange-500/20 text-white/60 hover:text-white transition-[background-color,border-color,color,transform] transform hover:rotate-180 duration-500 active:scale-90"
              title="Trocar Amigos"
            >
              <ArrowRightLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('showArenaExpl'))}
              className="text-[9px] font-black italic text-orange-500 drop-shadow-[0_0_15px_rgba(249,115,22,0.3)] mt-1.5 hover:scale-110 active:scale-95 transition-[color,opacity,transform] duration-200 cursor-pointer"
            >
              VS
            </button>
          </div>

          {/* Card Friend B */}
          <button
            type="button"
            onClick={() => setSelectingFor(selectingFor === 'B' ? 'none' : 'B')}
            className={clsx(
              "flex-1 flex flex-col items-center gap-3 p-3 rounded-[24px] border transition-[background-color,border-color,color,transform] active:scale-95 duration-200",
              selectingFor === 'B' ? "bg-orange-600/15 border-orange-500/30" : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05]"
            )}
          >
            <div className="relative h-14 w-14 rounded-full p-0.5 bg-gradient-to-tr from-amber-400 to-yellow-300">
               <SmartImage
                 src={coreUtils.getUserAvatar(userB.id, userB.avatar)}
                 className="h-full w-full rounded-full border border-black animate-none"
                 fallback={userB.name}
                 rounded="full"
               />
               <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 border border-white/10 text-[6px] font-black tracking-widest uppercase px-1.5 py-0.5 rounded-full text-white whitespace-nowrap">
                 Amigo B
               </span>
            </div>
            <div className="flex flex-col items-center text-center">
              <span className="text-[11px] font-black text-white/95 truncate max-w-[95px]">{userB.name}</span>
              <span className="text-[7px] text-white/40 uppercase tracking-widest font-bold mt-0.5 flex items-center gap-1">
                Alterar <ChevronDown className="h-2 w-2" />
              </span>
            </div>
          </button>
        </div>

        {/* Change Friend Dropdown */}
        <AnimatePresence>
          {selectingFor !== 'none' && (
            <motion.div
              initial={shouldAnimateComparer ? { opacity: 0, y: -4, scaleY: 0.98 } : { opacity: 1, y: 0, scaleY: 1 }}
              animate={{ opacity: 1, y: 0, scaleY: 1 }}
              exit={shouldAnimateComparer ? { opacity: 0, y: -4, scaleY: 0.98 } : { opacity: 1, y: 0, scaleY: 1 }}
              transition={{ duration: shouldAnimateComparer ? 0.18 : 0.01, ease: [0.16, 1, 0.3, 1] }}
              className="w-full mt-4 origin-top border-t border-white/5 pt-4 shadow-inner"
            >
              <p className="text-[9px] font-black uppercase tracking-widest text-white/40 text-center mb-3">
                Selecionar Amigo {selectingFor === 'A' ? 'A' : 'B'}
              </p>
              <div className="grid grid-cols-4 gap-2">
                {(selectingFor === 'A' ? candidatesA : candidatesB).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      if (selectingFor === 'A') {
                        setUserAId(m.id);
                      } else {
                        setUserBId(m.id);
                      }
                      setSelectingFor('none');
                    }}
                    className={clsx(
                      "flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-[background-color,border-color,color,opacity,transform] duration-200 border active:scale-[0.98]",
                      (selectingFor === 'A' ? userAId : userBId) === m.id
                        ? "bg-orange-500/10 border-orange-500/30 text-white"
                        : "bg-white/[0.01] border-transparent hover:bg-white/[0.04] text-white/50 hover:text-white"
                    )}
                  >
                    <SmartImage src={coreUtils.getUserAvatar(m.id, m.avatar)} className="h-8 w-8 border border-white/10 shrink-0" fallback={m.name} rounded="full" />
                    <span className="text-[8px] font-bold text-center truncate max-w-full leading-tight">{m.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabs Selector */}
      <div className="flex bg-white/[0.02] border border-white/5 p-1 rounded-2xl w-full gap-1 shadow-inner">
        {tabsInfo.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                "flex-1 py-2 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-wider rounded-xl transition-[background-color,color,box-shadow,transform] duration-200 text-center cursor-pointer active:scale-[0.98]",
                activeTab === tab.id
                  ? "bg-white text-black shadow-lg"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.02]"
              )}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="inline-block">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Area Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={shouldAnimateComparer ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
          animate={{ opacity: 1, y: 0 }}
          exit={shouldAnimateComparer ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
          transition={{ duration: shouldAnimateComparer ? 0.22 : 0.01, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'overview' && (() => {
            const duelCategories = [
              {
                title: 'Streams Totais',
                icon: <Users className="h-3.5 w-3.5 text-orange-500" />,
                valA: streamsTotalA,
                valB: streamsTotalB,
                formattedA: coreUtils.formatNumber(streamsTotalA),
                formattedB: coreUtils.formatNumber(streamsTotalB),
                unit: 'streams',
                diff: Math.abs(streamsTotalA - streamsTotalB),
                formattedDiff: coreUtils.formatNumber(Math.abs(streamsTotalA - streamsTotalB)),
              },
              {
                title: 'Este Mês',
                icon: <Activity className="h-3.5 w-3.5 text-amber-500" />,
                valA: monthStreamsA,
                valB: monthStreamsB,
                formattedA: coreUtils.formatNumber(monthStreamsA),
                formattedB: coreUtils.formatNumber(monthStreamsB),
                unit: 'streams',
                diff: Math.abs(monthStreamsA - monthStreamsB),
                formattedDiff: coreUtils.formatNumber(Math.abs(monthStreamsA - monthStreamsB)),
              },
              {
                title: 'Hoje',
                icon: <Flame className="h-3.5 w-3.5 text-red-500" />,
                valA: todayStreamsA,
                valB: todayStreamsB,
                formattedA: String(todayStreamsA),
                formattedB: String(todayStreamsB),
                unit: 'streams',
                diff: Math.abs(todayStreamsA - todayStreamsB),
                formattedDiff: String(Math.abs(todayStreamsA - todayStreamsB)),
              },
              {
                title: 'Tempo de Som',
                icon: <Disc className="h-3.5 w-3.5 text-blue-500" />,
                valA: durationA,
                valB: durationB,
                formattedA: coreUtils.formatDuration(durationA),
                formattedB: coreUtils.formatDuration(durationB),
                unit: '',
                diff: Math.abs(durationA - durationB),
                formattedDiff: coreUtils.formatDuration(Math.abs(durationA - durationB)),
              }
            ];

            return (
              <div className="flex flex-col gap-4">
                {/* Score card */}
                <div className="glass-card p-5 border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 h-32 w-32 bg-orange-500/5 blur-[50px] rounded-full pointer-events-none" />
                  <div className="flex flex-col items-center text-center gap-2">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-orange-500 fill-orange-500" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Grau de Sintonia</span>
                    </div>

                    <div className="relative flex items-center justify-center my-1">
                      <div className="text-4xl font-black italic text-transparent bg-clip-text bg-gradient-to-tr from-orange-500 via-amber-400 to-white drop-shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                        {comparisonData.score}%
                      </div>
                    </div>

                    <div className={clsx("text-xs font-black uppercase tracking-wider", comparisonData.labelColor)}>
                      {comparisonData.relationLabel}
                    </div>

                    <p className="text-[10px] text-white/50 max-w-xs mt-1 leading-relaxed">
                      {comparisonData.score >= 70 ?
                        "Seu gosto musical bate de forma fenomenal! Vocês ouvem frequentemente os mesmos caminhos sonoros." :
                        comparisonData.score >= 35 ?
                        "Sintonia maravilhosa! Vocês compartilham alguns grandes destaques e artistas queridos das mesmas frequências." :
                        "Exploradores independentes! Vocês têm universos sonoros amplos e diferentes. O melhor de dois mundos."}
                    </p>
                  </div>
                </div>

                {/* Duelo de Estatísticas direct comparison */}
                <div className="flex flex-col gap-3">
                   <div className="flex items-center gap-2 px-1">
                      <Sparkles className="h-3 w-3 text-orange-500" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Destaques do Confronto</span>
                   </div>

                   <div className="grid grid-cols-1 gap-3">
                     {duelCategories.map((category) => {
                       const isWinnerA = category.valA > category.valB;
                       const isWinnerB = category.valB > category.valA;
                       const isTie = category.valA === category.valB;

                       return (
                         <div
                           key={category.title}
                           className={clsx(
                             "glass-card p-4 border relative overflow-hidden flex flex-col gap-3",
                             statsSurfaceTransition,
                             isWinnerA ? "border-orange-500/10 bg-gradient-to-br from-orange-500/[0.02] to-transparent hover:border-orange-500/20" :
                             isWinnerB ? "border-amber-500/10 bg-gradient-to-br from-amber-500/[0.02] to-transparent hover:border-amber-500/20" :
                             "border-white/5 hover:bg-white/[0.03]"
                           )}
                         >
                           {/* Header */}
                           <div className="flex items-center justify-between">
                             <div className="flex items-center gap-1.5">
                               {category.icon}
                               <span className="text-[10px] font-black uppercase tracking-wider text-white/60">
                                 {category.title}
                               </span>
                             </div>

                             {/* Winner Crown Badge */}
                             {!isTie && (
                               <span className={clsx(
                                 "text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shrink-0",
                                 isWinnerA ? "bg-orange-600/10 border-orange-500/20 text-orange-400" : "bg-amber-600/10 border-amber-500/20 text-amber-400"
                               )}>
                                 DOMINA
                               </span>
                             )}
                             {isTie && (
                               <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border bg-white/5 border-white/10 text-white/40 shrink-0">
                                 EMPATE
                               </span>
                             )}
                           </div>

                           {/* Side-by-Side Values */}
                           <div className="grid grid-cols-2 gap-1 relative z-10">
                             {/* User A Column */}
                             <div className="flex flex-col pr-2 border-r border-white/5">
                               <div className="flex items-center gap-1.5 min-w-0 mb-1">
                                 <SmartImage src={coreUtils.getUserAvatar(userA.id, userA.avatar)} className="h-4 w-4 rounded-full border border-black/20" fallback={userA.name} rounded="full" />
                                 <span className="text-[9px] font-bold text-white/50 truncate">
                                   {userA.name}
                                 </span>
                               </div>
                               <span className={clsx(
                                 "text-[14px] font-black font-mono tracking-tight",
                                 isWinnerA ? "text-orange-400 font-black drop-shadow-[0_0_8px_rgba(249,115,22,0.15)]" : "text-white/60"
                               )}>
                                 {category.formattedA}
                               </span>
                             </div>

                             {/* User B Column */}
                             <div className="flex flex-col pl-2">
                               <div className="flex items-center gap-1.5 min-w-0 mb-1">
                                 <SmartImage src={coreUtils.getUserAvatar(userB.id, userB.avatar)} className="h-4 w-4 rounded-full border border-black/20" fallback={userB.name} rounded="full" />
                                 <span className="text-[9px] font-bold text-white/50 truncate">
                                   {userB.name}
                                 </span>
                               </div>
                               <span className={clsx(
                                 "text-[14px] font-black font-mono tracking-tight text-right",
                                 isWinnerB ? "text-amber-400 font-black drop-shadow-[0_0_8px_rgba(251,191,36,0.15)]" : "text-white/60"
                               )}>
                                 {category.formattedB}
                               </span>
                             </div>
                           </div>

                           {/* Comparative Insight Footer */}
                           <div className="mt-1 border-t border-white/5 pt-2 flex items-center gap-1">
                             <span className="text-[8.5px] text-white/40 font-medium">
                               {isWinnerA && (
                                 <>
                                   👑 <strong className="text-orange-400 font-bold">{userA.name}</strong> está na frente por <strong className="text-white/80 font-mono font-bold">{category.formattedDiff}</strong> {category.unit}
                                 </>
                               )}
                               {isWinnerB && (
                                 <>
                                   👑 <strong className="text-amber-400 font-bold">{userB.name}</strong> está na frente por <strong className="text-white/80 font-mono font-bold">{category.formattedDiff}</strong> {category.unit}
                                 </>
                               )}
                               {isTie && (
                                 <>
                                   🤝 Empate completo de sintonia!
                                 </>
                               )}
                             </span>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                </div>

              {/* Comparative Metrics Panels */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <ArrowRightLeft className="h-3 w-3 text-orange-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Métricas de Consumo</span>
                </div>

                <div className="glass-card p-5 border-white/5 flex flex-col gap-6">
                  {/* total streams */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[10px] uppercase font-black text-white/50 tracking-wide">
                      <span className={clsx(streamsTotalA > streamsTotalB ? "text-orange-400 font-extrabold" : "text-white/60")}>
                        {coreUtils.formatNumber(streamsTotalA)}
                      </span>
                      <span className="not-italic text-white/30 text-[9px] tracking-[0.15em]">Streams Totais</span>
                      <span className={clsx(streamsTotalB > streamsTotalA ? "text-amber-400 font-extrabold" : "text-white/60")}>
                        {coreUtils.formatNumber(streamsTotalB)}
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="absolute inset-y-0 left-0 w-full origin-left rounded-l-full bg-gradient-to-r from-orange-600 to-orange-400 transition-transform duration-500 ease-out"
                        style={{ transform: `scaleX(${percentScale(proportionStreamsA)})` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 w-full origin-right rounded-r-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-transform duration-500 ease-out"
                        style={{ transform: `scaleX(${percentScale(proportionStreamsB)})` }}
                      />
                    </div>
                  </div>

                  {/* listening duration */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[10px] uppercase font-black text-white/50 tracking-wide">
                      <span className={clsx(durationA > durationB ? "text-orange-400 font-extrabold" : "text-white/60")}>
                        {coreUtils.formatDuration(durationA)}
                      </span>
                      <span className="not-italic text-white/30 text-[9px] tracking-[0.15em]">Tempo de Som</span>
                      <span className={clsx(durationB > durationA ? "text-amber-400 font-extrabold" : "text-white/60")}>
                        {coreUtils.formatDuration(durationB)}
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="absolute inset-y-0 left-0 w-full origin-left rounded-l-full bg-gradient-to-r from-orange-600 to-orange-400 transition-transform duration-500 ease-out"
                        style={{ transform: `scaleX(${percentScale(proportionDurationA)})` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 w-full origin-right rounded-r-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-transform duration-500 ease-out"
                        style={{ transform: `scaleX(${percentScale(proportionDurationB)})` }}
                      />
                    </div>
                  </div>

                  {/* today streams */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[10px] uppercase font-black text-white/50 tracking-wide">
                      <span className={clsx(todayStreamsA > todayStreamsB ? "text-orange-400 font-extrabold" : "text-white/60")}>
                        {todayStreamsA}
                      </span>
                      <span className="not-italic text-white/30 text-[9px] tracking-[0.15em]">Streams Hoje</span>
                      <span className={clsx(todayStreamsB > todayStreamsA ? "text-amber-400 font-extrabold" : "text-white/60")}>
                        {todayStreamsB}
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="absolute inset-y-0 left-0 w-full origin-left rounded-l-full bg-gradient-to-r from-orange-600 to-orange-400 transition-transform duration-500 ease-out"
                        style={{ transform: `scaleX(${percentScale(proportionTodayA)})` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 w-full origin-right rounded-r-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-transform duration-500 ease-out"
                        style={{ transform: `scaleX(${percentScale(proportionTodayB)})` }}
                      />
                    </div>
                  </div>

                  {/* month streams */}
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between text-[10px] uppercase font-black text-white/50 tracking-wide">
                      <span className={clsx(monthStreamsA > monthStreamsB ? "text-orange-400 font-extrabold" : "text-white/60")}>
                        {coreUtils.formatNumber(monthStreamsA)}
                      </span>
                      <span className="not-italic text-white/30 text-[9px] tracking-[0.15em]">Streams Mensais</span>
                      <span className={clsx(monthStreamsB > monthStreamsA ? "text-amber-400 font-extrabold" : "text-white/60")}>
                        {coreUtils.formatNumber(monthStreamsB)}
                      </span>
                    </div>
                    <div className="relative h-2 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="absolute inset-y-0 left-0 w-full origin-left rounded-l-full bg-gradient-to-r from-orange-600 to-orange-400 transition-transform duration-500 ease-out"
                        style={{ transform: `scaleX(${percentScale(proportionMonthA)})` }}
                      />
                      <div
                        className="absolute inset-y-0 right-0 w-full origin-right rounded-r-full bg-gradient-to-r from-amber-400 to-yellow-300 transition-transform duration-500 ease-out"
                        style={{ transform: `scaleX(${percentScale(proportionMonthB)})` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Affinity Highlights */}
              <div className="flex flex-col gap-3 px-1">
                <div className="flex items-center gap-2 px-1">
                  <Sparkles className="h-3 w-3 text-orange-500" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Artistas em Comum</span>
                </div>

                <div className="glass-card p-4 border-white/5 flex flex-col gap-3">
                  {comparisonData.artists.sharedSorted.length > 0 ? (
                    <div className="flex flex-col gap-2.5">
                      {comparisonData.artists.sharedSorted.slice(0, 5).map((artist, i) => (
                        <div key={i} className={clsx("flex flex-col gap-1.5 p-2 rounded-2xl bg-white/[0.01] border border-white/5 group hover:bg-white/[0.03] cursor-pointer", statsControlTransition)} onClick={() => onArtistClick?.(artist)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5 min-w-0">
                               <div className="relative shrink-0">
                                 <SmartImage src={artist.image || '/placeholder-artist.jpg'} className="h-8 w-8 border border-white/10" fallback="" rounded="full" />
                                 {artist.inBothTop5 && (
                                   <div className="absolute -top-1 -right-1 bg-orange-600 rounded-full p-0.5 shadow-lg border border-white/10">
                                     <Flame className="h-2 w-2 text-white" />
                                   </div>
                                 )}
                               </div>
                               <div className="flex flex-col min-w-0">
                                 <span className="text-[10.5px] font-black text-white/95 truncate">{artist.name}</span>
                                 <span className={clsx(
                                   "text-[7px] font-black uppercase tracking-[0.15em] flex items-center gap-1",
                                   artist.inBothTop5 ? "text-orange-400" : "text-white/30"
                                 )}>
                                   {artist.inBothTop5 ? <><Sparkles className="h-2 w-2" /> Top 5 Ambos</> : 'Interseção'}
                                 </span>
                               </div>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[9px] font-black text-orange-400">{coreUtils.formatNumber(artist.combinedPlays)}</span>
                              <span className="text-[7px] text-white/30 uppercase tracking-tighter">Streams Totais</span>
                            </div>
                          </div>

                          {/* Comparison Bar */}
                          <div className="relative h-1 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="absolute inset-y-0 left-0 w-full origin-left bg-orange-500 transition-transform duration-700 ease-out"
                              style={{ transform: `scaleX(${artist.playsA / (artist.combinedPlays || 1)})` }}
                            />
                            <div
                              className="absolute inset-y-0 right-0 w-full origin-right bg-amber-400 transition-transform duration-700 ease-out"
                              style={{ transform: `scaleX(${artist.playsB / (artist.combinedPlays || 1)})` }}
                            />
                          </div>
                        </div>
                      ))}

                      {comparisonData.artists.sharedSorted.length > 5 && (
                        <button
                          onClick={() => setActiveTab('artists')}
                          className={clsx("flex items-center justify-center gap-2 py-2 mt-1 rounded-xl bg-orange-500/5 hover:bg-orange-500/10 border border-orange-500/10 group", statsControlTransition)}
                        >
                          <span className="text-[8px] font-black uppercase tracking-[0.2em] text-orange-500/80 group-hover:text-orange-500">
                             Ver todos os {comparisonData.artists.shared.length} em comum
                          </span>
                          <Sparkles className="h-2.5 w-2.5 text-orange-500/40 group-hover:text-orange-500" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-[9px] text-white/30 italic text-center py-2">Nenhuma afinidade direta mapeada no topo hoje.</p>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {/* ARTISTS TAB */}
          {activeTab === 'artists' && (
            <div className="flex flex-col gap-5">
              {/* Lado a Lado Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Column A */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-white/5">
                    <SmartImage src={coreUtils.getUserAvatar(userA.id, userA.avatar)} className="h-5 w-5 shrink-0" fallback={userA.name} rounded="full" />
                    <span className="text-[9px] font-black uppercase text-orange-500 tracking-wider truncate">Destaques A</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {comparisonData.artists.allA.slice(0, 5).map((item, idx) => {
                      const isShared = comparisonData.artists.setB.has(norm(item.name));
                      return (
                        <div key={`allA-${idx}`}
                          onClick={() => onArtistClick?.(item)}
                          className={clsx(
                          "flex items-center gap-2 border p-2.5 rounded-2xl relative overflow-hidden cursor-pointer group",
                          statsSurfaceTransition,
                          isShared
                            ? "bg-orange-500/10 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.06)]"
                            : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] border-l-2 border-l-orange-500/30"
                        )}>
                          {!isShared && (
                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[6px] font-black uppercase tracking-tighter text-orange-500 px-1 bg-white/5 rounded-full">Exclusivo</span>
                            </div>
                          )}
                          <div className="text-[9px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                          <SmartImage src={item.image || '/placeholder-artist.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-black text-white truncate leading-tight">{item.name}</span>
                            {isShared && (
                              <span className="text-[7px] text-orange-400 font-black uppercase mt-0.5 tracking-wider flex items-center gap-1">
                                <Sparkles className="h-2 w-2 shrink-0" /> Ambos Ouvem
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {comparisonData.artists.allA.length === 0 && (
                      <span className="text-[10px] text-white/30 italic text-center py-4">Sem dados no Top</span>
                    )}
                  </div>
                </div>

                {/* Column B */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-white/5">
                    <SmartImage src={coreUtils.getUserAvatar(userB.id, userB.avatar)} className="h-5 w-5 shrink-0" fallback={userB.name} rounded="full" />
                    <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider truncate">Destaques B</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {comparisonData.artists.allB.slice(0, 5).map((item, idx) => {
                      const isShared = comparisonData.artists.setA.has(norm(item.name));
                      return (
                        <div key={`allB-${idx}`}
                          onClick={() => onArtistClick?.(item)}
                          className={clsx(
                          "flex items-center gap-2 border p-2.5 rounded-2xl relative overflow-hidden cursor-pointer group",
                          statsSurfaceTransition,
                          isShared
                            ? "bg-orange-500/10 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.06)]"
                            : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] border-l-2 border-l-amber-500/30"
                        )}>
                          {!isShared && (
                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[6px] font-black uppercase tracking-tighter text-amber-500 px-1 bg-white/5 rounded-full">Exclusivo</span>
                            </div>
                          )}
                          <div className="text-[9px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                          <SmartImage src={item.image || '/placeholder-artist.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-black text-white truncate leading-tight">{item.name}</span>
                            {isShared && (
                              <span className="text-[7px] text-orange-400 font-black uppercase mt-0.5 tracking-wider flex items-center gap-1">
                                <Sparkles className="h-2 w-2 shrink-0" /> Ambos Ouvem
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {comparisonData.artists.allB.length === 0 && (
                      <span className="text-[10px] text-white/30 italic text-center py-4">Sem dados no Top</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Interseção (Em Comum) */}
              <div className="glass-card p-5 border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-white font-display">Artistas em Comum ({comparisonData.artists.shared.length})</span>
                  </div>
                  {comparisonData.artists.shared.length > 5 && (
                    <button
                      onClick={() => setShowAllSharedArtists(!showAllSharedArtists)}
                      className="text-[8px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors"
                    >
                      {showAllSharedArtists ? 'Ver Menos' : 'Ver Tudo'}
                    </button>
                  )}
                </div>
                {comparisonData.artists.sharedSorted.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {(showAllSharedArtists ? comparisonData.artists.sharedSorted : comparisonData.artists.sharedSorted.slice(0, 5)).map((artist, idx) => (
                      <motion.div
                        key={`sharedArtist-${idx}`}
                        initial={shouldAnimateComparer ? { opacity: 0, y: 10 } : false}
                        animate={{ opacity: 1, y: 0 }}
                        transition={shouldAnimateComparer ? { delay: Math.min(idx * 0.025, 0.16), duration: 0.24, ease: [0.16, 1, 0.3, 1] } : { duration: 0.01 }}
                        onClick={() => onArtistClick?.(artist)}
                        className={clsx(
                          "flex flex-col gap-2 border p-3 rounded-2xl hover:bg-white/[0.04] relative overflow-hidden cursor-pointer",
                          statsSurfaceTransition,
                          artist.inBothTop5 ? "bg-orange-500/[0.04] border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.05)]" : "bg-white/[0.02] border-white/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-[10px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                          <SmartImage src={artist.image || '/placeholder-artist.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                          <div className="flex flex-col flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-bold text-white/95 truncate">{artist.name}</span>
                              {artist.inBothTop5 && <span className="text-[7px] font-black uppercase tracking-widest bg-orange-600 text-white px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 shadow-lg shadow-orange-600/20"><Flame className="h-2 w-2" /> Top 5 Ambos</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider px-1">
                          <span className="text-orange-400 flex flex-col items-start gap-0.5">
                            <span className="text-[7px] text-orange-500/70 truncate max-w-[60px]">{userA.name}</span>
                            {coreUtils.formatNumber(artist.playsA)} plays
                          </span>
                          <div className="flex flex-col items-center gap-0">
                            <span className="text-[7px] text-white/30">vs</span>
                            <span className="text-[8px] text-white/70">{coreUtils.formatNumber(artist.combinedPlays)} total</span>
                          </div>
                          <span className="text-amber-400 flex flex-col items-end gap-0.5">
                            <span className="text-[7px] text-amber-500/70 truncate max-w-[60px]">{userB.name}</span>
                            {coreUtils.formatNumber(artist.playsB)} plays
                          </span>
                        </div>
                        <div className="relative mx-1 mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="absolute inset-y-0 left-0 w-full origin-left rounded-l-full bg-orange-500"
                            style={{ transform: `scaleX(${artist.playsA / (artist.combinedPlays || 1)})` }}
                          />
                          <div
                            className="absolute inset-y-0 right-0 w-full origin-right rounded-r-full bg-amber-400"
                            style={{ transform: `scaleX(${artist.playsB / (artist.combinedPlays || 1)})` }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px] text-white/40 italic pl-1">Eles não compartilham nenhum artista em destaque.</span>
                )}
              </div>

              {/* Diferenças (Exclusivos) */}
              <div className="glass-card p-5 border-white/5 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-white font-display">Divergências de Gosto (Exclusivos)</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Unique Artist A */}
                  <div className="flex flex-col gap-2 bg-white/[0.01] p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider mb-1 truncate">Apenas {userA.name}</span>
                    <div className="flex flex-col gap-1.5">
                      {comparisonData.artists.uniqueA.slice(0, 5).map((artist, i) => (
                        <div key={`uniqueA-${i}`}
                          onClick={() => onArtistClick?.(artist)}
                          className="flex items-center justify-between gap-2 cursor-pointer group">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-1 w-1 bg-orange-500 rounded-full shrink-0" />
                            <span className="text-[10px] font-extrabold text-white/70 truncate group-hover:text-white transition-colors">{artist.name}</span>
                          </div>
                          <span className="text-[8px] font-bold text-orange-500/70 shrink-0">{coreUtils.formatNumber(artist.playcount || (artist as any).plays || 0)}</span>
                        </div>
                      ))}
                      {comparisonData.artists.uniqueA.length === 0 && (
                        <span className="text-[9px] text-white/30 italic">Sem diferenças</span>
                      )}
                    </div>
                  </div>

                  {/* Unique Artist B */}
                  <div className="flex flex-col gap-2 bg-white/[0.01] p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider mb-1 truncate">Apenas {userB.name}</span>
                    <div className="flex flex-col gap-1.5">
                      {comparisonData.artists.uniqueB.slice(0, 5).map((artist, i) => (
                        <div key={`uniqueB-${i}`}
                          onClick={() => onArtistClick?.(artist)}
                          className="flex items-center justify-between gap-2 cursor-pointer group">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-1 w-1 bg-amber-500 rounded-full shrink-0" />
                            <span className="text-[10px] font-extrabold text-white/70 truncate group-hover:text-white transition-colors">{artist.name}</span>
                          </div>
                          <span className="text-[8px] font-bold text-amber-500/70 shrink-0">{coreUtils.formatNumber(artist.playcount || (artist as any).plays || 0)}</span>
                        </div>
                      ))}
                      {comparisonData.artists.uniqueB.length === 0 && (
                        <span className="text-[9px] text-white/30 italic">Sem diferenças</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TRACKS TAB */}
          {activeTab === 'tracks' && (
            <div className="flex flex-col gap-5">
              {/* Lado a Lado Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Column A */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-white/5">
                    <SmartImage src={coreUtils.getUserAvatar(userA.id, userA.avatar)} className="h-5 w-5 shrink-0" fallback={userA.name} rounded="full" />
                    <span className="text-[9px] font-black uppercase text-orange-500 tracking-wider truncate">Músicas de A</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {comparisonData.tracks.allA.slice(0, 5).map((item, idx) => {
                      const name = getTrackName(item);
                      const isShared = comparisonData.tracks.setB.has(norm(name));
                      return (
                        <div key={idx} className={clsx(
                          "flex items-center gap-2 border p-2.5 rounded-2xl relative overflow-hidden group",
                          statsSurfaceTransition,
                          isShared
                            ? "bg-orange-500/10 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.06)]"
                            : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] border-l-2 border-l-orange-500/30"
                        )}>
                          {!isShared && (
                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[6px] font-black uppercase tracking-tighter text-orange-500 px-1 bg-white/5 rounded-full">Exclusivo</span>
                            </div>
                          )}
                          <div className="text-[9px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                          <SmartImage src={item.image || '/placeholder-music.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-black text-white truncate leading-tight">{name}</span>
                            <span className="text-[8px] text-white/40 truncate leading-none mt-0.5">{item.artists?.[0]?.name || 'Artista'}</span>
                            {isShared && (
                              <span className="text-[7px] text-orange-400 font-black uppercase mt-0.5 tracking-wider flex items-center gap-1 font-sans">
                                <Sparkles className="h-2 w-2 shrink-0" /> Ambas Ouvem
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {comparisonData.tracks.allA.length === 0 && (
                      <span className="text-[10px] text-white/30 italic text-center py-4">Sem dados no Top</span>
                    )}
                  </div>
                </div>

                {/* Column B */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-white/5">
                    <SmartImage src={coreUtils.getUserAvatar(userB.id, userB.avatar)} className="h-5 w-5 shrink-0" fallback={userB.name} rounded="full" />
                    <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider truncate">Músicas de B</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {comparisonData.tracks.allB.slice(0, 5).map((item, idx) => {
                      const name = getTrackName(item);
                      const isShared = comparisonData.tracks.setA.has(norm(name));
                      return (
                        <div key={idx} className={clsx(
                          "flex items-center gap-2 border p-2.5 rounded-2xl relative overflow-hidden group",
                          statsSurfaceTransition,
                          isShared
                            ? "bg-orange-500/10 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.06)]"
                            : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] border-l-2 border-l-amber-500/30"
                        )}>
                          {!isShared && (
                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[6px] font-black uppercase tracking-tighter text-amber-500 px-1 bg-white/5 rounded-full">Exclusivo</span>
                            </div>
                          )}
                          <div className="text-[9px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                          <SmartImage src={item.image || '/placeholder-music.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-black text-white truncate leading-tight">{name}</span>
                            <span className="text-[8px] text-white/40 truncate leading-none mt-0.5">{item.artists?.[0]?.name || 'Artista'}</span>
                            {isShared && (
                              <span className="text-[7px] text-orange-400 font-black uppercase mt-0.5 tracking-wider flex items-center gap-1 font-sans">
                                <Sparkles className="h-2 w-2 shrink-0" /> Ambas Ouvem
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {comparisonData.tracks.allB.length === 0 && (
                      <span className="text-[10px] text-white/30 italic text-center py-4">Sem dados no Top</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Interseção (Em Comum) */}
              <div className="glass-card p-5 border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-white font-display">Músicas em Comum ({comparisonData.tracks.shared.length})</span>
                  </div>
                  {comparisonData.tracks.shared.length > 5 && (
                    <button
                      onClick={() => setShowAllSharedTracks(!showAllSharedTracks)}
                      className="text-[8px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors"
                    >
                      {showAllSharedTracks ? 'Ver Menos' : 'Ver Tudo'}
                    </button>
                  )}
                </div>
                {comparisonData.tracks.sharedSorted.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {(showAllSharedTracks ? comparisonData.tracks.sharedSorted : comparisonData.tracks.sharedSorted.slice(0, 5)).map((track, idx) => {
                      const name = getTrackName(track);
                      return (
                        <motion.div
                          key={`sharedTrack-${idx}`}
                          initial={shouldAnimateComparer ? { opacity: 0, y: 10 } : false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={shouldAnimateComparer ? { delay: Math.min(idx * 0.025, 0.16), duration: 0.24, ease: [0.16, 1, 0.3, 1] } : { duration: 0.01 }}
                          className={clsx(
                            "flex flex-col gap-2 border p-3 rounded-2xl hover:bg-white/[0.04] relative overflow-hidden",
                            statsSurfaceTransition,
                            track.inBothTop5 ? "bg-orange-500/[0.04] border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.05)]" : "bg-white/[0.02] border-white/5"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-[10px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                            <SmartImage src={track.image || '/placeholder-music.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                            <div className="flex flex-col min-w-0 pr-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white/95 truncate leading-tight">{name}</span>
                                {track.inBothTop5 && <span className="text-[7px] font-black uppercase tracking-widest bg-orange-600 text-white px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 shadow-lg shadow-orange-600/20"><Flame className="h-2 w-2" /> Top 5 Ambos</span>}
                              </div>
                              <span className="text-[8px] text-white/40 uppercase tracking-wider mt-0.5">{track.artists?.[0]?.name || 'Cantor'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider px-1">
                            <span className="text-orange-400 flex flex-col items-start gap-0.5">
                              <span className="text-[7px] text-orange-500/70 truncate max-w-[60px]">{userA.name}</span>
                              {coreUtils.formatNumber(track.playsA)} plays
                            </span>
                            <div className="flex flex-col items-center gap-0">
                              <span className="text-[7px] text-white/30">vs</span>
                              <span className="text-[8px] text-white/70">{coreUtils.formatNumber(track.combinedPlays)} total</span>
                            </div>
                            <span className="text-amber-400 flex flex-col items-end gap-0.5">
                              <span className="text-[7px] text-amber-500/70 truncate max-w-[60px]">{userB.name}</span>
                              {coreUtils.formatNumber(track.playsB)} plays
                            </span>
                          </div>
                          <div className="relative mx-1 mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="absolute inset-y-0 left-0 w-full origin-left rounded-l-full bg-orange-500"
                              style={{ transform: `scaleX(${track.playsA / (track.combinedPlays || 1)})` }}
                            />
                            <div
                              className="absolute inset-y-0 right-0 w-full origin-right rounded-r-full bg-amber-400"
                              style={{ transform: `scaleX(${track.playsB / (track.combinedPlays || 1)})` }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[10px] text-white/40 italic pl-1">Nenhuma música coincidente no Top.</span>
                )}
              </div>

              {/* Diferenças de Músicas */}
              <div className="glass-card p-5 border-white/5 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-white font-display">Músicas Divergentes</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Unique Track A */}
                  <div className="flex flex-col gap-2 bg-white/[0.01] p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider mb-1 truncate">Apenas {userA.name}</span>
                    <div className="flex flex-col gap-1.5">
                      {comparisonData.tracks.uniqueA.slice(0, 5).map((track, i) => (
                        <div key={`uniqueA-track-${i}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-1 w-1 bg-orange-500 rounded-full shrink-0" />
                            <span className="text-[10px] font-semibold text-white/70 truncate">{getTrackName(track)}</span>
                          </div>
                          <span className="text-[8px] font-bold text-orange-500/70 shrink-0">{coreUtils.formatNumber(track.playcount || (track as any).plays || 0)}</span>
                        </div>
                      ))}
                      {comparisonData.tracks.uniqueA.length === 0 && (
                        <span className="text-[9px] text-white/30 italic">Sem diferenças</span>
                      )}
                    </div>
                  </div>

                  {/* Unique Track B */}
                  <div className="flex flex-col gap-2 bg-white/[0.01] p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider mb-1 truncate">Apenas {userB.name}</span>
                    <div className="flex flex-col gap-1.5">
                      {comparisonData.tracks.uniqueB.slice(0, 5).map((track, i) => (
                        <div key={`uniqueB-track-${i}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-1 w-1 bg-amber-500 rounded-full shrink-0" />
                            <span className="text-[10px] font-semibold text-white/70 truncate">{getTrackName(track)}</span>
                          </div>
                          <span className="text-[8px] font-bold text-amber-500/70 shrink-0">{coreUtils.formatNumber(track.playcount || (track as any).plays || 0)}</span>
                        </div>
                      ))}
                      {comparisonData.tracks.uniqueB.length === 0 && (
                        <span className="text-[9px] text-white/30 italic">Sem diferenças</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ALBUMS TAB */}
          {activeTab === 'albums' && (
            <div className="flex flex-col gap-5">
              {/* Lado a Lado Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Column A */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-white/5">
                    <SmartImage src={coreUtils.getUserAvatar(userA.id, userA.avatar)} className="h-5 w-5 shrink-0" fallback={userA.name} rounded="full" />
                    <span className="text-[9px] font-black uppercase text-orange-500 tracking-wider truncate">Álbuns de A</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {comparisonData.albums.allA.slice(0, 5).map((item, idx) => {
                      const name = getAlbumName(item);
                      const isShared = comparisonData.albums.setB.has(norm(name));
                      return (
                        <div key={idx} className={clsx(
                          "flex items-center gap-2 border p-2.5 rounded-2xl relative overflow-hidden group",
                          statsSurfaceTransition,
                          isShared
                            ? "bg-orange-500/10 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.06)]"
                            : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] border-l-2 border-l-orange-500/30"
                        )}>
                          {!isShared && (
                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[6px] font-black uppercase tracking-tighter text-orange-500 px-1 bg-white/5 rounded-full">Exclusivo</span>
                            </div>
                          )}
                          <div className="text-[9px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                          <SmartImage src={item.image || '/placeholder-music.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-black text-white truncate leading-tight">{name}</span>
                            <span className="text-[8px] text-white/40 truncate leading-none mt-0.5">{item.artists?.[0]?.name || 'Artista'}</span>
                            {isShared && (
                              <span className="text-[7px] text-orange-400 font-black uppercase mt-0.5 tracking-wider flex items-center gap-1 font-sans">
                                <Sparkles className="h-2 w-2 shrink-0" /> Ambos Ouvem
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {comparisonData.albums.allA.length === 0 && (
                      <span className="text-[10px] text-white/30 italic text-center py-4">Sem dados no Top</span>
                    )}
                  </div>
                </div>

                {/* Column B */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-1.5 px-1 pb-1 border-b border-white/5">
                    <SmartImage src={coreUtils.getUserAvatar(userB.id, userB.avatar)} className="h-5 w-5 shrink-0" fallback={userB.name} rounded="full" />
                    <span className="text-[9px] font-black uppercase text-amber-500 tracking-wider truncate">Álbuns de B</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {comparisonData.albums.allB.slice(0, 5).map((item, idx) => {
                      const name = getAlbumName(item);
                      const isShared = comparisonData.albums.setA.has(norm(name));
                      return (
                        <div key={idx} className={clsx(
                          "flex items-center gap-2 border p-2.5 rounded-2xl relative overflow-hidden group",
                          statsSurfaceTransition,
                          isShared
                            ? "bg-orange-500/10 border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.06)]"
                            : "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] border-l-2 border-l-amber-500/30"
                        )}>
                          {!isShared && (
                            <div className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                               <span className="text-[6px] font-black uppercase tracking-tighter text-amber-500 px-1 bg-white/5 rounded-full">Exclusivo</span>
                            </div>
                          )}
                          <div className="text-[9px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                          <SmartImage src={item.image || '/placeholder-music.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-black text-white truncate leading-tight">{name}</span>
                            <span className="text-[8px] text-white/40 truncate leading-none mt-0.5">{item.artists?.[0]?.name || 'Artista'}</span>
                            {isShared && (
                              <span className="text-[7px] text-orange-400 font-black uppercase mt-0.5 tracking-wider flex items-center gap-1 font-sans">
                                <Sparkles className="h-2 w-2 shrink-0" /> Ambos Ouvem
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {comparisonData.albums.allB.length === 0 && (
                      <span className="text-[10px] text-white/30 italic text-center py-4">Sem dados no Top</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Interseção (Em Comum) */}
              <div className="glass-card p-5 border-white/5 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-orange-500" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-white font-display">Álbuns em Comum ({comparisonData.albums.shared.length})</span>
                  </div>
                  {comparisonData.albums.shared.length > 5 && (
                    <button
                      onClick={() => setShowAllSharedAlbums(!showAllSharedAlbums)}
                      className="text-[8px] font-black uppercase tracking-widest text-orange-500 hover:text-orange-400 transition-colors"
                    >
                      {showAllSharedAlbums ? 'Ver Menos' : 'Ver Tudo'}
                    </button>
                  )}
                </div>
                {comparisonData.albums.sharedSorted.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {(showAllSharedAlbums ? comparisonData.albums.sharedSorted : comparisonData.albums.sharedSorted.slice(0, 5)).map((album, idx) => {
                      const name = getAlbumName(album);
                      return (
                        <motion.div
                          key={`sharedAlbum-${idx}`}
                          initial={shouldAnimateComparer ? { opacity: 0, y: 10 } : false}
                          animate={{ opacity: 1, y: 0 }}
                          transition={shouldAnimateComparer ? { delay: Math.min(idx * 0.025, 0.16), duration: 0.24, ease: [0.16, 1, 0.3, 1] } : { duration: 0.01 }}
                          className={clsx(
                            "flex flex-col gap-2 border p-3 rounded-2xl hover:bg-white/[0.04] relative overflow-hidden",
                            statsSurfaceTransition,
                            album.inBothTop5 ? "bg-orange-500/[0.04] border-orange-500/20 shadow-[0_0_20px_rgba(249,115,22,0.05)]" : "bg-white/[0.02] border-white/5"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className="text-[10px] font-black font-mono text-white/30 shrink-0 w-4">#{idx+1}</div>
                            <SmartImage src={album.image || '/placeholder-music.jpg'} className="h-8 w-8 text-neutral-500 shrink-0" fallback="" rounded="xl" />
                            <div className="flex flex-col min-w-0 pr-1 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-bold text-white/95 truncate leading-tight">{name}</span>
                                {album.inBothTop5 && <span className="text-[7px] font-black uppercase tracking-widest bg-orange-600 text-white px-1.5 py-0.5 rounded-full shrink-0 flex items-center gap-0.5 shadow-lg shadow-orange-600/20"><Flame className="h-2 w-2" /> Top 5 Ambos</span>}
                              </div>
                              <span className="text-[8px] text-white/40 uppercase tracking-wider mt-0.5">{album.artists?.[0]?.name || 'Cantor'}</span>
                            </div>
                          </div>
                          <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider px-1">
                            <span className="text-orange-400 flex flex-col items-start gap-0.5">
                              <span className="text-[7px] text-orange-500/70 truncate max-w-[60px]">{userA.name}</span>
                              {coreUtils.formatNumber(album.playsA)} plays
                            </span>
                            <div className="flex flex-col items-center gap-0">
                              <span className="text-[7px] text-white/30">vs</span>
                              <span className="text-[8px] text-white/70">{coreUtils.formatNumber(album.combinedPlays)} total</span>
                            </div>
                            <span className="text-amber-400 flex flex-col items-end gap-0.5">
                              <span className="text-[7px] text-amber-500/70 truncate max-w-[60px]">{userB.name}</span>
                              {coreUtils.formatNumber(album.playsB)} plays
                            </span>
                          </div>
                          <div className="relative mx-1 mt-1 h-1 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="absolute inset-y-0 left-0 w-full origin-left rounded-l-full bg-orange-500"
                              style={{ transform: `scaleX(${album.playsA / (album.combinedPlays || 1)})` }}
                            />
                            <div
                              className="absolute inset-y-0 right-0 w-full origin-right rounded-r-full bg-amber-400"
                              style={{ transform: `scaleX(${album.playsB / (album.combinedPlays || 1)})` }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <span className="text-[10px] text-white/40 italic pl-1">Nenhum álbum coincidente no Top.</span>
                )}
              </div>

              {/* Diferenças de Álbuns */}
              <div className="glass-card p-5 border-white/5 flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                  <Flame className="h-3.5 w-3.5 text-orange-500" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-white font-display">Álbuns Divergentes</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Unique Album A */}
                  <div className="flex flex-col gap-2 bg-white/[0.01] p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black text-orange-500 uppercase tracking-wider mb-1 truncate">Apenas {userA.name}</span>
                    <div className="flex flex-col gap-1.5">
                      {comparisonData.albums.uniqueA.slice(0, 5).map((album, i) => (
                        <div key={`uniqueA-album-${i}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-1 w-1 bg-orange-500 rounded-full shrink-0" />
                            <span className="text-[10px] font-semibold text-white/70 truncate">{getAlbumName(album)}</span>
                          </div>
                          <span className="text-[8px] font-bold text-orange-500/70 shrink-0">{coreUtils.formatNumber(album.playcount || (album as any).plays || 0)}</span>
                        </div>
                      ))}
                      {comparisonData.albums.uniqueA.length === 0 && (
                        <span className="text-[9px] text-white/30 italic">Sem diferenças</span>
                      )}
                    </div>
                  </div>

                  {/* Unique Album B */}
                  <div className="flex flex-col gap-2 bg-white/[0.01] p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-black text-amber-500 uppercase tracking-wider mb-1 truncate">Apenas {userB.name}</span>
                    <div className="flex flex-col gap-1.5">
                      {comparisonData.albums.uniqueB.slice(0, 5).map((album, i) => (
                        <div key={`uniqueB-album-${i}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-1 w-1 bg-amber-500 rounded-full shrink-0" />
                            <span className="text-[10px] font-semibold text-white/70 truncate">{getAlbumName(album)}</span>
                          </div>
                          <span className="text-[8px] font-bold text-amber-500/70 shrink-0">{coreUtils.formatNumber(album.playcount || (album as any).plays || 0)}</span>
                        </div>
                      ))}
                      {comparisonData.albums.uniqueB.length === 0 && (
                        <span className="text-[9px] text-white/30 italic">Sem diferenças</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
