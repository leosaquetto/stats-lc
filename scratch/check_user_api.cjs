const axios = require('axios');

async function checkUserApi() {
  try {
    const response = await axios.get('https://statslc.leosaquetto.com/api/user?user=leo');
    console.log('--- Top Items do Usuário (leo) ---');
    
    if (response.data.tops) {
      console.log('Artistas encontrados:', response.data.tops.artists?.length || 0);
      console.log('Faixas encontradas:', response.data.tops.tracks?.length || 0);
      
      if (response.data.tops.tracks && response.data.tops.tracks.length > 0) {
        console.log('\nExemplo da primeira faixa:');
        console.log(JSON.stringify(response.data.tops.tracks[0], null, 2));
      }
    } else {
      console.log('Objeto "tops" não encontrado na resposta.');
    }
  } catch (error) {
    console.error('Erro ao acessar API do usuário:', error.message);
  }
}

checkUserApi();
