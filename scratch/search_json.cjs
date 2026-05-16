const axios = require('axios');

async function searchInJson() {
  try {
    const response = await axios.get('https://statslc.leosaquetto.com/api/user?user=leo');
    const jsonString = JSON.stringify(response.data);
    
    console.log('Tamanho da resposta:', jsonString.length);
    console.log('Contém "artists":', jsonString.includes('artists'));
    console.log('Contém "tracks":', jsonString.includes('tracks'));
    console.log('Contém "tops":', jsonString.includes('tops'));
    console.log('Contém "stats":', jsonString.includes('stats'));

    if (jsonString.includes('artists')) {
        // Tenta encontrar onde está
        function findPath(obj, target, path = 'root') {
            if (!obj || typeof obj !== 'object') return;
            if (Array.isArray(obj)) {
                obj.forEach((item, i) => findPath(item, target, `${path}[${i}]`));
            } else {
                for (const key of Object.keys(obj)) {
                    if (key === target) {
                        console.log(`Encontrado alvo '${target}' em: ${path}.${key}`);
                    }
                    findPath(obj[key], target, `${path}.${key}`);
                }
            }
        }
        findPath(response.data, 'artists');
        findPath(response.data, 'tracks');
        findPath(response.data, 'tops');
        findPath(response.data, 'stats');
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

searchInJson();
