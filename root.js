import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data_fixed.js');
const outputPath = path.join(process.cwd(), 'data_fixed_updated.js');

try {
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. 모든 main 키워드 추출
    const mainRegex = /main:\s*(['"]?)(.*?)\1\s*,/g;
    const allMains = [];
    let match;
    while ((match = mainRegex.exec(content)) !== null) {
        allMains.push(match[2]);
    }

    /**
     * 2. 역순(Length--) 기반 뿌리 추출 로직
     * 가장 긴 접두사부터 검사하여 최소 2회 이상 중복되는 2글자 이상의 단어를 찾습니다.
     */
    const findRootByReduction = (word, allWords) => {
        // 최소 2글자까지만 검사 (i >= 2)
        // word.length부터 시작해서 1씩 줄여가며(i--) 탐색
        for (let i = word.length; i >= 2; i--) {
            const prefix = word.substring(0, i);
            
            // 현재 접두사로 시작하는 단어가 전체 데이터에 몇 개 있는지 확인
            const count = allWords.filter(w => w.startsWith(prefix)).length;
            
            // 2개 이상의 단어가 이 접두사를 공유한다면, 이것이 가장 긴 뿌리(Root)임
            if (count >= 2) {
                return prefix;
            }
        }
        // 끝까지 중복이 없거나 2글자 미만이면 원본 유지
        return word;
    };

    // 3. 중복 계산을 피하기 위해 고유값 추출 및 매핑
    const uniqueMains = [...new Set(allMains)];
    const rootMap = {};

    console.log("🔍 뿌리 분석 중...");
    uniqueMains.forEach(m => {
        rootMap[m] = findRootByReduction(m, allMains);
    });

    /**
     * 4. 실제 파일 내용 치환
     */
    const updatedContent = content.replace(mainRegex, (match, quote, currentValue) => {
        const root = rootMap[currentValue] || currentValue;
        return `main: ${quote}${root}${quote},`;
    });

    fs.writeFileSync(outputPath, updatedContent, 'utf8');

    console.log("=========================================");
    console.log("✅ 역순 탐색 기반 뿌리 치환 완료!");
    console.log(`- 결과 파일: ${outputPath}`);
    console.log("=========================================");
    
    // 검증 출력
    const examples = [
        "금융투자업의인가",
        "금융투자협회",
        "금융소득종합과세",
        "금융소득"
    ];
    
    console.log("💡 치환 결과 샘플:");
    examples.forEach(ex => {
        if(rootMap[ex]) console.log(`   ${ex} -> ${rootMap[ex]}`);
    });

} catch (error) {
    console.error("❌ 실행 에러:", error.message);
}