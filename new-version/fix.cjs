const fs = require('fs');

const fixFile = (file) => {
    let text = fs.readFileSync(file, 'utf8');
    text = text.replace(/GROUP_USERS\.LEO\.id( === userId \? 'leo' : userId)?/g, 'userId || "leo"');
    text = text.replace(/GROUP_USERS\.LEO\.id/g, '"leo"');
    text = text.replace(/Object\.values\(GROUP_USERS\)/g, '([] as any[])');
    text = text.replace(/GROUP_USERS\.LEO/g, '({id: "leo", name: "Leo"})');
    text = text.replace(/u\.role \|\| "Membro"/g, '"Membro"');
    fs.writeFileSync(file, text);
};

['src/components/MusicUI.tsx', 'src/screens/HomeScreen.tsx', 'src/screens/RankingScreen.tsx', 'src/screens/StatsScreen.tsx', 'src/services/statsService.ts'].forEach(fixFile);
