export type ReplayFilterPeriod = 'today' | 'week' | 'month' | 'year' | 'all';
export type ReplayWeekMode = 'last-7' | 'current';

export interface ReplaySelectedSubValues {
  weekMode?: ReplayWeekMode;
  month?: string;
  year?: string;
}

export const MONTHS_SHORT = [
  'jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
  'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'
];

export const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export const getReplayFilterLabel = (
  activeTab: ReplayFilterPeriod,
  selectedSubValues: ReplaySelectedSubValues = {}
) => {
  switch (activeTab) {
    case 'today':
      return 'hoje';
    case 'week':
      return selectedSubValues.weekMode === 'last-7' ? 'ultimos 7 dias' : 'esta semana';
    case 'month': {
      const monthIndex = parseInt(selectedSubValues.month || '0');
      return MONTHS_SHORT[monthIndex] || 'mes';
    }
    case 'year':
      return selectedSubValues.year || String(new Date().getFullYear());
    case 'all':
      return 'total';
    default:
      return 'hoje';
  }
};

export const getReplayFilterSentence = (
  activeTab: ReplayFilterPeriod,
  selectedSubValues: ReplaySelectedSubValues = {}
) => {
  switch (activeTab) {
    case 'today':
      return 'hoje';
    case 'week':
      return selectedSubValues.weekMode === 'last-7' ? 'nos ultimos 7 dias' : 'esta semana';
    case 'month': {
      const monthIndex = parseInt(selectedSubValues.month || '0');
      return `em ${MONTHS_LONG[monthIndex] || 'mes'}`;
    }
    case 'year':
      return `em ${selectedSubValues.year || new Date().getFullYear()}`;
    case 'all':
      return 'no total';
    default:
      return 'hoje';
  }
};
