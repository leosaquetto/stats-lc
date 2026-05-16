const axios = require('axios');

async function checkLegacyItem() {
  try {
    const response = await axios.get('https://statslc.leosaquetto.com/api/user?user=leo');
    const item = response.data.legacy?.data?.item;
    if (item) {
      console.log('--- Chaves em legacy.data.item ---');
      console.log(Object.keys(item));
      if (item.tops) console.log('Tops encontrado em item.tops');
      if (item.stats) console.log('Stats encontrado em item.stats');
    } else {
      console.log('item não encontrado');
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkLegacyItem();
