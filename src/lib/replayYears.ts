export const MIN_STATS_YEAR = 2016;

export const getSelectableReplayYears = (currentYear = new Date().getFullYear()) => {
  const safeCurrentYear = Number.isFinite(currentYear) ? Math.max(MIN_STATS_YEAR, Math.floor(currentYear)) : MIN_STATS_YEAR;
  return Array.from(
    { length: safeCurrentYear - MIN_STATS_YEAR + 1 },
    (_, index) => MIN_STATS_YEAR + index
  );
};
