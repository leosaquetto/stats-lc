const fs = require('fs');

const fixFile = (file) => {
    let text = fs.readFileSync(file, 'utf8');
    text = text.replace(/userId \|\| "leo"/g, '"leo"'); // Undo my bad regex
    text = text.replace(/\{id: "leo", name: "Leo"\}/g, '{id: "leo", name: "Leo", color: "#FF9F0A"}');
    
    // In StatsService, `const userParam = "leo";` will be wrong if it was replacing `GROUP_USERS.LEO.id === userId ? ...`.
    fs.writeFileSync(file, text);
};

['src/components/MusicUI.tsx', 'src/screens/HomeScreen.tsx', 'src/screens/RankingScreen.tsx', 'src/screens/StatsScreen.tsx'].forEach(fixFile);

// For statsService.ts:
let svc = fs.readFileSync('src/services/statsService.ts', 'utf8');
svc = svc.replace(/const userParam = userId \|\| "leo"/g, 'const userParam = userId');
fs.writeFileSync('src/services/statsService.ts', svc);
