const axios = require('axios');

async function checkUserKeys() {
  try {
    const response = await axios.get('https://statslc.leosaquetto.com/api/user?user=leo');
    console.log('--- Chaves da Resposta (/api/user) ---');
    console.log(Object.keys(response.data));
    
    if (response.data.topTracks) console.log('topTracks encontrado');
    if (response.data.topArtists) console.log('topArtists encontrado');
    if (response.data.topAlbums) console.log('topAlbums encontrado');
    
    // Verificando se os tops estão dentro de algum outro campo
    for (const key of Object.keys(response.data)) {
      if (response.data[key] && typeof response.data[key] === 'object') {
        if (response.data[key].tops || response.data[key].tracks) {
          console.log(`Encontrado possível container de tops na chave: ${key}`);
        }
      }
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkUserKeys();
