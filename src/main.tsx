import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAnalytics } from './services/analyticsService.ts';

// Initialize tracking system
initAnalytics();

// Register Service Worker for push notifications
if ('serviceWorker' in navigator && (import.meta as any).env?.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => {
        registrations.forEach((registration) => registration.update().catch(() => {}));
      })
      .catch(() => {});

    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        registration.update().catch(() => {});
        if ((import.meta as any).env?.DEV) console.log('SW registered successfully:', registration.scope);
      })
      .catch((err) => {
        if ((import.meta as any).env?.DEV) console.warn('SW registration failed:', err);
      });
  });
}

const root = createRoot(document.getElementById('root')!);
root.render(
  <App />
);

// Sinaliza que o React renderizou e o splash pode ser removido
setTimeout(() => {
  if (window.__SPLASH_READY__ !== undefined) {
    window.__SPLASH_READY__ = true;
  }
  const splash = document.getElementById('splash-screen');
  if (splash) {
    splash.style.opacity = '0';
    splash.style.transition = 'opacity 0.3s ease-out';
    setTimeout(() => splash.remove(), 300);
  }
}, 100);
