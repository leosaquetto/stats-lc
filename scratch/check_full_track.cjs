const axios = require('axios');

async function checkFullTrackData() {
  try {
    const response = await axios.get('https://statslc.leosaquetto.com/api/group');
    const leo = response.data.members.find(m => m.key === 'leo' || m.id === 'leo');
    
    if (leo && leo.nowPlaying && leo.nowPlaying.track) {
      console.log('--- Objeto Track Completo (leo) ---');
      console.log(JSON.stringify(leo.nowPlaying.track, null, 2));
    } else {
      console.log('Dados não encontrados.');
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkFullTrackData();
