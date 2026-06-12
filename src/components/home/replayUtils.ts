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
      return selectedSubValues.weekMode === 'last-7' ? 'Últimos 7 dias' : 'esta semana';
    case 'month': {
      const monthIndex = parseInt(selectedSubValues.month || '0');
      const year = selectedSubValues.year;
      const currentYear = String(new Date().getFullYear());
      const monthLabel = MONTHS_SHORT[monthIndex] || 'mes';
      return year && year !== currentYear ? `${monthLabel} ${year}` : monthLabel;
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
      const year = selectedSubValues.year;
      const currentYear = String(new Date().getFullYear());
      return year && year !== currentYear
        ? `em ${MONTHS_LONG[monthIndex] || 'mes'} de ${year}`
        : `em ${MONTHS_LONG[monthIndex] || 'mes'}`;
    }
    case 'year':
      return `em ${selectedSubValues.year || new Date().getFullYear()}`;
    case 'all':
      return 'no total';
    default:
      return 'hoje';
  }
};
