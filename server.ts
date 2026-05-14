import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import NodeCache from "node-cache";

const app = express();
const PORT = 3000;

// Configuração do Cache: 
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const STATSFM_BASE_URL = "https://api.stats.fm/api/v1";

const GROUP_USERS = [
  { id: "000997.3647cff9cc2b42359d6ca7f79a0f2c91.0428", name: "Leo" },
  { id: "000859.740385afd8284174a94c84e9bcc9bdea.1440", name: "Gab" },
  { id: "12151123201", name: "Sávio" },
  { id: "benante.m", name: "Benny" },
  { id: "12182998998", name: "Peter" }
];

async function startServer() {
  // Helpers
  const fetchStatsFm = async (endpoint: string, params = {}, timeout = 8000) => {
    const url = `${STATSFM_BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const response = await axios.get(url, {
      params,
      timeout,
      headers: { 'User-Agent': 'StatsLC-Server/1.0' }
    });
    return response.data;
  };

  // API routes
  
  app.get("/api/stats/proxy", async (req, res) => {
    const pathParam = req.query.path as string;
    if (!pathParam) return res.status(400).json({ error: "Path is required" });

    const cacheKey = `proxy_${pathParam}_${JSON.stringify(req.query)}`;
    const cached = cache.get(cacheKey);
    if (cached && req.query.refresh !== "true") return res.json(cached);

    try {
      const data = await fetchStatsFm(pathParam, { ...req.query, path: undefined, refresh: undefined });
      cache.set(cacheKey, data, 600); // 10 min default
      res.json(data);
    } catch (error: any) {
      res.status(error.response?.status || 500).json({ error: error.message });
    }
  });

  // Agregador de Dashboard (Rápido)
  app.get("/api/stats/group", async (req, res) => {
    const refresh = req.query.refresh === "true";
    const cacheKey = "group_dashboard_v2";
    if (!refresh) {
      const cached = cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    try {
      const resultPromises = GROUP_USERS.map(async (user) => {
        try {
          // Busca perfil, recentes e stats de hoje
          const [p, r, s] = await Promise.all([
            fetchStatsFm(`/users/${user.id}`),
            fetchStatsFm(`/users/${user.id}/streams/recent`, { limit: 10 }),
            fetchStatsFm(`/users/${user.id}/stats`, { range: 'today' })
          ]);

          const profile = p.item;
          const recent = r.items || [];
          const today = s.item || {};
          const lastTrack = recent[0];

          let nowPlaying = null;
          if (lastTrack) {
            const playedAt = new Date(lastTrack.timestamp).getTime();
            const isNow = (Date.now() - playedAt) < (45 * 1000) || !!lastTrack.progressMs;
            
            nowPlaying = {
              track: {
                id: lastTrack.track.id,
                name: lastTrack.track.name,
                artists: lastTrack.track.artists,
                image: lastTrack.track.image,
                albumName: lastTrack.track.albums?.[0]?.name,
                albumArtist: lastTrack.track.albums?.[0]?.artists?.[0]?.name,
                durationMs: lastTrack.track.durationMs,
                spotifyId: Array.isArray(lastTrack.track.externalIds?.spotify) ? lastTrack.track.externalIds?.spotify[0] : lastTrack.track.externalIds?.spotify,
                appleMusicId: Array.isArray(lastTrack.track.externalIds?.appleMusic) ? lastTrack.track.externalIds?.appleMusic[0] : lastTrack.track.externalIds?.appleMusic,
                externalIds: lastTrack.track.externalIds
              },
              isNow,
              timestamp: lastTrack.timestamp,
              progressMs: lastTrack.progressMs
            };
          }

          return {
            id: user.id,
            name: profile?.displayName || user.name,
            avatar: profile?.image,
            streamsToday: today.count || 0,
            nowPlaying
          };
        } catch (e) { return { id: user.id, name: user.name, streamsToday: 0 }; }
      });

      const users = await Promise.all(resultPromises);
      const usersMap = Object.fromEntries(users.map(u => [u.id, u]));
      
      const response = { users: usersMap, lastUpdated: new Date().toISOString() };
      cache.set(cacheKey, response, 30); // 30 sec cache for live dashboard
      res.json(response);
    } catch (e) { res.status(500).json({ error: "Aggregation failed" }); }
  });

  // Agregador de Rankings e Stats Pesadas
  app.get("/api/stats/user/:id", async (req, res) => {
    const userId = req.params.id;
    const cacheKey = `user_full_${userId}`;
    if (cache.get(cacheKey)) return res.json(cache.get(cacheKey));

    try {
      const [profile, statsToday, statsMonth, statsLifetime, topTracks, topArtists, topAlbums] = await Promise.all([
        fetchStatsFm(`/users/${userId}`),
        fetchStatsFm(`/users/${userId}/stats`, { range: 'today' }),
        fetchStatsFm(`/users/${userId}/stats`, { range: 'months' }),
        fetchStatsFm(`/users/${userId}/stats`, { range: 'lifetime' }),
        fetchStatsFm(`/users/${userId}/top/tracks`, { limit: 10, range: 'months' }),
        fetchStatsFm(`/users/${userId}/top/artists`, { limit: 10, range: 'months' }),
        fetchStatsFm(`/users/${userId}/top/albums`, { limit: 10, range: 'months' })
      ]);

      const result = {
        id: userId,
        name: profile.item?.displayName,
        avatar: profile.item?.image,
        stats: {
          today: statsToday.item,
          month: statsMonth.item,
          lifetime: statsLifetime.item
        },
        tops: {
          tracks: topTracks.items || [],
          artists: topArtists.items || [],
          albums: topAlbums.items || []
        }
      };

      cache.set(cacheKey, result, 1800); // 30 min
      res.json(result);
    } catch (e) { res.status(500).json({ error: "User detail failed" }); }
  });

  app.get("/api/stats/rankings", async (req, res) => {
    const range = req.query.range || 'months';
    const cacheKey = `rankings_v2_${range}`;
    if (cache.get(cacheKey)) return res.json(cache.get(cacheKey));

    try {
      const promises = GROUP_USERS.map(async (u) => {
        try {
          const s = await fetchStatsFm(`/users/${u.id}/stats`, { range });
          return { id: u.id, stats: s.item };
        } catch (e) { return { id: u.id, stats: { count: 0 } }; }
      });

      const results = await Promise.all(promises);
      const map = Object.fromEntries(results.map(r => [r.id, r.stats]));
      cache.set(cacheKey, map, 3600);
      res.json(map);
    } catch (e) { res.status(500).json({ error: "Rankings failed" }); }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), cache: cache.getStats() });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
