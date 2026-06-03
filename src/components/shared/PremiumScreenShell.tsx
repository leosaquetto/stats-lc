import React from 'react';
import { clsx } from 'clsx';

type PremiumScreenHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
};

export function PremiumScreenHeader({
  eyebrow,
  title,
  description,
  icon,
  action,
  children,
  className = '',
}: PremiumScreenHeaderProps) {
  return (
    <header
      className={clsx(
        'relative overflow-hidden rounded-[34px] border border-white/8 bg-white/[0.025] p-5 shadow-[0_22px_58px_rgba(0,0,0,0.32)] backdrop-blur-xl',
        className
      )}
    >
      <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-orange-500/[0.08] blur-[72px]" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_18px_rgba(255,95,0,0.45)]" />
            <span className="text-[9px] font-black uppercase tracking-[0.24em] text-orange-300/80">
              {eyebrow}
            </span>
          </div>
          <h1 className="mt-2 text-4xl font-black tracking-tight text-white">{title}</h1>
          <p className="mt-2 max-w-xl text-[12px] font-semibold leading-relaxed text-white/44">
            {description}
          </p>
        </div>

        {(icon || action) && (
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {icon && (
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/8 bg-black/28 text-orange-300 shadow-[0_14px_34px_rgba(0,0,0,0.28)]">
                {icon}
              </div>
            )}
          </div>
        )}
      </div>

      {children && <div className="relative z-10 mt-4">{children}</div>}
    </header>
  );
}
