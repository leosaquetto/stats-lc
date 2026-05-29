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
