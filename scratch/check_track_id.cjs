const axios = require('axios');

async function checkNowPlayingId() {
  try {
    const response = await axios.get('https://statslc.leosaquetto.com/api/group');
    const leo = response.data.members.find(m => m.key === 'leo' || m.id === 'leo');
    
    if (leo && leo.nowPlaying && leo.nowPlaying.track) {
      console.log('--- Now Playing Track (leo) ---');
      console.log('ID:', leo.nowPlaying.track.id);
      console.log('Name:', leo.nowPlaying.track.name);
      console.log('Artists:', JSON.stringify(leo.nowPlaying.track.artists));
      console.log('Spotify ID:', leo.nowPlaying.track.spotifyId);
    } else {
      console.log('Leo não está ouvindo nada no momento ou agora o campo mudou.');
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkNowPlayingId();
