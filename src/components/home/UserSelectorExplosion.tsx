/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
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
  // Filtra apenas os outros membros (não mostra o usuário principal)
  const otherMembers = useMemo(() => {
    return members.filter(m => m.id !== featuredUserId);
  }, [members, featuredUserId]);

  // Calcula posições em órbita ao redor do avatar
  const positions = useMemo(() => {
    if (!triggerPosition) return [];

    const { x, y } = triggerPosition;
    const count = otherMembers.length;

    // Configuração de ângulos por modo
    const preferredAngles = mode === 'header'
      ? [30, 75, 120, 165, 210, -30, -75, -120] // direita e inferior
      : [150, 195, 240, 105, 285, -60, -105, -150]; // esquerda e inferior

    const radius = 90;

    return otherMembers.map((member, i) => {
      const angle = preferredAngles[i % preferredAngles.length] * (Math.PI / 180);
      const offsetX = Math.cos(angle) * radius;
      const offsetY = Math.sin(angle) * radius;

      return {
        member,
        x: x + offsetX,
        y: y + offsetY,
        delay: i * 0.04
      };
    });
  }, [triggerPosition, otherMembers, mode]);

  if (!isOpen || !triggerPosition) return null;

  return (
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
            className="fixed inset-0 z-[200] bg-black/20 backdrop-blur-sm"
          />

          {/* Avatares em órbita (sem mostrar o usuário principal) */}
          {positions.map(({ member, x, y, delay }) => (
            <motion.button
              key={member.id}
              onClick={() => {
                onSelectUser(member.id);
                onClose();
              }}
              initial={{
                scale: 0,
                x: triggerPosition.x,
                y: triggerPosition.y,
                opacity: 0
              }}
              animate={{
                scale: 1,
                x,
                y,
                opacity: 1
              }}
              exit={{
                scale: 0,
                x: triggerPosition.x,
                y: triggerPosition.y,
                opacity: 0
              }}
              transition={{
                duration: 0.3,
                delay,
                ease: [0.16, 1, 0.3, 1]
              }}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.9 }}
              className="fixed z-[201] -translate-x-1/2 -translate-y-1/2 cursor-pointer"
            >
              <div className="relative group">
                <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-white/20 group-hover:border-orange-500/60 transition-all shadow-xl bg-stone-900">
                  <SmartImage
                    src={coreUtils.getUserAvatar(member.id, member.avatar)}
                    className="h-full w-full object-cover"
                    fallback=""
                    rounded="full"
                  />
                </div>

                {/* Nome em tooltip */}
                <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                  <div className="bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                    <span className="text-[10px] font-bold text-white">
                      {member.name}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </>
      )}
    </AnimatePresence>
  );
};
