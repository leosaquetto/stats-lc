/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { SmartImage } from '../shared/CommonUI';
import { coreUtils } from '../../services/statsCore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UserSelectorExplosionProps {
  isOpen: boolean;
  members: any[];
  featuredUserId: string;
  onSelectUser: (userId: string) => void;
  onClose: () => void;
  triggerPosition?: { x: number; y: number };
  mode?: 'header' | 'mini-header';
}

export const UserSelectorExplosion: React.FC<UserSelectorExplosionProps> = ({
  isOpen,
  members,
  featuredUserId,
  onSelectUser,
  onClose,
  triggerPosition,
  mode = 'header'
}) => {
  const [lastTriggerPosition, setLastTriggerPosition] = useState(triggerPosition);

  useEffect(() => {
    if (triggerPosition) setLastTriggerPosition(triggerPosition);
  }, [triggerPosition]);

  // Filtra apenas os outros membros (não mostra o usuário principal)
  const otherMembers = useMemo(() => {
    return members.filter(m => m.id !== featuredUserId);
  }, [members, featuredUserId]);

  // Calcula posições em órbita ao redor do avatar
  const positions = useMemo(() => {
    const origin = triggerPosition || lastTriggerPosition;
    if (!origin) return [];

    const { x, y } = origin;
    const count = otherMembers.length;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 390;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 844;
    const avatarSize = 56;
    const padding = avatarSize / 2 + 12;
    const isSmallPhone = viewportWidth <= 430;

    if (isSmallPhone) {
      const columns = Math.min(2, Math.max(1, count));
      const gap = 82;
      const rows = Math.ceil(count / columns);
      const centerX = x < viewportWidth / 2
        ? Math.min(viewportWidth - padding - gap / 2, x + 128)
        : Math.max(padding + gap / 2, x - 128);
      const centerY = Math.min(
        Math.max(y + (mode === 'header' ? 34 : 92), padding + gap / 2),
        viewportHeight - padding - 128
      );

      return otherMembers.map((member, i) => {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const xOffset = (col - (columns - 1) / 2) * gap;
        const yOffset = (row - (rows - 1) / 2) * gap;

        return {
          member,
          x: Math.min(Math.max(centerX + xOffset, padding), viewportWidth - padding),
          y: Math.min(Math.max(centerY + yOffset, padding + 8), viewportHeight - padding - 96),
          delay: i * 0.045
        };
      });
    }

    // Configuração de ângulos por modo
    const preferredAngles = mode === 'header'
      ? [18, 52, 88, 124, 160, 205, -18, -52]
      : [115, 150, 185, 220, 255, 290, 80, 325];

    const baseRadius = mode === 'header' ? 82 : 76;

    return otherMembers.map((member, i) => {
      const angle = preferredAngles[i % preferredAngles.length] * (Math.PI / 180);
      const radius = baseRadius + (i % 2) * 14;
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;
      const nextX = Math.min(Math.max(x + offsetX, padding), viewportWidth - padding);
      const nextY = Math.min(Math.max(y + offsetY, padding + 8), viewportHeight - padding - 96);

      return {
        member,
        x: nextX,
        y: nextY,
        delay: i * 0.04
      };
    });
  }, [triggerPosition, lastTriggerPosition, otherMembers, mode]);

  const origin = triggerPosition || lastTriggerPosition;
  if (!origin || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop com fade - clique fora fecha */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] liquid-glass-overlay"
          />

          {/* Avatares em órbita (sem mostrar o usuário principal) */}
          {positions.map(({ member, x, y, delay }, index) => (
            <motion.button
              key={member.id}
              onClick={() => {
                onSelectUser(member.id);
                onClose();
              }}
              initial={{
                scale: 0,
                left: origin.x,
                top: origin.y,
                opacity: 0
              }}
              animate={{
                scale: 1,
                left: x,
                top: y,
                opacity: 1
              }}
              exit={{
                scale: 0,
                left: origin.x,
                top: origin.y,
                opacity: 0
              }}
              transition={{
                duration: 0.34,
                delay,
                ease: [0.16, 1, 0.3, 1]
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="fixed z-[201] -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            >
              <motion.div
                className="relative group flex h-[84px] w-[72px] items-center justify-center"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay }}
              >
                <div className="relative z-10 h-14 w-14 overflow-hidden rounded-full bg-stone-900 shadow-[0_12px_28px_rgba(0,0,0,0.45)] ring-1 ring-white/10 transition-all group-hover:ring-orange-500/50">
                  <SmartImage
                    src={coreUtils.getUserAvatar(member.id, member.avatar)}
                    className="h-full w-full object-cover"
                    fallback=""
                    rounded="full"
                  />
                </div>

                {/* Nome em tooltip */}
                <div className="pointer-events-none absolute left-1/2 top-0 z-20 w-[92px] -translate-x-1/2 -translate-y-full opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="mx-auto max-w-full rounded-full border border-white/10 bg-black/90 px-2 py-1 text-center shadow-[0_8px_22px_rgba(0,0,0,0.55)] backdrop-blur-md">
                    <span className="block truncate text-[9px] font-bold leading-none text-white">
                      {member.name}
                    </span>
                  </div>
                </div>
              </motion.div>
            </motion.button>
          ))}
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
