import { GroupStats, LiveNowPlayingByUserId, UserStats } from '../types/stats';

const uniqueIds = (ids: string[] = []) => Array.from(new Set(ids.filter(Boolean)));

export const dedupeIds = uniqueIds;

const hasValue = (value: any) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value !== undefined && value !== null && value !== '';
};

const preferRichValue = (incoming: any, existing: any) => (
  hasValue(incoming) ? incoming : existing
);

const shouldUseIncomingNowPlaying = (existing?: any, incoming?: any) => {
  if (!hasValue(incoming)) return false;
  if (!hasValue(existing)) return true;

  const existingTrackId = existing?.track?.id;
  const incomingTrackId = incoming?.track?.id;
  const existingTime = existing?.timestamp ? new Date(existing.timestamp).getTime() : 0;
  const incomingTime = incoming?.timestamp ? new Date(incoming.timestamp).getTime() : 0;
  const hasNewerTimestamp = Number.isFinite(incomingTime) && Number.isFinite(existingTime)
    ? incomingTime + 1500 >= existingTime
    : true;

  if (existing?.isNow === true && incoming?.isNow !== true && hasNewerTimestamp) return false;
  if (incomingTrackId && existingTrackId && incomingTrackId !== existingTrackId && hasNewerTimestamp) return true;
  return hasNewerTimestamp;
};

const mergeMember = (existing: UserStats | undefined, incoming: UserStats): UserStats => {
  if (!existing) return incoming;

  const merged = {
    ...existing,
    ...incoming,
  };

  return {
    ...merged,
    name: preferRichValue(incoming.name, existing.name),
    avatar: preferRichValue(incoming.avatar, existing.avatar),
    nowPlaying: shouldUseIncomingNowPlaying(existing.nowPlaying, incoming.nowPlaying)
      ? incoming.nowPlaying
      : existing.nowPlaying,
    stats: preferRichValue((incoming as any).stats, (existing as any).stats),
    recent: preferRichValue((incoming as any).recent, (existing as any).recent),
    topItems: preferRichValue((incoming as any).topItems, (existing as any).topItems),
  } as UserStats;
};

export const getCanonicalMembers = (groupStats: GroupStats | null | undefined): UserStats[] => {
  const usersById = new Map<string, UserStats>();
  const sources = [
    ...(Array.isArray(groupStats?.members) ? groupStats?.members || [] : []),
    ...Object.values(groupStats?.users || {}),
  ];

  sources.forEach((member: any) => {
    if (!member?.id) return;
    usersById.set(member.id, mergeMember(usersById.get(member.id), member));
  });

  return Array.from(usersById.values());
};

export const attachLiveNowPlayingToMember = (
  member: UserStats,
  liveNowPlayingByUserId: LiveNowPlayingByUserId = {}
): UserStats => {
  const liveNowPlaying = liveNowPlayingByUserId[member.id];
  if (!liveNowPlaying) return member;
  if (member.nowPlaying === liveNowPlaying) return member;
  return { ...member, nowPlaying: liveNowPlaying };
};

export const getCanonicalMembersWithLive = (
  groupStats: GroupStats | null | undefined,
  liveNowPlayingByUserId: LiveNowPlayingByUserId = {}
): UserStats[] => getCanonicalMembers(groupStats).map((member) =>
  attachLiveNowPlayingToMember(member, liveNowPlayingByUserId)
);

export const getVisibleMembers = (
  groupStats: GroupStats | null | undefined,
  hiddenUsers: string[] = []
): UserStats[] => {
  const canonicalMembers = getCanonicalMembers(groupStats);
  const hidden = new Set(uniqueIds(hiddenUsers));
  const visibleMembers = canonicalMembers.filter((member) => !hidden.has(member.id));
  return visibleMembers.length > 0 ? visibleMembers : canonicalMembers;
};

export const getVisibleMembersWithLive = (
  groupStats: GroupStats | null | undefined,
  hiddenUsers: string[] = [],
  liveNowPlayingByUserId: LiveNowPlayingByUserId = {}
): UserStats[] => {
  const canonicalMembers = getCanonicalMembersWithLive(groupStats, liveNowPlayingByUserId);
  const hidden = new Set(uniqueIds(hiddenUsers));
  const visibleMembers = canonicalMembers.filter((member) => !hidden.has(member.id));
  return visibleMembers.length > 0 ? visibleMembers : canonicalMembers;
};
