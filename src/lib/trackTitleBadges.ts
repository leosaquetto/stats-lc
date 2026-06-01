/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParsedTrackTitle {
  displayTitle: string;
  badges: string[];
}

const EXACT_BADGE_PATTERNS = [/^extended$/i, /^remix$/i, /^radio edit$/i];
const CONTAINS_BADGE_PATTERNS = [
  /\bspanish\b/i,
  /\benglish\b/i,
  /\bversion\b/i,
  /\bao vivo\b/i,
  /\blive\b/i,
  /\bacoustic\b/i,
  /\bacústico\b/i,
  /\bdemo\b/i,
];

const normalizeBadgeText = (value: string) => (
  value
    .replace(/\s+/g, ' ')
    .replace(/^[\s-–—]+|[\s-–—]+$/g, '')
    .trim()
);

const shouldExtractBadge = (value: string) => {
  const text = normalizeBadgeText(value);
  if (!text) return false;
  return EXACT_BADGE_PATTERNS.some((pattern) => pattern.test(text))
    || CONTAINS_BADGE_PATTERNS.some((pattern) => pattern.test(text));
};

const addBadge = (badges: string[], value: string) => {
  const badge = normalizeBadgeText(value);
  if (!badge) return;
  const key = badge.toLocaleLowerCase('pt-BR');
  if (!badges.some((item) => item.toLocaleLowerCase('pt-BR') === key)) {
    badges.push(badge);
  }
};

export const parseTrackTitleBadges = (title?: string | null): ParsedTrackTitle => {
  const originalTitle = normalizeBadgeText(title || '');
  if (!originalTitle) return { displayTitle: '', badges: [] };

  const badges: string[] = [];
  let displayTitle = originalTitle.replace(/\s*([\[(])([^\])]+)([\])])\s*/g, (match, _open, content) => {
    if (!shouldExtractBadge(content)) return match;
    addBadge(badges, content);
    return ' ';
  });

  const parts = displayTitle.split(/\s+[-–—]\s+/);
  while (parts.length > 1 && shouldExtractBadge(parts[parts.length - 1])) {
    addBadge(badges, parts.pop() || '');
  }

  displayTitle = parts
    .join(' - ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([:;,.!?])/g, '$1')
    .trim();

  return {
    displayTitle: displayTitle || originalTitle,
    badges,
  };
};
