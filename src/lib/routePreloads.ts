export const loadHomeScreen = () => import('../screens/HomeScreen');
export const loadStatsScreen = () => import('../screens/StatsScreen');
export const loadSettingsScreen = () => import('../screens/SettingsScreen');
export const loadCircleScreen = () => import('../screens/CircleScreen');

export const preloadRouteModule = (path: string) => {
  if (path === '/stats') return loadStatsScreen().then(() => undefined);
  if (path === '/circle') {
    return loadCircleScreen()
      .then((module) => module.preloadCircleSections?.())
      .then(() => undefined);
  }
  if (path === '/settings') return loadSettingsScreen().then(() => undefined);
  if (path === '/') {
    return loadHomeScreen()
      .then((module) => module.preloadHomeDetailModals?.())
      .then(() => undefined);
  }

  return Promise.resolve();
};
