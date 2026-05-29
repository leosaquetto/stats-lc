/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SmartImage } from '../shared/CommonUI';
import { coreUtils } from '../../services/statsCore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface UserSelectorModalProps {
  isOpen: boolean;
  members: any[];
  featuredUserId: string;
  onSelectUser: (userId: string) => void;
  onClose: () => void;
}

export const UserSelectorModal: React.FC<UserSelectorModalProps> = ({
  isOpen,
  members,
  featuredUserId,
  onSelectUser,
  onClose
}) => {
  if (!isOpen) return null;

  // Ordenar usuários alfabeticamente
  const sortedMembers = [...members].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop com blur - cobrindo toda a tela incluindo rodapé */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-[200] bg-black/30 backdrop-blur-xl touch-none"
            style={{ minHeight: '100dvh' }}
            onTouchStart={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
          />

          {/* Espaço invisível na parte inferior para evitar arrasto acidental */}
          <div
            className="fixed bottom-0 left-0 right-0 h-32 z-[202] pointer-events-none touch-none"
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          />

          {/* Container para logo + modal */}
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] flex flex-col items-center gap-8">
            {/* Logo fora/acima do card */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex justify-center"
            >
              <svg viewBox="0 0 1731 909" className="w-48 h-auto text-white">
                <path fill="#f5761f" d="M470.8,324.3c20-2.4,36.3,12.6,38.3,32.2v172.9c-6.8,39-60.7,39.8-67.1.1v-178c2.9-13.7,14.8-25.6,28.8-27.3Z"/>
                <path fill="currentColor" d="M700.9,446.9c-1,1.4-27.5,11.2-31.3,13.2-4.9-13.6-24.2-18.1-36.6-13.6-9.4,3.4-10,12.5-1.3,17.3,11.6,6.3,32.5,7.7,46.3,13.7,16.6,7.2,27.7,21,25.9,39.9-5.5,56.4-106,53.5-118.8,2.7,5.1-.2,28.5-14.2,31-12.6s3.2,5.8,4.6,7.5c8.5,10.5,25.3,14.5,38,10.2,10.8-3.7,12.1-14.5,1.5-19.6-20.6-10-64.9-7.6-69.8-39.2-9-58.2,77.3-66,105.2-30.2,1.2,1.6,6.7,9.2,5.5,10.8Z"/>
                <path fill="currentColor" d="M1198,447c-5.5.7-29.5,14-32.9,11.9s-1.1-3.1-2.1-4.4c-8.1-9.3-30.9-14.4-39-4-9.3,11.9,10.4,15.9,18,18,22.8,6.5,53.7,9.7,57.7,39.3,7.8,57.6-81.1,66.2-110.7,27.7-1.7-2.2-8.4-13.2-6.9-15.4l30.3-13.1c4.1,17.1,39.6,27.4,49.6,13.6s-30.1-21-39.2-23.8c-20.1-6.1-37.2-16.5-36.8-40.2.9-53.1,95.5-54.8,112-9.6Z"/>
                <path fill="currentColor" d="M1486.9,453.9l-32.4,14.1c-22.4-38.8-76.2-11-62.6,31.5,7.1,22.3,36.7,31.9,54.5,16.4,2.9-2.5,7.2-11,9-11,5.8,0,25,13.2,32.5,14-25.4,59.9-114.9,50.5-132.3-11.3-16.3-57.9,34.5-107.6,92-90,17.2,5.3,34.1,18.6,39.2,36.2Z"/>
                <path fill="currentColor" d="M1063,419v30.5c0,.1-1.4,1.5-1.5,1.5h-32.5v58.5c0,1,2.5,5.4,3.5,6.5,6.9,8.3,16.7,5.4,25.5,3l9.9,31.4c-23.9,12.4-57.6,8.5-70.5-17.4-1.3-2.7-5.5-14.1-5.5-16.5v-65.5h-22.5c-.1,0-1.5-1.4-1.5-1.5v-30.5h24v-42h35.5c1.1,0,1.4,2.4,1.6,3.4,1,8.4.2,22.2,0,31.1s-2.1,7.5.5,7.5h33.5Z"/>
                <path fill="currentColor" d="M775,377v40.5c0,.1,1.4,1.5,1.5,1.5h32.5v32h-34v54.5c0,1.5,2.2,7.2,3.2,8.8,2.7,4.5,8.4,7.1,13.5,7.3s12.3-3.5,13.8-1.6c.3,5,10.3,27.7,9.4,30.4-1.6,5.3-29.9,7.1-35.3,6.5-20.5-2.3-40.6-22.4-40.6-43.4v-62.5h-23c.7-10.8-1.6-21.3,0-32h23v-42h36Z"/>
                <path fill="#f5761f" d="M382.8,411.3c17.1-1.9,35.3,10.6,37.2,28.2,3.1,28.8-2.1,63.4-.2,92.8-7.6,36.7-63,34.7-66.8-2.8-2.8-28.7,1.7-62.4.4-91.5,3.4-14.3,14.5-25,29.3-26.7Z"/>
                <rect fill="currentColor" x="1295" y="358" width="36" height="197"/>
                <path fill="#f5761f" d="M292.8,489.3c45.7-6.2,52.3,64.2,10.7,69.7-47.8,6.3-54.5-63.7-10.7-69.7Z"/>
                <path fill="#f5761f" d="M1241.8,508.2c27.2-3.2,36.6,37.3,11,47-33.5,12.7-46.8-42.7-11-47Z"/>
                <path fill="currentColor" d="M951,514.4c.2-34.7,9-78.2-31.3-94.6-25.6-10.4-63.6-6.3-83.7,13.6-1.7,1.7-6.8,7.4-5.5,9.6,1.9,3,19.5,12.2,23.1,16,2.5.3,9.4-7.3,12.8-9.2,19.8-11.3,51.7-4.3,49.7,23.2-20.6-7.5-43-10.1-63.7-1.2-24.5,10.6-34.1,39.3-21.5,62.9,11.2,21,39.1,28.3,61,21.6,9.7-3,17.4-10.1,24.2-17.3v16h35c-.5-3.9.9-7.6,1.1-11.5.3-9.4-1.1-19.7-1.1-29.1ZM911.8,515.3c-11.6,20.9-53.3,21.3-49.8-6.8,1.2-9.7,12.3-14.2,20.8-15.2,5.7-.7,31.2,1.6,33.1,7.4,1,3.1-2.4,11.6-4.1,14.6Z"/>
              </svg>
            </motion.div>

            {/* Texto acima dos avatares */}
            <motion.h3
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-center text-[11px] font-medium text-white/50 leading-relaxed"
            >
              Selecione o seu perfil para<br />personalizar a sua experiência no stats.lc.
            </motion.h3>

            {/* Avatares retangulares flutuantes */}
            <div
              className="flex justify-center gap-3 max-w-[92vw] overflow-x-auto overflow-y-visible overscroll-x-contain snap-x snap-mandatory custom-scrollbar px-2 pb-2 touch-auto scroll-smooth"
              style={{
                scrollPaddingLeft: '0.5rem',
                scrollPaddingRight: '0.5rem'
              }}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchMove={(e) => e.stopPropagation()}
            >
              {sortedMembers.map((u, idx) => (
                <motion.button
                  key={u.id}
                  onClick={() => {
                    onSelectUser(u.id);
                  }}
                  initial={{ opacity: 0, scale: 0.8, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.4 + idx * 0.05 }}
                  whileHover={{ scale: 1.05, y: -4 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative group flex-shrink-0 snap-center touch-manipulation"
                  style={{ minWidth: '64px' }}
                >
                  <motion.div
                    className={cn(
                      "absolute inset-0 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity",
                      featuredUserId === u.id ? "bg-orange-500/30 opacity-60" : "bg-orange-500/20"
                    )}
                  />
                  <div className={cn(
                    "relative rounded-2xl overflow-hidden w-[64px] h-32 transition-all shadow-lg",
                    featuredUserId === u.id && "ring-2 ring-orange-500/70"
                  )}>
                    <SmartImage
                      src={coreUtils.getUserAvatar(u.id, u.avatar)}
                      fallback={u.name}
                      className="h-full w-full object-cover"
                      rounded="none"
                    />
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Ícone de nota musical animado embaixo */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.8, 1, 0.8] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="text-orange-500 flex justify-center"
              >
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21,0-4,1.79-4,4s1.79,4,4,4,4-1.79,4-4V7h4V3h-6z"/>
                </svg>
              </motion.div>
            </motion.div>

            {/* Footer com powered by stats.fm */}
            <div className="text-center">
              <p className="text-[10px] font-medium text-white/30 tracking-wide">
                powered by stats.fm
              </p>
            </div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
