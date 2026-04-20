const fs = require('fs');

// 1. 원본 읽기
const rawData = fs.readFileSync('./data.js', 'utf8');

const wrap = (val) => {
    const s = val.trim();
    if (!s) return "''";
    if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) return s;
    return `'${s}'`;
};

// 2. 가공 (중요: 기존에 있을지 모르는 const que = 이나 export 문구 제거)
let cleanContent = rawData
    .replace(/export\s+default\s+que\s*=\s*/g, '')
    .replace(/export\s+default\s*/g, '')
    .replace(/const\s+que\s*=\s*/g, '')
    .trim();

// 배열의 시작과 끝인 [ ] 만 남기기 위해 정리
if (cleanContent.endsWith(';')) cleanContent = cleanContent.slice(0, -1);

const lines = cleanContent.split('\n');
const fixedLines = lines.map(line => {
    let l = line.trim();
    if (l.includes('sentense:')) return line;
    if (l.includes('main:')) return line.replace(/main\s*:\s*([^,]+)/, (m, p1) => `main: ${wrap(p1)}`);
    if (l.includes('sub:')) {
        return line.replace(/sub\s*:\s*\[([^\]]+)\]/, (m, p1) => {
            const items = p1.split(',').map(i => wrap(i)).join(', ');
            return `sub: [${items}]`;
        });
    }
    return line;
});

// 3. 변수 선언과 Export를 명시적으로 결합
const finalFileContent = `const que = ${fixedLines.join('\n')};\n\nexport { que };`;

fs.writeFileSync('./data_fixed.js', finalFileContent, 'utf8');
console.log('✅ data_fixed.js 생성 완료! (변수 que 선언 포함)');