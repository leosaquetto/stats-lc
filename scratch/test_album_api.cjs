const axios = require('axios');

async function testAlbumStats() {
  try {
    // Usando o albumId 66398886 que acabamos de encontrar
    const url = 'https://statslc.leosaquetto.com/api/entity-stats?user=leo&type=album&id=66398886';
    console.log('Testando URL:', url);
    const response = await axios.get(url);
    console.log('Resposta da API:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Erro ao chamar API:', error.response?.data || error.message);
  }
}

testAlbumStats();
