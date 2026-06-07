import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';

const getHashFromNativeUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hash) return parsed.hash;
    const host = parsed.hostname && parsed.hostname !== 'localhost' ? parsed.hostname : '';
    const path = [host, parsed.pathname.replace(/^\/+/, '')].filter(Boolean).join('/');
    return path ? `#/${path}` : '#/';
  } catch {
    return null;
  }
};

export const setupNativeLifecycle = async (onResume: () => void) => {
  if (!Capacitor.isNativePlatform()) return () => {};

  await Promise.allSettled([
    StatusBar.setOverlaysWebView({ overlay: false }),
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: '#000000' }),
  ]);

  const stateHandle = await CapacitorApp.addListener('appStateChange', ({ isActive }) => {
    if (isActive) onResume();
  });
  const urlHandle = await CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    const hash = getHashFromNativeUrl(url);
    if (hash && window.location.hash !== hash) window.location.hash = hash;
  });

  return () => {
    stateHandle.remove();
    urlHandle.remove();
  };
};
