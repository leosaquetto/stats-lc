/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Artist } from '../types/stats';

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
      const updateDate = new Date(lastUpdate);
      if (isNaN(updateDate.getTime())) return "sem atualização";
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const updateDay = new Date(updateDate.getFullYear(), updateDate.getMonth(), updateDate.getDate());
      
      const hours = updateDate.getHours().toString().padStart(2, "0");
      const minutes = updateDate.getMinutes().toString().padStart(2, "0");
      const timeStr = `${hours}h${minutes}`;
      
      if (updateDay.getTime() === today.getTime()) return `dados de ${timeStr}`;
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (updateDay.getTime() === yesterday.getTime()) return `dados de ontem ${timeStr}`;
      
      const day = updateDate.getDate().toString().padStart(2, "0");
      const month = (updateDate.getMonth() + 1).toString().padStart(2, "0");
      return `dados de ${day}/${month} ${timeStr}`;
    } catch (e) {
      return "sem atualização";
    }
  },

  normalizeText(value: string | undefined): string {
    if (!value) return "";
    return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
  },

  getTimeAgoSmart(date: Date): string {
    if (isNaN(date.getTime())) return "Recente";
    const now = new Date();
    const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 3) return "ouvindo agora";
    
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const timeStr = `${hours}h${minutes}`;
    
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    if (dateDay.getTime() === today.getTime()) {
      return diffMins < 60 ? `${diffMins}min atrás, ${timeStr}` : `${diffHours}h atrás, ${timeStr}`;
    }
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateDay.getTime() === yesterday.getTime()) return `ontem ${timeStr}`;
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${day}/${month} ${timeStr}`;
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
   * Tenta extrair o dono do álbum via scraping (fallback extremo)
   */
  async extractAlbumOwnerFromStatsHtml(albumId: string): Promise<string | null> {
    try {
      const response = await fetch(`https://stats.fm/album/${albumId}`);
      if (!response.ok) return null;
      const html = await response.text();
      
      // Regex para encontrar o link do artista principal no HTML do stats.fm
      const match = html.match(/href="\/artist\/([^"]+)"/);
      return match ? match[1] : null;
    } catch (e) {
      console.warn("Falha no scraping do álbum:", albumId);
      return null;
    }
  }
};
