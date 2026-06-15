import { useEffect } from 'react';

const readModalDepth = (body: HTMLElement) => {
  const depth = Number(body.dataset.statsLcModalDepth || 0);
  return Number.isFinite(depth) ? Math.max(0, depth) : 0;
};

const syncModalState = (body: HTMLElement, depth: number) => {
  if (depth > 0) {
    body.dataset.statsLcModalDepth = String(depth);
    body.dataset.statsLcModalOpen = 'true';
    return;
  }

  delete body.dataset.statsLcModalDepth;
  delete body.dataset.statsLcModalOpen;
};

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
