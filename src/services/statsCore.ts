/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Artist } from '../types/stats';
import { formatTimeSP, formatDateSP, formatRelativeTimeSP, isTodaySP } from '../lib/time';

export const GROUP_USERS = {
  LEO: {
    id: "leo",
    name: "Leo",
    color: "#FF9F0A",
  },
  GAB: {
    id: "gab",
    name: "Gab",
    color: "#FFFFFF",
  },
  SAVIO: {
    id: "savio",
    name: "Sávio",
    color: "#FFFFFF",
  },
  BENNY: {
    id: "benny",
    name: "Benny",
    color: "#FFFFFF",
  },
  PETER: {
    id: "peter",
    name: "Peter",
    color: "#FFFFFF",
  }
} as const;

export const coreUtils = {
  /**
   * Retorna a URL do avatar do usuário com fallback para o Peter ou iniciais
   */
  getUserAvatar(userId: string, avatarUrl?: string): string {
    if (userId === GROUP_USERS.PETER.id) {
      return "https://i.imgur.com/4iOIFkx.jpeg";
    }
    
    if (avatarUrl && !avatarUrl.includes("placeholders/users/private.webp") && !avatarUrl.includes("ui-avatars.com")) {
      return avatarUrl;
    }

    return `https://ui-avatars.com/api/?background=222&color=fff&name=${encodeURIComponent(this.getUserName(userId) || "U")}`;
  },

  /**
   * Versão inteligente que decide entre imagem da faixa ou avatar
   */
  getAvatarUrl(userId: string, originalUrl?: string): string {
    if (originalUrl && !originalUrl.includes("placeholders/users/private.webp")) {
      return originalUrl;
    }
    // Se não tem imagem da track, tenta o avatar do usuário (que pode ser Peter)
    return this.getUserAvatar(userId);
  },

  /**
   * Alias sugerido pelo usuário para garantir a imagem correta
   */
  withPeterFallback(userId: string, originalUrl?: string): string {
    return this.getAvatarUrl(userId, originalUrl);
  },

  getUserName(userId: string): string {
    const user = Object.values(GROUP_USERS).find(u => u.id === userId);
    return user?.name || "User";
  },

  formatNumber(num: number): string {
    return (num || 0).toLocaleString('pt-BR');
  },

  formatDuration(ms: number): string {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return h > 0 ? `${this.formatNumber(h)}h ${m}m` : `${m}m`;
  },

  formatUpdateTime(lastUpdate?: string | number | Date): string {
    if (!lastUpdate) return "sem atualização";
    try {
      const date = new Date(lastUpdate);
      if (isNaN(date.getTime())) return "sem atualização";
      
      const timeStr = formatTimeSP(date);
      
      if (isTodaySP(date)) return `dados de ${timeStr}`;
      
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (formatDateSP(date) === formatDateSP(yesterday)) {
        return `dados de ontem ${timeStr}`;
      }
      
      return `dados de ${formatDateSP(date)} ${timeStr}`;
    } catch (e) {
      return "sem atualização";
    }
  },

  normalizeText(value: string | undefined): string {
    if (!value) return "";
    return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
  },

  getTimeAgoSmart(date: Date): string {
    return formatRelativeTimeSP(date);
  },

  /**
   * Move o dono do álbum para a primeira posição do array de artistas
   * com comparação robusta (IDs ou Nomes normalizados)
   */
  reorderArtists(artists: (string | { name: string, id?: string })[], albumArtist?: string | { name: string, id?: string }): (string | { name: string, id?: string })[] {
    if (!albumArtist || artists.length <= 1) return artists;
    
    const extractName = (a: any) => typeof a === 'string' ? a : (a?.name || "");
    const extractId = (a: any) => typeof a === 'object' ? a?.id : null;

    const albumArtistNameNorm = this.normalizeText(extractName(albumArtist));
    const albumArtistId = extractId(albumArtist);

    const primary: any[] = [];
    const secondary: any[] = [];
    
    artists.forEach(artist => {
      const name = extractName(artist);
      const id = extractId(artist);
      
      const nameMatch = this.normalizeText(name) === albumArtistNameNorm;
      const idMatch = id && albumArtistId && id === albumArtistId;

      if (idMatch || nameMatch) {
        primary.push(artist);
      } else {
        secondary.push(artist);
      }
    });
    
    return primary.length ? [...primary, ...secondary] : artists;
  },

  /**
   * Detecta a plataforma musical baseada em IDs e URLs de imagem
   */
  detectMusicPlatform(track: any): { primary: "appleMusic" | "spotify" | "unknown", hasAppleMusic: boolean, hasSpotify: boolean, confidence: "high" | "medium" | "low" } {
    if (!track) return { primary: "unknown", hasAppleMusic: false, hasSpotify: false, confidence: "low" };

    const hasAppleMusicId = !!track.appleMusicId;
    const hasSpotifyId = !!track.spotifyId;
    
    const imageUrl = track.image || track.album?.image || "";
    const isAppleImage = imageUrl.includes("mzstatic.com") || imageUrl.includes("music.apple.com");
    const isSpotifyImage = imageUrl.includes("scdn.co") || imageUrl.includes("spotifycdn");

    let primary: "appleMusic" | "spotify" | "unknown" = "unknown";
    let confidence: "high" | "medium" | "low" = "low";

    if (hasAppleMusicId || hasSpotifyId) {
      confidence = "high";
      if (hasAppleMusicId && hasSpotifyId) {
        if (isAppleImage) primary = "appleMusic";
        else if (isSpotifyImage) primary = "spotify";
        else primary = "unknown";
      } else if (hasAppleMusicId) {
        primary = "appleMusic";
      } else {
        primary = "spotify";
      }
    } else if (isAppleImage || isSpotifyImage) {
      confidence = "medium";
      primary = isAppleImage ? "appleMusic" : "spotify";
    }

    return {
      primary,
      hasAppleMusic: hasAppleMusicId || isAppleImage,
      hasSpotify: hasSpotifyId || isSpotifyImage,
      confidence
    };
  },

  /**
   * Determina o status de reprodução de um membro
   */
  getPlaybackStatus(member: any): { 
    status: "live" | "lastPlayed" | "inactive", 
    label: string, 
    minutesAgo: number | null 
  } {
    const nowPlaying = member.nowPlaying;
    
    // Se não há objeto ou não há uma track válida
    if (!nowPlaying || !nowPlaying.track || nowPlaying.track.name === "Desconhecido") {
      return { status: "inactive", label: "sinal inativo", minutesAgo: null };
    }

    const timestamp = nowPlaying.timestamp;
    const isNow = nowPlaying.isNow;
    
    const date = new Date(timestamp);
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    // Se o backend diz explicitamente que é agora, ou se o sinal é extremamente recente (< 5 min)
    const isActuallyLive = isNow === true || diffMins < 5;

    if (isActuallyLive) {
      return { status: "live", label: "ouvindo agora", minutesAgo: Math.max(0, diffMins) };
    }

    return { 
      status: "lastPlayed", 
      label: "last played", 
      minutesAgo: diffMins 
    };
  }
};
