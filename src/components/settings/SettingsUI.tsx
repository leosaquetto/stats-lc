import React from 'react';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { Check, EyeOff, MinusCircle } from 'lucide-react';
import { SmartImage } from '../shared/CommonUI';
import { coreUtils } from '../../services/statsCore';
import type { UserStats } from '../../types/stats';

export function SettingsGroup({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <span className="text-[9px] font-black uppercase tracking-[0.24em] text-orange-400/70">
            {eyebrow}
          </span>
          <h2 className="mt-1 text-lg font-black tracking-tight text-white">{title}</h2>
          {description && (
            <p className="mt-1 max-w-xl text-[11px] font-medium leading-relaxed text-white/38">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0 text-white/25">{action}</div>}
      </div>
      {children}
    </section>
  );
}

export function SettingsPanel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('glass-card rounded-[28px] p-4 sm:p-5', className)}>
      {children}
    </div>
  );
}

export function ToggleSwitch({
  checked,
  onClick,
  disabled = false,
  size = 'md',
  label,
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  label: string;
}) {
  const width = size === 'sm' ? 'w-10' : 'w-12';
  const height = size === 'sm' ? 'h-5' : 'h-6';
  const knob = size === 'sm' ? 'h-4 w-4 top-0.5' : 'h-4 w-4 top-1';
  const x = size === 'sm' ? (checked ? 20 : 4) : checked ? 24 : 4;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        'relative shrink-0 rounded-full transition-colors duration-300',
        width,
        height,
        checked ? 'bg-orange-500' : 'bg-white/10',
        disabled && 'cursor-not-allowed opacity-35'
      )}
    >
      <motion.span
        animate={{ x }}
        className={clsx('absolute rounded-full bg-white shadow-xl', knob)}
      />
    </button>
  );
}

export function PreferenceRow({
  icon,
  title,
  description,
  control,
  muted = false,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  control: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className={clsx('flex items-center justify-between gap-4', muted && 'opacity-35')}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className="mt-0.5 shrink-0 text-orange-400">{icon}</div>}
        <div className="min-w-0">
          <div className="text-[13px] font-bold leading-tight text-white/90">{title}</div>
          {description && (
            <div className="mt-1 text-[10px] font-medium leading-relaxed text-white/34">{description}</div>
          )}
        </div>
      </div>
      {control}
    </div>
  );
}

export function MemberTile({
  user,
  active,
  muted,
  onClick,
  rightIcon,
}: {
  user: UserStats;
  active?: boolean;
  muted?: boolean;
  onClick: () => void;
  rightIcon?: React.ReactNode;
}) {
  const firstName = (user.name || '').trim().split(/\s+/)[0] || user.name || '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex min-h-[58px] w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98]',
        active
          ? 'border-orange-500/45 bg-orange-500/10 text-orange-300'
          : 'border-white/6 bg-white/[0.035] text-white/78 hover:bg-white/[0.06]',
        muted && 'border-red-500/20 bg-red-500/10 text-red-300'
      )}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-2xl bg-white/5">
        <SmartImage
          src={coreUtils.getUserAvatar(user.id, user.avatar)}
          className={clsx('h-full w-full object-cover', muted && 'opacity-45 grayscale')}
          fallback=""
          rounded="none"
        />
        {active && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-white">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-black leading-tight">{firstName}</div>
        <div className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-[0.14em] text-white/28">
          {active ? 'Em destaque' : muted ? 'Oculto' : 'Membro'}
        </div>
      </div>
      {rightIcon || (muted ? <EyeOff className="h-4 w-4 shrink-0" /> : null)}
    </button>
  );
}

export function MemberCard({
  user,
  active,
  onClick,
}: {
  user: UserStats;
  active?: boolean;
  onClick: () => void;
}) {
  const firstName = (user.name || '').trim().split(/\s+/)[0] || user.name || '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'glass group relative flex aspect-[0.72] min-h-[132px] flex-col justify-end overflow-hidden rounded-3xl p-2 text-center transition-[background-color,box-shadow,transform] duration-200 active:scale-[0.98]',
        active ? 'ring-1 ring-orange-500/70 shadow-[0_10px_30px_rgba(255,159,10,0.1)]' : 'hover:bg-white/[0.04]'
      )}
      style={{ border: 0 }}
    >
      <SmartImage
        src={coreUtils.getUserAvatar(user.id, user.avatar)}
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-78 transition-transform duration-500 group-hover:scale-110"
        fallback=""
        rounded="none"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
      <div className="absolute inset-0 bg-black/10" />
      {active && (
        <div className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 shadow-lg">
          <div className="h-2 w-2 rounded-full bg-white" />
        </div>
      )}
      <div className="relative z-10 flex min-h-[38px] w-full items-end justify-center px-1 pb-1">
        <span className={clsx('w-full whitespace-normal break-words text-[10px] font-black leading-[1.12]', active ? 'text-orange-400' : 'text-white/88')}>
          {firstName}
        </span>
      </div>
    </button>
  );
}

export function MemberVisibilityChip({
  user,
  hidden,
  featured,
  onClick,
}: {
  user: UserStats;
  hidden?: boolean;
  featured?: boolean;
  onClick: () => void;
}) {
  const firstName = (user.name || '').trim().split(/\s+/)[0] || user.name || '';

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex min-h-[52px] w-full items-center gap-2.5 rounded-2xl border px-3 py-2 text-left transition-[background-color,border-color,color,transform] duration-200 active:scale-[0.98]',
        hidden ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-white/5 bg-white/5 text-white/44 hover:bg-white/[0.07]',
        featured && !hidden && 'border-orange-500/22 bg-orange-500/8 text-orange-300/80'
      )}
    >
      <SmartImage
        src={coreUtils.getUserAvatar(user.id, user.avatar)}
        className={clsx('h-7 w-7 shrink-0 rounded-full object-cover', hidden ? 'opacity-45 grayscale' : 'opacity-80')}
        fallback=""
      />
      <span className="min-w-0 flex-1 truncate text-[11px] font-bold leading-tight">{firstName}</span>
      {hidden ? <MinusCircle className="h-3 w-3 shrink-0" /> : featured ? <Check className="h-3 w-3 shrink-0" /> : null}
    </button>
  );
}
