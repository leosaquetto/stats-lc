const axios = require('axios');

async function checkNestedKeys() {
  try {
    const response = await axios.get('https://statslc.leosaquetto.com/api/user?user=leo');
    console.log('--- Chaves em response.data.user ---');
    if (response.data.user) console.log(Object.keys(response.data.user));
    
    console.log('\n--- Chaves em response.data.legacy ---');
    if (response.data.legacy) console.log(Object.keys(response.data.legacy));

    // Verificando se tops está em algum lugar mais profundo
    const findKey = (obj, target) => {
      if (!obj || typeof obj !== 'object') return;
      if (obj[target]) {
        console.log(`\n>>> ENCONTRADO '${target}'!`);
        return;
      }
      for (const key of Object.keys(obj)) {
        findKey(obj[key], target);
      }
    }
    findKey(response.data, 'tops');
    findKey(response.data, 'stats');
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkNestedKeys();
