import { toPng } from 'html-to-image';

export interface SnapshotItem {
  id: string;
  dataUrl: string;
  timestamp: number;
  title: string;
}

export type ShareTemplate = 'minimal' | 'glass' | 'bold' | 'neon' | 'none';

const SNAPSHOT_HISTORY_KEY = 'stats_snapshot_history';

export const snapshotService = {
  async captureElement(
    element: HTMLElement, 
    template: ShareTemplate = 'glass',
    title: string = 'stats.lc'
  ): Promise<string | null> {
    try {
      // Small delay to ensure any animations settle
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const options: any = {
        cacheBust: true,
        pixelRatio: 3, // Very high quality
        backgroundColor: 'transparent',
        style: {
          borderRadius: '0px',
          transform: 'scale(1)',
          transition: 'none',
        }
      };

      // Custom thematic wrapping before capture if needed
      // For now, we apply thematic styles via html-to-image options
      if (template === 'bold') {
        options.backgroundColor = '#FF9F0A';
        options.style.background = 'linear-gradient(135deg, #FF9F0A 0%, #FF3D00 100%)';
      } else if (template === 'neon') {
        options.backgroundColor = '#0c0c0c';
        options.style.background = 'radial-gradient(circle at center, #1a1a1a 0%, #000000 100%)';
        options.style.border = '2px solid #BCFF00';
      } else if (template === 'glass') {
        options.backgroundColor = '#000000';
        options.style.background = 'linear-gradient(180deg, #111111 0%, #000000 100%)';
      } else if (template === 'none') {
        options.backgroundColor = 'transparent';
        options.style.background = 'transparent';
        options.style.padding = '0px';
      } else {
        options.backgroundColor = '#FFFFFF';
        options.style.background = '#FFFFFF';
        options.style.color = '#000000';
      }

      // Add a hidden watermark div to the element temporarily or use pseudo-elements
      // Since we can't easily modify the real DOM without causing a flicker, 
      // we use the 'style' property to add a background watermark if possible, 
      // or just assume the themed background is enough.
      // Better: Add a "Stats.lc" text watermark using after/before if the library supports it, 
      // but simpler is to use a background image or text shadow.
      
      const dataUrl = await toPng(element, {
        ...options,
        style: {
          ...options.style,
          position: 'relative',
          padding: template === 'none' ? '0px' : '40px', 
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }
      });
      
      // Save to history
      this.saveToHistory({
        id: crypto.randomUUID(),
        dataUrl,
        timestamp: Date.now(),
        title
      });

      return dataUrl;
    } catch (error) {
      console.error('Snapshot error:', error);
      return null;
    }
  },

  saveToHistory(item: SnapshotItem) {
    try {
      const history = this.getHistory();
      const updated = [item, ...history].slice(0, 10); // Keep last 10
      localStorage.setItem(SNAPSHOT_HISTORY_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save snapshot history', e);
    }
  },

  getHistory(): SnapshotItem[] {
    try {
      const stored = localStorage.getItem(SNAPSHOT_HISTORY_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  async shareImage(dataUrl: string, title: string = 'My Music Stats') {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'ranking.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: title,
          text: 'Confira minhas estatísticas no stats.lc!',
        });
        return true;
      } else {
        const link = document.createElement('a');
        link.download = `stats-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        return false;
      }
    } catch (error) {
      console.error('Sharing failed:', error);
      return false;
    }
  }
};
