import { GroupStats, UserStats } from '../types/stats';

const uniqueIds = (ids: string[] = []) => Array.from(new Set(ids.filter(Boolean)));

export const dedupeIds = uniqueIds;

export const getCanonicalMembers = (groupStats: GroupStats | null | undefined): UserStats[] => {
  const usersById = new Map<string, UserStats>();
  const sources = [
    ...(Array.isArray(groupStats?.members) ? groupStats?.members || [] : []),
    ...Object.values(groupStats?.users || {}),
  ];

  sources.forEach((member: any) => {
    if (!member?.id) return;
    usersById.set(member.id, {
      ...usersById.get(member.id),
      ...member,
    });
  });

  return Array.from(usersById.values());
};

export const getVisibleMembers = (
  groupStats: GroupStats | null | undefined,
  hiddenUsers: string[] = []
): UserStats[] => {
  const canonicalMembers = getCanonicalMembers(groupStats);
  const hidden = new Set(uniqueIds(hiddenUsers));
  const visibleMembers = canonicalMembers.filter((member) => !hidden.has(member.id));
  return visibleMembers.length > 0 ? visibleMembers : canonicalMembers;
};
