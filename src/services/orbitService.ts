import axios from 'axios';

const getBaseUrl = () => {
  const envBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || (import.meta as any).env?.VITE_STATS_API_BASE_URL;
  if (envBaseUrl) return String(envBaseUrl).replace(/\/$/, "");
  if ((import.meta as any).env?.DEV && typeof window !== 'undefined') return window.location.origin;
  return "https://statslc.leosaquetto.com";
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 20000,
  headers: { Accept: 'application/json' },
});

export type OrbitStatus = 'sent' | 'seen' | 'opened' | 'listened' | 'dismissed';
export type OrbitBox = 'received' | 'sent' | 'all';

export interface Orbit {
  id: string;
  fromUserId: string;
  toUserId: string;
  track: any;
  message?: string;
  status: OrbitStatus;
  createdAt: string;
  seenAt?: string;
  openedAt?: string;
  firstListenedAt?: string;
  listenCountSinceSent: number;
  lastCheckedAt?: string;
  targetPlatform?: string;
  listenUrl?: string;
}

export interface OrbitSummary {
  received: number;
  sent: number;
  sentListened: number;
  unread: number;
}

export interface CreateOrbitInput {
  fromUserId: string;
  toUserId: string;
  track: any;
  message?: string;
}

const unwrapItems = (payload: any) => Array.isArray(payload?.items) ? payload.items : Array.isArray(payload) ? payload : [];
const unwrapTracks = (payload: any) => unwrapItems(payload)
  .map((row: any) => row?.item || row?.track || row)
  .filter((track: any) => track?.id || track?.name);
const normalizeSearchText = (value: unknown) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();
const getTrackSearchText = (track: any) => [
  track?.name,
  track?.primaryArtistName,
  track?.albumName,
  ...(track?.artists || []).map((artist: any) => artist?.name || artist),
].map(normalizeSearchText).join(' ');
const uniqueTracks = (tracks: any[]) => Array.from(new Map(
  tracks.map((track) => [String(track?.id || track?.name), track])
).values());

export const orbitService = {
  async getPushPublicKey(): Promise<string | null> {
    const response = await api.get('/api/push/public-key');
    return response.data?.configured ? response.data?.publicKey || null : null;
  },

  async subscribePush(userId: string, subscription: PushSubscriptionJSON): Promise<void> {
    await api.post('/api/push/subscribe', { userId, subscription });
  },

  async unsubscribePush(endpoint: string): Promise<void> {
    await api.post('/api/push/unsubscribe', { endpoint });
  },

  async list(userId: string, box: OrbitBox = 'received', signal?: AbortSignal): Promise<Orbit[]> {
    const response = await api.get('/api/orbits', { params: { user: userId, box }, signal });
    return unwrapItems(response.data);
  },

  async summary(userId: string, signal?: AbortSignal): Promise<OrbitSummary> {
    const response = await api.get('/api/orbits/summary', { params: { user: userId }, signal });
    return {
      received: Number(response.data?.received || 0),
      sent: Number(response.data?.sent || 0),
      sentListened: Number(response.data?.sentListened || 0),
      unread: Number(response.data?.unread || 0),
    };
  },

  async create(input: CreateOrbitInput): Promise<Orbit> {
    const response = await api.post('/api/orbits', input);
    return response.data?.orbit || response.data;
  },

  async markSeen(id: string): Promise<void> {
    await api.post(`/api/orbits/${encodeURIComponent(id)}/seen`);
  },

  async markOpened(id: string): Promise<void> {
    await api.post(`/api/orbits/${encodeURIComponent(id)}/opened`);
  },

  async checkListens(id: string): Promise<Orbit> {
    const response = await api.post(`/api/orbits/${encodeURIComponent(id)}/check-listens`);
    return response.data?.orbit || response.data;
  },

  async dismiss(id: string): Promise<void> {
    await api.post(`/api/orbits/${encodeURIComponent(id)}/dismiss`);
  },

  async deleteSent(id: string): Promise<void> {
    await api.post(`/api/orbits/${encodeURIComponent(id)}/delete-sent`);
  },

  async deleteReceived(id: string): Promise<void> {
    await api.post(`/api/orbits/${encodeURIComponent(id)}/delete-received`);
  },

  async searchTracks(query: string, userId?: string, signal?: AbortSignal): Promise<any[]> {
    const response = await api.get('/api/search', { params: { q: query, type: 'track', limit: 8 }, signal });
    const catalogMatches = unwrapTracks(response.data);
    if (catalogMatches.length > 0 || !userId) return catalogMatches;

    const needle = normalizeSearchText(query);
    const recent = await api.get('/api/recent', { params: { user: userId, limit: 50, resolveAlbums: 1 }, signal })
      .then((result) => unwrapTracks(result.data))
      .catch(() => []);
    const recentMatches = uniqueTracks(recent)
      .filter((track) => getTrackSearchText(track).includes(needle))
      .slice(0, 8);
    if (recentMatches.length > 0) return recentMatches;

    const top = await api.get('/api/top', { params: { user: userId, type: 'tracks', period: 'lifetime', limit: 100 }, signal })
      .then((result) => unwrapTracks(result.data))
      .catch(() => []);
    return uniqueTracks(top)
      .filter((track) => getTrackSearchText(track).includes(needle))
      .slice(0, 8);
  },
};
