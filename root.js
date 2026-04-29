import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data_fixed.js');
const outputPath = path.join(process.cwd(), 'data_fixed_updated.js');

try {
    const content = fs.readFileSync(filePath, 'utf8');
    const mainRegex = /main:\s*(['"]?)(.*?)\1\s*,/g;
    const allMains = [];
    let match;
    while ((match = mainRegex.exec(content)) !== null) {
        allMains.push(match[2]);
    }

    const uniqueMains = [...new Set(allMains)];

    /**
     * 1. [핵심] 우선순위 키워드 정의
     * '대상', '이익' 보다 '과세', '소득'이 먼저 뿌리가 되도록 강제합니다.
     */
    const priorityKeywords = [
        '과세', '소득', '지수', '보험', '세율', '수익', '리스크', 
        '채권', '주식', '펀드', '금리', '비율', '계산', '양도', '배당'
    ];

    // 2. 모든 2~4글자 조각 빈도수 계산
    const fragmentMap = {};
    uniqueMains.forEach(word => {
        for (let len = 2; len <= 4; len++) {
            for (let i = 0; i <= word.length - len; i++) {
                const fragment = word.substring(i, i + len);
                fragmentMap[fragment] = (fragmentMap[fragment] || 0) + 1;
            }
        }
    });

    // 3. 자석 리스트 생성 (빈도수 기반)
    const sortedMagnets = Object.keys(fragmentMap)
        .filter(f => {
            if (/^[A-Za-z]{2}$/.test(f)) return false; // 영문 2자 파편 제외
            return fragmentMap[f] >= 2;
        })
        .sort((a, b) => {
            if (fragmentMap[b] !== fragmentMap[a]) return fragmentMap[b] - fragmentMap[a];
            return b.length - a.length;
        });

    /**
     * 4. 뿌리 결정 함수
     */
    const findPriorityRoot = (word, magnets) => {
        // [규칙 1] 영문 고유 약어 보호 (FTSE 등)
        if (/^[A-Za-z]/.test(word) && word.length <= 6) return word;

        // [규칙 2] 우선순위 키워드가 포함되어 있다면 즉시 해당 키워드를 뿌리로 확정
        // 예: '종합과세대상' -> '과세' (빈도수 무관하게 우선권)
        for (const priority of priorityKeywords) {
            if (word.includes(priority)) return priority;
        }

        // [규칙 3] 우선순위에 없는 경우, 빈도수 높은 자석 매칭
        const bestMagnet = magnets.find(m => word.includes(m));
        return bestMagnet || word;
    };

    // 5. 전체 매핑 생성
    const rootMap = {};
    uniqueMains.forEach(m => {
        rootMap[m] = findPriorityRoot(m, sortedMagnets);
    });

    // 6. 파일 치환
    const updatedContent = content.replace(mainRegex, (match, quote, currentValue) => {
        const root = rootMap[currentValue] || currentValue;
        return `main: ${quote}${root}${quote},`;
    });

    fs.writeFileSync(outputPath, updatedContent, 'utf8');

    const finalRoots = [...new Set(Object.values(rootMap))];
    const rate = ((1 - finalRoots.length / uniqueMains.length) * 100).toFixed(1);

    console.log("=========================================");
    console.log(`✅ 우선순위 기반 압축 완료!`);
    console.log(`- 원본 키워드: ${uniqueMains.length}개`);
    console.log(`- 압축된 뿌리: ${finalRoots.length}개`);
    console.log(`- 압축률: ${rate}%`);
    console.log("=========================================");

    // 검증 출력
    const tests = ["종합과세대상", "분리과세대상", "이자소득", "배당소득", "FTSE지수"];
    tests.forEach(t => console.log(`   ${t} -> ${rootMap[t]}`));

} catch (error) {
    console.error("❌ 에러:", error.message);
}