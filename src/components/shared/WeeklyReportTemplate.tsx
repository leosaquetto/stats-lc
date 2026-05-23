import React from 'react';
import { SmartImage } from './CommonUI';

interface WeeklyReportTemplateProps {
  userName: string;
  userAvatar?: string;
  topArtists: any[];
  topTracks: any[];
  topAlbums: any[];
  arenaName?: string;
}

export const WeeklyReportTemplate: React.FC<WeeklyReportTemplateProps> = ({
  userName,
  userAvatar,
  topArtists,
  topTracks,
  topAlbums,
  arenaName
}) => {
  return (
    <div id="weekly-report-capture" className="w-[1080px] h-[1920px] bg-black p-20 flex flex-col gap-12 font-sans overflow-hidden text-white relative">
        {/* Abstract Background pattern */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-orange-500/10 blur-[120px] rounded-full -mr-40 -mt-40 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-blue-500/10 blur-[100px] rounded-full -ml-40 -mb-40" />

        {/* Header */}
        <div className="flex items-center gap-10 border-b border-white/10 pb-16 z-10">
            <div className="relative h-44 w-44 min-w-44">
                <div className="absolute inset-0 bg-orange-500 blur-2xl opacity-30 rounded-full" />
                <SmartImage src={userAvatar} className="h-full w-full rounded-full border-4 border-white/20 shadow-2xl relative z-10" fallback={userName} />
            </div>
            <div className="flex flex-col gap-4 w-full">
                <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-2.5 bg-orange-500 rounded-full" />
                        <span className="text-orange-500 font-black text-3xl uppercase tracking-[0.3em] font-display">Relatório Semanal</span>
                    </div>
                    {arenaName && (
                        <div className="px-6 py-2 rounded-full border-2 border-orange-500/30 bg-orange-500/10">
                            <span className="text-orange-500 font-black text-2xl uppercase tracking-widest">{arenaName}</span>
                        </div>
                    )}
                </div>
                <h1 className="text-8xl font-black uppercase tracking-tighter leading-none font-display truncate">{userName}</h1>
                <span className="text-white/40 text-2xl font-bold uppercase tracking-[0.4em] mt-2">Stats.fm x Apple Music • {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</span>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col gap-24 z-10 mt-10">
            {/* Top Artists */}
            <div className="flex flex-col gap-10">
                <div className="flex items-center justify-between">
                    <h2 className="text-5xl font-black uppercase text-white tracking-tight flex items-center gap-6 font-display">
                        <span className="text-orange-500 opacity-50">01.</span> Top Artistas
                    </h2>
                </div>
                <div className="grid grid-cols-3 gap-12">
                    {topArtists.slice(0, 3).map((artist, idx) => (
                        <div key={`artist-${artist.id || idx}`} className="flex flex-col items-center gap-8 glass-card p-10 bg-white/5 border-white/10 rounded-[60px] shadow-2xl">
                            <div className="relative h-72 w-72">
                                <div className="absolute -inset-2 bg-gradient-to-tr from-orange-500 to-amber-200 rounded-full opacity-20 blur-xl" />
                                <SmartImage src={artist.image || artist.artist?.image || '/placeholder-artist.jpg'} className="h-full w-full rounded-full border-4 border-white/10 relative z-10" fallback="" />
                                <div className="absolute -bottom-4 -right-4 h-20 w-20 bg-orange-500 rounded-full flex items-center justify-center text-black font-black text-4xl shadow-xl z-20 font-display">
                                    {idx + 1}
                                </div>
                            </div>
                            <div className="text-center flex flex-col gap-2">
                                <p className="text-4xl font-black uppercase tracking-tight line-clamp-1 font-display">{artist.name}</p>
                                <div className="flex flex-col">
                                    <span className="text-4xl font-black text-orange-500 leading-none font-display">{artist.playcount || artist.streams}</span>
                                    <span className="text-lg font-black text-white/20 uppercase tracking-widest">SCROBBLES</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Top Tracks */}
            <div className="flex flex-col gap-10">
                <h2 className="text-5xl font-black uppercase text-white tracking-tight flex items-center gap-6 font-display">
                    <span className="text-orange-500 opacity-50">02.</span> Top Músicas
                </h2>
                <div className="grid grid-cols-3 gap-12">
                    {topTracks.slice(0, 3).map((track, idx) => (
                        <div key={`track-${track.id || idx}`} className="flex flex-col items-center gap-8 glass-card p-10 bg-white/5 border-white/10 rounded-[60px] shadow-2xl">
                            <div className="relative h-72 w-72">
                                <div className="absolute -inset-2 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-[60px] opacity-20 blur-xl" />
                                <SmartImage src={track.image || track.album?.image || '/placeholder-music.jpg'} className="h-full w-full rounded-[60px] border-4 border-white/10 relative z-10" fallback="" />
                                <div className="absolute -bottom-4 -right-4 h-20 w-20 bg-white rounded-full flex items-center justify-center text-black font-black text-4xl shadow-xl z-20 font-display">
                                    {idx + 1}
                                </div>
                            </div>
                            <div className="text-center flex flex-col gap-2">
                                <p className="text-4xl font-black uppercase tracking-tight line-clamp-1 font-display">{track.name}</p>
                                <p className="text-xl font-bold text-white/40 uppercase tracking-widest line-clamp-1">{track.artist?.name}</p>
                                <div className="flex flex-col mt-2">
                                    <span className="text-4xl font-black text-orange-500 leading-none font-display">{track.playcount || track.streams}</span>
                                    <span className="text-lg font-black text-white/20 uppercase tracking-widest">PLAYS</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

             {/* Top Albums */}
             <div className="flex flex-col gap-10">
                <h2 className="text-5xl font-black uppercase text-white tracking-tight flex items-center gap-6 font-display">
                    <span className="text-orange-500 opacity-50">03.</span> Top Álbuns
                </h2>
                <div className="grid grid-cols-3 gap-12">
                    {topAlbums.slice(0, 3).map((album, idx) => (
                        <div key={`album-${album.id || idx}`} className="flex flex-col items-center gap-8 glass-card p-10 bg-white/5 border-white/10 rounded-[60px] shadow-2xl">
                             <div className="relative h-72 w-72">
                                <div className="absolute -inset-2 bg-gradient-to-tr from-green-500 to-teal-500 rounded-[60px] opacity-20 blur-xl" />
                                <SmartImage src={album.image || album.album?.image || '/placeholder-music.jpg'} className="h-full w-full rounded-[60px] border-4 border-white/10 relative z-10" fallback="" />
                                <div className="absolute -bottom-4 -right-4 h-20 w-20 bg-orange-500 rounded-full flex items-center justify-center text-black font-black text-4xl shadow-xl z-20 font-display">
                                    {idx + 1}
                                </div>
                            </div>
                            <div className="text-center flex flex-col gap-2">
                                <p className="text-4xl font-black uppercase tracking-tight line-clamp-1 font-display">{album.name}</p>
                                <p className="text-xl font-bold text-white/40 uppercase tracking-widest line-clamp-1">{album.artist?.name}</p>
                                <div className="flex flex-col mt-2">
                                    <span className="text-4xl font-black text-orange-500 leading-none font-display">{album.playcount || album.streams}</span>
                                    <span className="text-lg font-black text-white/20 uppercase tracking-widest">SCROBBLES</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-20 border-t border-white/10 flex justify-between items-end z-10">
            <div className="flex flex-col gap-4">
                <div className="flex items-center gap-6">
                    <div className="h-16 w-16 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                        <svg viewBox="0 0 24 24" className="h-10 w-10 text-black fill-current"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                    </div>
                    <span className="text-7xl font-black tracking-tighter uppercase">Stats.lc</span>
                </div>
                <span className="text-2xl font-bold text-white/20 uppercase tracking-[0.8em] pl-2">Music Legacy Engine</span>
            </div>
            <div className="flex flex-col items-end gap-2">
                <div className="text-right">
                    <p className="text-4xl font-black text-white uppercase tracking-tight">Gerado via AI Studio</p>
                    <p className="text-2xl font-bold text-white/30 uppercase tracking-widest">stats-fm.vercel.app</p>
                </div>
            </div>
        </div>
    </div>
  );
};
