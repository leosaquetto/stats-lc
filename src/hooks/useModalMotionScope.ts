import { useEffect, useSyncExternalStore } from 'react';

const modalMotionListeners = new Set<() => void>();
let modalMotionOpen = false;

const readModalDepth = (body: HTMLElement) => {
  const depth = Number(body.dataset.statsLcModalDepth || 0);
  return Number.isFinite(depth) ? Math.max(0, depth) : 0;
};

const syncModalState = (body: HTMLElement, depth: number) => {
  const nextModalMotionOpen = depth > 0;
  if (depth > 0) {
    body.dataset.statsLcModalDepth = String(depth);
    body.dataset.statsLcModalOpen = 'true';
  } else {
    delete body.dataset.statsLcModalDepth;
    delete body.dataset.statsLcModalOpen;
  }

  if (modalMotionOpen === nextModalMotionOpen) return;
  modalMotionOpen = nextModalMotionOpen;
  modalMotionListeners.forEach((listener) => listener());
};

const subscribeModalMotion = (listener: () => void) => {
  modalMotionListeners.add(listener);
  return () => modalMotionListeners.delete(listener);
};

const getModalMotionSnapshot = () => modalMotionOpen;

export const useModalMotionOpen = () => useSyncExternalStore(
  subscribeModalMotion,
  getModalMotionSnapshot,
  () => false,
);

export const useModalMotionScope = (active = true) => {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return;

    const body = document.body;
    syncModalState(body, readModalDepth(body) + 1);

    return () => {
      syncModalState(body, readModalDepth(body) - 1);
    };
  }, [active]);
};
