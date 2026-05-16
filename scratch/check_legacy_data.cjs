const axios = require('axios');

async function checkLegacyData() {
  try {
    const response = await axios.get('https://statslc.leosaquetto.com/api/user?user=leo');
    if (response.data.legacy && response.data.legacy.data) {
      console.log('--- Chaves em response.data.legacy.data ---');
      const data = response.data.legacy.data;
      console.log(Object.keys(data));
      
      if (data.tops) {
        console.log('\n--- Chaves em data.tops ---');
        console.log(Object.keys(data.tops));
        if (data.tops.tracks) console.log('Tracks encontradas:', data.tops.tracks.length);
        if (data.tops.artists) console.log('Artists encontradas:', data.tops.artists.length);
      }
    } else {
      console.log('legacy.data não encontrado');
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkLegacyData();
