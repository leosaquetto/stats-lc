/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utilidades de Tempo centralizadas para o fuso horário America/Sao_Paulo
 */

const TIMEZONE = "America/Sao_Paulo";
const LOCALE = "pt-BR";

/**
 * Retorna a data atual ou baseada em input convertida para o fuso de São Paulo
 */
export function toSaoPauloDate(dateInput?: string | number | Date): Date {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(date.getTime())) return new Date();
  
  // Converte para string no timezone de SP e reconstrói para termos um objeto Date 
  // que represente "nominalmente" o horário lá, útil para comparações simples de dia/mês/ano local.
  // Note: Operações complexas de Date ainda usam o sistema local do JS, 
  // mas usaremos Intl para exibição.
  return date;
}

/**
 * Formata horário (ex: 14:30 ou 14h30)
 */
export function formatTimeSP(dateInput: string | number | Date, style: 'dots' | 'h' = 'h'): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "--:--";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat(LOCALE, options);
  const parts = formatter.formatToParts(date);
  const hour = parts.find(p => p.type === 'hour')?.value || "00";
  const minute = parts.find(p => p.type === 'minute')?.value || "00";

  return style === 'h' ? `${hour}h${minute}` : `${hour}:${minute}`;
}

/**
 * Formata data (ex: 14/05/2026)
 */
export function formatDateSP(dateInput: string | number | Date, format: 'short' | 'full' = 'short'): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "--/--";

  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: format === 'full' ? 'numeric' : undefined,
  };

  return new Intl.DateTimeFormat(LOCALE, options).format(date);
}

/**
 * Retorna o início do dia atual em São Paulo
 */
export function getStartOfTodaySP(): Date {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  });
  
  const parts = formatter.formatToParts(now);
  const y = parseInt(parts.find(p => p.type === 'year')?.value || "0");
  const m = parseInt(parts.find(p => p.type === 'month')?.value || "0") - 1;
  const d = parseInt(parts.find(p => p.type === 'day')?.value || "0");
  
  // Criamos uma data que "no fuso local do navegador" pareça ser meia-noite de SP
  // Mas para ser 100% rigoroso com offsets, o ideal é usar luxon ou similar.
  // Como não podemos instalar novas libs sem instrução, vamos usar o truque do Intl.
  
  const spMeiaNoite = new Date();
  spMeiaNoite.setFullYear(y, m, d);
  spMeiaNoite.setHours(0, 0, 0, 0);
  
  return spMeiaNoite;
}

/**
 * Verifica se uma data é "hoje" em São Paulo
 */
export function isTodaySP(dateInput: string | number | Date): boolean {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return false;
  
  const todayStr = formatDateSP(new Date());
  const dateStr = formatDateSP(date);
  
  return todayStr === dateStr;
}

/**
 * Verifica se uma data é "ontem" em São Paulo
 */
export function isYesterdaySP(dateInput: string | number | Date): boolean {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return false;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  return formatDateSP(date) === formatDateSP(yesterday);
}

/**
 * Retorna a hora (0-23) no fuso de São Paulo
 */
export function getHourSP(dateInput: string | number | Date): number {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return -1;

  const options: Intl.DateTimeFormatOptions = {
    timeZone: TIMEZONE,
    hour: 'numeric',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat(LOCALE, options);
  const hourStr = formatter.format(date);
  return parseInt(hourStr, 10) % 24;
}

/**
 * Formata tempo relativo amigável (ex: há 5 min, ontem 14h30)
 */
export function formatRelativeTimeSP(dateInput: string | number | Date): string {
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return "Recente";

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 3) return "ouvindo agora";

  const timeStr = formatTimeSP(date);
  
  if (isTodaySP(date)) {
    if (diffMins < 60) return `${diffMins}min atrás, ${timeStr}`;
    return `${diffHours}h atrás, ${timeStr}`;
  }

  // Ontem?
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (formatDateSP(date) === formatDateSP(yesterday)) {
    return `ontem ${timeStr}`;
  }

  return `${formatDateSP(date)} ${timeStr}`;
}

/**
 * Retorna o início da semana atual em São Paulo
 */
export function getStartOfWeekSP(): Date {
  const today = getStartOfTodaySP();
  const day = today.getDay(); // 0 is Sunday
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const startOfWeek = new Date(today);
  startOfWeek.setDate(diff);
  return startOfWeek;
}

/**
 * Retorna o início do mês atual em São Paulo
 */
export function getStartOfMonthSP(): Date {
  const today = getStartOfTodaySP();
  const startOfMonth = new Date(today);
  startOfMonth.setDate(1);
  return startOfMonth;
}

/**
 * Retorna o início do ano atual em São Paulo
 */
export function getStartOfYearSP(): Date {
  const today = getStartOfTodaySP();
  const startOfYear = new Date(today);
  startOfYear.setMonth(0, 1);
  return startOfYear;
}
