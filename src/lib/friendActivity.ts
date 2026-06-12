export type FriendActivityCandidate = {
  track?: unknown;
  isNow?: boolean;
  timestamp?: string | number | null;
  playedAt?: string | number | null;
  endTime?: string | number | null;
};

export function getFriendActivityTimestamp(activity?: FriendActivityCandidate | null) {
  const raw = activity?.timestamp ?? activity?.playedAt ?? activity?.endTime;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw < 2_147_483_647 ? raw * 1000 : raw;
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function selectFriendActivity<T extends FriendActivityCandidate>(
  ...activities: Array<T | null | undefined>
): T | null {
  const candidates = activities.filter((activity): activity is T => Boolean(activity?.track));
  if (candidates.length === 0) return null;

  const liveCandidates = candidates.filter(activity => activity.isNow === true);
  const comparable = liveCandidates.length > 0 ? liveCandidates : candidates;

  return comparable.reduce((latest, candidate) =>
    getFriendActivityTimestamp(candidate) > getFriendActivityTimestamp(latest)
      ? candidate
      : latest
  );
}
