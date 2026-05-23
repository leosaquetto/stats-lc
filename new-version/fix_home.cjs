const fs = require('fs');
let t = fs.readFileSync('src/screens/HomeScreen.tsx', 'utf8');
t = t.replace(/\`\$\{primaryUser\.name\}'s Circle Live\`/, '\`\${primaryUser.name.split(\' \')[0]}\'s Circle Live\`');
fs.writeFileSync('src/screens/HomeScreen.tsx', t);
