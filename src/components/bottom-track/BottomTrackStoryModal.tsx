import React from 'react';
import { BookOpen, Clock3, Disc3, Flame, ListMusic, Moon, Repeat2, Sparkles, Trophy, UserCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { SmartImage } from '../shared/CommonUI';
import type { BottomTrackStoryAvatar, BottomTrackStoryViewModel } from './trackStoryViewModel';

type MemberLike = {
  id?: string;
  key?: string;
  name?: string;
  avatar?: string;
};

export type BottomTrackStoryAction = {
  key: string;
  label: string;
  className: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: (button: HTMLButtonElement) => void;
};

type Props = {
  accentColor: string;
  actions: BottomTrackStoryAction[];
  lyricsDisabled?: boolean;
  lyricsLabel: string;
  members: MemberLike[];
  onLyrics: () => void;
  viewModel: BottomTrackStoryViewModel;
};

const rarityClass: Record<string, string> = {
  shiny: 'bottom-track-card--shiny',
  hiddenGem: 'bottom-track-card--hidden-gem',
  special: 'bottom-track-card--special',
  late: 'bottom-track-card--late',
  seasonal: 'bottom-track-card--seasonal',
};

const rarityFontClass: Record<string, string> = {
  shiny: 'bottom-track-rarity-title--shiny',
  hiddenGem: 'bottom-track-rarity-title--hidden-gem',
  special: 'bottom-track-rarity-title--special',
  late: 'bottom-track-rarity-title--late',
  seasonal: 'bottom-track-rarity-title--seasonal',
};

const number = (value: number | null | undefined) => (
  typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('pt-BR') : '--'
);

const shortDate = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '--';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
    .replace(/\sde\s/g, ' ')
    .toUpperCase();
};

const memberFor = (members: MemberLike[], row: BottomTrackStoryAvatar) => (
  members.find((member) => member.id === row.id || member.key === row.id || member.key === row.name)
);

const AvatarStack = ({
  members,
  rows,
  showCount,
}: {
  members: MemberLike[];
  rows: BottomTrackStoryAvatar[];
  showCount?: boolean;
}) => (
  <span className="flex min-w-0 -space-x-2">
    {rows.slice(0, 5).map((row) => {
      const member = memberFor(members, row);
      return (
        <span key={row.id} className="bottom-track-story-avatar relative h-7 w-7 shrink-0 overflow-visible rounded-full">
          <span className="block h-full w-full overflow-hidden rounded-full bg-white/[0.08]">
            <SmartImage src={member?.avatar || row.avatar} className="h-full w-full object-cover" rounded="full" fallback={member?.name || row.name} />
          </span>
          {showCount && typeof row.count === 'number' && (
            <span className="absolute -bottom-1 left-1/2 min-w-[18px] -translate-x-1/2 rounded-full bg-black/80 px-1 text-center text-[6px] font-black leading-3 text-white">
              {number(row.count)}
            </span>
          )}
        </span>
      );
    })}
  </span>
);

const Metric = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="bottom-track-card-cell min-w-0">
    <span className="flex items-center gap-1 text-[6px] font-black uppercase leading-none tracking-[0.12em] text-white/38">
      {icon}
      {label}
    </span>
    <strong className="mt-1 block min-w-0 truncate text-[17px] font-black leading-none tabular-nums text-white">
      {value}
    </strong>
  </div>
);

const HistoryCell = ({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) => (
  <div className="bottom-track-card-cell min-w-0">
    <span className="flex items-center gap-1 text-[6px] font-black uppercase leading-none tracking-[0.11em] text-white/38">
      {icon}
      {label}
    </span>
    <strong className="mt-1 block text-[8px] font-black leading-tight text-white/84">{value}</strong>
  </div>
);

const AdvancedCell = ({ label, value, icon }: { label: React.ReactNode; value: React.ReactNode; icon: React.ReactNode }) => (
  <div className="min-w-0 text-center">
    <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.07] text-[9px] text-white/66">{icon}</span>
    <strong className="mt-1 block truncate text-[8px] font-black leading-none text-white/88">{value}</strong>
    <span className="mt-1 block truncate text-[5px] font-black uppercase leading-none tracking-[0.08em] text-white/32">{label}</span>
  </div>
);

