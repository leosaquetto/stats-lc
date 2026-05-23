/**
 * Service for managing Browser Push Notifications in Stats LC
 */

import { UserStats } from '../types/stats';

// Store previous now playing states in memory during session
const previousNowPlaying: Record<string, string> = {};
// Store previously notified stream counts for the day to prevent repeat notifications
const notifiedMilestones: Record<string, number[]> = {};

export interface NotificationSettings {
  pushNotificationsEnabled: boolean;
  notifyOnNewStreams: boolean;
  notifyOnGroupHighlights: boolean;
  notifyOnArenaBattle: boolean;
  arenaName: string;
  pollingFrequency: number; // in seconds
}

// Store previous rankings to detect overtakes
let previousTodayRankings: string[] = [];

export const notificationService = {
  /**
   * Check if notifications are supported by the browser
   */
  isSupported(): boolean {
    return 'Notification' in window;
  },

  /**
   * Get current notification permission state
   */
  getPermissionState(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  /**
   * Request push notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      return 'denied';
    }
    
    try {
      const permission = await Notification.requestPermission();
      return permission;
    } catch (e) {
      console.error('Error requesting notification permission:', e);
      return 'default';
    }
  },

  /**
   * Send a native browser push notification
   */
  sendNotification(title: string, body: string, options: NotificationOptions = {}) {
    if (!this.isSupported() || Notification.permission !== 'granted') {
      return;
    }

    try {
      // Create options with app standard styles
      const defaultOptions: any = {
        body,
        icon: 'https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&name=Arena',
        badge: 'https://ui-avatars.com/api/?background=f97316&color=fff&bold=true&name=A',
        vibrate: [200, 100, 200],
        tag: 'stats-lc-alert',
        renotify: true,
        ...options,
      };

      // Try via service worker if available for background push simulation
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, defaultOptions);
        }).catch(() => {
          // Fallback to legacy Document Notification
          new Notification(title, defaultOptions);
        });
      } else {
        new Notification(title, defaultOptions);
      }
    } catch (error) {
      console.error('Error presenting notification:', error);
      // Fallback
      try {
        new Notification(title, { body, ...options });
      } catch (e) {}
    }
  },

  /**
   * Analyze updated group stats for changes relative to previous state
   * and trigger push notifications if enabled.
   */
  checkAndNotify(members: UserStats[], settings: NotificationSettings) {
    if (!settings.pushNotificationsEnabled || Notification.permission !== 'granted') {
      return;
    }

    // 0. Detect Rank Changes (Arena Battle)
    if (settings.notifyOnArenaBattle && members.length > 0) {
      const currentRankings = [...members]
        .sort((a, b) => b.streamsToday - a.streamsToday)
        .map(u => u.id);

      if (previousTodayRankings.length > 0) {
        currentRankings.forEach((userId, currentIndex) => {
          const previousIndex = previousTodayRankings.indexOf(userId);
          
          // If a user moves up in rank (index decreases)
          if (previousIndex !== -1 && currentIndex < previousIndex) {
            const user = members.find(m => m.id === userId);
            const surpassedUserId = previousTodayRankings[currentIndex];
            const surpassedUser = members.find(m => m.id === surpassedUserId);

            // Avoid notifying on minor changes if both have 0 streams
            if (user && surpassedUser && userId !== surpassedUserId && user.streamsToday > 0) {
               this.sendNotification(
                 `⚔️ Arena Battle: Avanço!`,
                 `${user.name} acaba de ultrapassar ${surpassedUser.name} no ranking de hoje!`,
                 {
                   tag: `overtake-${userId}-${surpassedUserId}`,
                   icon: user.avatar,
                   data: { url: '/ranking' }
                 }
               );
            }
          }
        });
      }
      previousTodayRankings = currentRankings;
    }

    members.forEach((member) => {
      const userId = member.id;
      const nowPlaying = member.nowPlaying;

      // 1. Check for New Streams ("now listening")
      if (settings.notifyOnNewStreams && nowPlaying?.isNow && nowPlaying.track) {
        const trackId = nowPlaying.track.id || nowPlaying.track.name;
        const currentPlayingKey = `${userId}:${trackId}`;
        const previousKey = previousNowPlaying[userId];

        // Format artist string
        const artistName = Array.isArray(nowPlaying.track.artists)
          ? nowPlaying.track.artists.map((a: any) => typeof a === 'string' ? a : a.name).join(', ')
          : 'Artista Desconhecido';

        if (previousKey !== undefined && previousKey !== currentPlayingKey) {
          // Track changed! Send notification
          this.sendNotification(
            `🎵 ${member.name} está tocando agora`,
            `"${nowPlaying.track.name}" — de ${artistName}`,
            {
              tag: `stream-${userId}`,
              icon: nowPlaying.track.image || member.avatar,
              data: { url: `/highlights` }
            }
          );
        }

        // Keep track of what they are listening to
        previousNowPlaying[userId] = currentPlayingKey;
      } else if (!nowPlaying?.isNow) {
        // Clear if they stopped listening, so we notify on their next tune
        delete previousNowPlaying[userId];
      }

      // 2. Check for Group Highlights / Streams Milestones
      if (settings.notifyOnGroupHighlights && member.streamsToday > 0) {
        const milestones = [10, 25, 50, 100, 200, 500];
        const userMilestones = notifiedMilestones[userId] || [];

        // Find the highest milestone the user has reached today
        const reachedMilestone = milestones.find((m) => member.streamsToday >= m && !userMilestones.includes(m));

        if (reachedMilestone !== undefined) {
          // Record milestone so we don't spam
          if (!notifiedMilestones[userId]) notifiedMilestones[userId] = [];
          notifiedMilestones[userId].push(reachedMilestone);

          // Get motivational/fun message
          let headline = `🔥 Legado Sonoro de ${member.name}!`;
          let description = `${member.name} superou ${reachedMilestone} streams hoje! Que pique! 🎧`;
          
          if (reachedMilestone >= 100) {
            headline = `👑 Rei da Arena: ${member.name}!`;
            description = `Impressionante! ${member.name} ultrapassou as 100 execuções hoje na Arena! 🚀`;
          }

          this.sendNotification(headline, description, {
            tag: `milestone-${userId}-${reachedMilestone}`,
            icon: member.avatar,
            data: { url: '/ranking' }
          });
        }
      }
    });
  },

  /**
   * Send a test notification to demonstrate push credentials
   */
  sendTestNotification() {
    this.sendNotification(
      '🎵 Arena Stats LC • Teste de Push',
      'As notificações estão configuradas com sucesso! Você receberá alertas de novos streams.',
      {
        tag: 'test-push',
        requireInteraction: false
      }
    );
  }
};
