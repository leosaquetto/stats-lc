import React from 'react';
import { CalendarDays, Clock3, Flame, Gem, Moon, PieChart, Repeat2, Sparkles, Trophy, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { SmartImage } from '../shared/CommonUI';
import type { TrackStoryCountRow, TrackStoryResponse } from '../../types/stats';

type MemberLike = {
  id?: string;
  key?: string;
  name?: string;
  avatar?: string;
};

type Props = {
  story: TrackStoryResponse | null;
  members: MemberLike[];
  loading?: boolean;
};

const toneClasses: Record<string, string> = {
  shiny: 'bottom-track-story-card--shine',
  treasure: 'bottom-track-story-card--treasure',
  seasonal: 'bottom-track-story-card--seasonal',
  special: 'bottom-track-story-card--special',
  late: 'bottom-track-story-card--late',
  jealous: 'bottom-track-story-card--jealous',
};

const cardTags: Record<string, string> = {
  shiny: 'raridade',
  treasure: 'tesouro',
  seasonal: 'sazonal',
  special: 'dupla',
  late: 'retorno',
  jealous: 'rivalidade',
};

const findMember = (members: MemberLike[], row: TrackStoryCountRow) => {
  return members.find((member) => member.id === row.id || member.key === row.key) || null;
};

const formatStoryDate = (value?: string | number | null) => {
  if (!value) return 'sem data';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'sem data';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(/\sde\s/g, ' ').toUpperCase();
};

const formatStoryNumber = (value?: number | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '--';
  return value.toLocaleString('pt-BR');
};

const StorySkeleton = () => (
  <div className="mt-3 grid grid-cols-3 gap-1.5" aria-hidden="true">
    <span className="stats-lc-skeleton-shimmer h-10 rounded-[18px]" />
    <span className="stats-lc-skeleton-shimmer h-10 rounded-[18px]" />
    <span className="stats-lc-skeleton-shimmer h-10 rounded-[18px]" />
  </div>
);

const StoryAvatarStack = ({ rows, members, max = 4 }: { rows: TrackStoryCountRow[]; members: MemberLike[]; max?: number }) => {
  if (rows.length === 0) return null;

  return (
    <span className="flex min-w-0 -space-x-2">
      {rows.slice(0, max).map((row, index) => {
        const member = findMember(members, row);
        return (
          <span
            key={`${row.id}-${row.key || index}`}
            className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-white/[0.06] shadow-[0_5px_12px_rgba(0,0,0,0.26)]"
            style={{ zIndex: max - index }}
          >
            <SmartImage
              src={member?.avatar}
              className="h-full w-full object-cover"
              rounded="full"
              fallback={member?.name || row.key || '?'}
            />
            {row.count > 0 && (
              <span className="absolute -bottom-px left-1/2 min-w-[18px] -translate-x-1/2 rounded-full bg-black/70 px-1 text-center text-[7px] font-black leading-3 text-white">
                {row.count}
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
};

const AdvancedItem = ({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) => (
  <div className="bottom-track-stats-surface min-w-[104px] shrink-0 rounded-[18px] px-3 py-2">
    <span className="flex items-center gap-1 text-[6px] font-black uppercase leading-none tracking-[0.11em] text-white/34">
      {icon}
      {label}
    </span>
    <span className="mt-1 block whitespace-nowrap text-[10px] font-black leading-none text-white/84">{value}</span>
  </div>
);

const SpecialCards = ({ story }: { story: TrackStoryResponse }) => {
  if (!story.specialCards?.length) return null;

  return (
    <div className="mt-3 flex gap-1.5 overflow-x-auto px-px pb-1 no-scrollbar" data-home-horizontal-scroll="true" aria-label="cards especiais da música">
      {story.specialCards.map((card) => (
        <div
          key={`${card.code}-${card.label}`}
          className={clsx(
            'bottom-track-story-card relative min-w-[142px] shrink-0 overflow-hidden rounded-[20px] px-3 py-2.5',
            toneClasses[card.code] || 'bottom-track-story-card--special'
          )}
        >
          <span className="bottom-track-story-card-tag absolute right-2 top-1.5 rounded-full px-1.5 py-0.5 text-[5px] font-black uppercase leading-none tracking-[0.12em]">
            {cardTags[card.code] || 'especial'}
          </span>
          <span className="relative z-10 flex items-center gap-1 text-[7px] font-black uppercase leading-none tracking-[0.14em] text-white/84">
            {card.code === 'treasure' ? <Gem className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
            {card.label}
          </span>
          <span className="relative z-10 mt-1.5 block text-[9px] font-bold leading-tight text-white/64">
            {card.detail}
          </span>
        </div>
      ))}
    </div>
  );
};

const AdvancedGrid = ({ story }: { story: TrackStoryResponse }) => {
  if (!story.advanced) return null;
  const { streak, loopFactor, daypart, daysSinceFirst, top1kPosition } = story.advanced;

  return (
    <div className="mt-3 flex gap-1.5 overflow-x-auto px-px pb-1 no-scrollbar" data-home-horizontal-scroll="true" aria-label="métricas avançadas da música">
      <AdvancedItem label="Streak" icon={<Flame className="h-3 w-3 text-orange-300" />} value={streak?.days ? `${streak.days} dias` : '--'} />
      <AdvancedItem label="Loop factor" icon={<Repeat2 className="h-3 w-3 text-orange-300" />} value={loopFactor ? `${loopFactor.count}x ${formatStoryDate(loopFactor.day)}` : '--'} />
      <AdvancedItem label="Hora do dia" icon={<Clock3 className="h-3 w-3 text-orange-300" />} value={daypart ? `${daypart.percent}% ${daypart.label}` : '--'} />
      <AdvancedItem label="Days since" icon={<Moon className="h-3 w-3 text-orange-300" />} value={daysSinceFirst != null ? `${formatStoryNumber(daysSinceFirst)} dias` : '--'} />
      <AdvancedItem
        label="Top1k"
        icon={<Trophy className="h-3 w-3 text-orange-300" />}
        value={story.coverage.topPartial ? '--' : top1kPosition ? `#${top1kPosition}` : 'fora'}
      />
    </div>
  );
};

const SocialStory = ({ story, members }: { story: TrackStoryResponse; members: MemberLike[] }) => {
  if (story.coverage.socialPartial) return null;
  const releaseRows = story.social.releaseListeners || [];
  const firstRows = story.social.firstListeners || [];
  const ranking = story.social.ranking || [];

  return (
    <div className="mt-3 grid grid-cols-[1fr_1fr] gap-1.5">
      <div className={clsx(
        'bottom-track-stats-surface min-w-0 rounded-[20px] px-3 py-2',
        story.social.heardOnRelease && 'bottom-track-story-release'
      )}>
        <span className="flex items-center gap-1 text-[6px] font-black uppercase leading-none tracking-[0.11em] text-white/34">
          <CalendarDays className="h-3 w-3 text-orange-300" />
          {story.social.heardOnRelease ? 'Ouviu no lançamento' : 'Ouviu primeiro'}
        </span>
        <div className="mt-1.5 flex items-center gap-2">
          <StoryAvatarStack rows={releaseRows.length ? releaseRows : firstRows} members={members} max={3} />
          <span className="min-w-0 truncate text-[9px] font-black leading-none text-white/78">
            {story.social.heardFirst ? 'Você abriu a fila' : `${firstRows.length || ranking.length} ouvintes`}
          </span>
        </div>
      </div>
      <div className="bottom-track-stats-surface min-w-0 rounded-[20px] px-3 py-2">
        <span className="flex items-center gap-1 text-[6px] font-black uppercase leading-none tracking-[0.11em] text-white/34">
          <PieChart className="h-3 w-3 text-orange-300" />
          Cake piece
        </span>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[14px] font-black leading-none text-white">
            {story.social.cakePiecePercent == null ? '--' : `${story.social.cakePiecePercent}%`}
          </span>
          <StoryAvatarStack rows={ranking} members={members} max={4} />
        </div>
      </div>
    </div>
  );
};

const CoverageBadge = ({ story }: { story: TrackStoryResponse }) => {
  if (!story.coverage?.partial) return null;
  return (
    <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-white/[0.045] px-2 py-1 text-[6px] font-black uppercase tracking-[0.12em] text-white/34">
      <Zap className="h-2.5 w-2.5 text-orange-300/70" />
      dados parciais
    </span>
  );
};

export const BottomTrackStorySections = ({ story, members, loading }: Props) => {
  if (!story && loading) return <StorySkeleton />;
  if (!story) return null;

  return (
    <>
      <SpecialCards story={story} />
      <AdvancedGrid story={story} />
      <SocialStory story={story} members={members} />
      <CoverageBadge story={story} />
    </>
  );
};