export const BottomTrackStoryModal = React.memo(({
  accentColor,
  actions,
  lyricsDisabled,
  lyricsLabel,
  members,
  onLyrics,
  viewModel,
}: Props) => {
  const rarity = viewModel.primaryRarity;
  const advanced = viewModel.advanced;
  const bestYear = viewModel.history.bestYear;
  const cardStyle = {
    '--bottom-track-accent': accentColor,
  } as React.CSSProperties;

  return (
    <div
      className={clsx('bottom-track-story-shell', rarity && rarityClass[rarity.code])}
      data-rarity={rarity?.code || 'common'}
      data-season={viewModel.season || undefined}
      style={cardStyle}
    >
      <header className="bottom-track-rarity-heading">
        <div className="min-w-0">
          <span className={clsx('bottom-track-rarity-title', rarity && rarityFontClass[rarity.code])}>
            {rarity?.label || 'TRACK STORY'}
          </span>
          {rarity && <span className="bottom-track-rarity-subtitle">{rarity.detail}</span>}
        </div>
        {viewModel.rarities.length > 1 && (
          <div className="flex max-w-[48%] flex-wrap justify-end gap-1" aria-label="raridades adicionais">
            {viewModel.rarities.slice(1).map((item) => (
              <span key={item.code} className="bottom-track-rarity-seal">{item.label}</span>
            ))}
          </div>
        )}
      </header>

      <section className="bottom-track-story-card" data-bottom-track-story-card="true">
        <span className="bottom-track-card-shine" aria-hidden="true" />
        <div className="bottom-track-story-identity">
          <div className="bottom-track-story-cover">
            {viewModel.artwork ? (
              <SmartImage src={viewModel.artwork} className="h-full w-full object-cover" rounded="none" fallback="" />
            ) : (
              <MusicCoverFallback />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[7px] font-black uppercase tracking-[0.16em] text-white/46">{viewModel.playbackTime || 'Track story'}</span>
            <h2 className="mt-0.5 line-clamp-2 text-[19px] font-black leading-[0.98] text-white">{viewModel.title}</h2>
            {viewModel.tags.length > 0 && (
              <div className="mt-1 flex max-w-full gap-1 overflow-hidden">
                {viewModel.tags.slice(0, 2).map((tag) => <span key={tag} className="bottom-track-title-tag">{tag}</span>)}
              </div>
            )}
            <p className="mt-1 truncate text-[10px] font-bold text-white/60">{viewModel.artistLine}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[7px] font-black uppercase tracking-[0.06em] text-white/32">{viewModel.album}</span>
              {viewModel.releaseDate && <span className="bottom-track-release-date">{viewModel.releaseDate}</span>}
            </div>
          </div>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-1.5">
          <Metric
            icon={<UserCircle className="h-2.5 w-2.5" />}
            label={viewModel.artists.length > 1 ? 'Artistas' : 'Artista'}
            value={viewModel.artists.length > 1
              ? (
                <span className="flex gap-1 text-[8px] leading-none">
                  {viewModel.artists.slice(0, 3).map((artist) => (
                    <span key={artist.id} className="min-w-0 flex-1 truncate">
                      <span className="block truncate text-[5px] uppercase text-white/34">{artist.name}</span>
                      <span className="mt-0.5 block text-[9px]">{number(artist.count)}</span>
                    </span>
                  ))}
                </span>
              )
              : number(viewModel.artists[0]?.count)}
          />
          <Metric icon={<ListMusic className="h-2.5 w-2.5" />} label="Faixa" value={number(viewModel.counts.track)} />
          <Metric icon={<Disc3 className="h-2.5 w-2.5" />} label="Álbum" value={number(viewModel.counts.album)} />
        </div>

        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          <HistoryCell icon={<Sparkles className="h-2.5 w-2.5 text-amber-300" />} label="Primeiro play" value={viewModel.history.first} />
          <HistoryCell icon={<Moon className="h-2.5 w-2.5 text-indigo-200" />} label="Último play" value={viewModel.history.last} />
          <HistoryCell
            label="Ano recorde"
            value={bestYear ? (
              <span className="grid grid-cols-3 items-end gap-0.5 text-center">
                <span className="text-white/34">{bestYear.previousYearCount}<small className="block text-[5px]">{bestYear.year - 1}</small></span>
                <span className="text-[11px] text-white">{bestYear.count}<small className="block text-[5px] text-white/62">{bestYear.year}</small></span>
                <span className="text-white/34">{bestYear.nextYearCount}<small className="block text-[5px]">{bestYear.year + 1}</small></span>
              </span>
            ) : '--'}
          />
        </div>

        {viewModel.history.late && (
          <div className="bottom-track-late-line mt-1.5">
            <span>{shortDate(viewModel.history.late.previousPlayedAt)}</span>
            <span className="text-white/28">→</span>
            <span>{shortDate(viewModel.history.late.returnedAt)}</span>
            <strong>{number(viewModel.history.late.gapDays)} dias</strong>
          </div>
        )}

        {advanced && (
          <div className="bottom-track-advanced-grid mt-1.5 grid grid-cols-5 gap-1">
            <AdvancedCell icon={<Flame className="h-3 w-3" />} label="Streak" value={`${advanced.streak.days}d`} />
            <AdvancedCell icon={<Repeat2 className="h-3 w-3" />} label={advanced.loopFactor ? `Loop · ${shortDate(advanced.loopFactor.day)}` : 'Loop factor'} value={advanced.loopFactor ? `${advanced.loopFactor.count}x` : '--'} />
            <AdvancedCell icon={<Clock3 className="h-3 w-3" />} label="Hora do dia" value={advanced.daypart ? `${advanced.daypart.percent}% ${advanced.daypart.label}` : '--'} />
            <AdvancedCell icon={<Moon className="h-3 w-3" />} label="Days since" value={advanced.daysSinceFirst == null ? '--' : number(advanced.daysSinceFirst)} />
            <AdvancedCell icon={<Trophy className="h-3 w-3" />} label="Top1K" value={advanced.top1kPosition ? `#${advanced.top1kPosition}` : '--'} />
          </div>
        )}

        <div className="bottom-track-social-panel mt-1.5 grid grid-cols-[1.05fr_1fr_48px] items-center gap-2">
          <div className="min-w-0">
            <span className="block truncate text-[6px] font-black uppercase tracking-[0.1em] text-white/38">{viewModel.social.label}</span>
            <div className="mt-1 flex items-center gap-2">
              <AvatarStack rows={viewModel.social.listeners} members={members} />
              <span className="min-w-0 truncate text-[6px] font-black text-white/54">{viewModel.social.date}</span>
            </div>
          </div>
          <div className="min-w-0">
            <span className="block truncate text-[6px] font-black uppercase tracking-[0.1em] text-white/38">Ranking da música</span>
            <div className="mt-1"><AvatarStack rows={viewModel.social.ranking} members={members} showCount /></div>
          </div>
          <div className="min-w-0 text-center">
            <span className="mb-1 block truncate text-[5px] font-black uppercase tracking-[0.08em] text-white/32">Cake piece</span>
            <div
              className="bottom-track-cake-piece"
              style={{ '--cake-piece': `${Math.max(0, Math.min(100, viewModel.social.cakePiecePercent || 0)) * 3.6}deg` } as React.CSSProperties}
            >
              <span>{viewModel.social.cakePiecePercent == null ? '--' : `${viewModel.social.cakePiecePercent}%`}</span>
            </div>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <button
            type="button"
            onClick={onLyrics}
            disabled={lyricsDisabled}
            className="bottom-track-action bottom-track-action-lyrics min-w-0 flex-1"
          >
            <BookOpen className="h-4 w-4" />
            <span>{lyricsLabel}</span>
          </button>
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              aria-label={action.label}
              disabled={action.disabled}
              onClick={(event) => action.onClick(event.currentTarget)}
              className={clsx('bottom-track-action h-10 w-10 shrink-0', action.className)}
            >
              {action.icon}
            </button>
          ))}
        </div>

        {viewModel.partial && <span className="bottom-track-partial-label">dados parciais</span>}
      </section>
    </div>
  );
});

BottomTrackStoryModal.displayName = 'BottomTrackStoryModal';

const MusicCoverFallback = () => (
  <span className="flex h-full w-full items-center justify-center bg-black/24">
    <Disc3 className="h-8 w-8 text-white/28" />
  </span>
);
