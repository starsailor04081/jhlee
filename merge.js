import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'data_fixed_updated.js');
const outputPath = path.join(process.cwd(), 'data_final_que.js');

try {
    console.log("🚀 데이터 분석 시작...");
    const content = fs.readFileSync(inputPath, 'utf8');
    
    // 데이터를 한 줄씩 쪼개서 처리 (정규표현식 과부하 방지)
    const lines = content.split('\n');
    const groupMap = new Map();

    let currentMain = '';
    let currentSentence = '';

    console.log("🔍 라인별 스캐닝 중...");

    for (let line of lines) {
        // main 추출
        if (line.includes('main:')) {
            currentMain = line.split('main:')[1].split(',')[0].replace(/['"`,]/g, '').trim();
        }
        // sentense 또는 sentence 추출
        if (line.includes('sentense:') || line.includes('sentence:')) {
            const key = line.includes('sentense:') ? 'sentense:' : 'sentence:';
            currentSentence = line.split(key)[1].split(',')[0].replace(/['"`]/g, '').trim();
        }

        // 한 객체의 정보가 다 모였을 때 (sub: 가 보통 마지막에 오므로 이를 기준으로 병합)
        if (line.includes('sub:') && currentMain && currentSentence) {
            if (!groupMap.has(currentMain)) {
                groupMap.set(currentMain, new Set());
            }
            groupMap.get(currentMain).add(currentSentence);
            
            // 다음 객체를 위해 초기화
            currentMain = '';
            currentSentence = '';
        }
    }

    // 2. 결과물 생성
    console.log("📦 데이터 병합 및 파일 생성 중...");
    const queEntries = [];
    for (const [main, sentences] of groupMap.entries()) {
        const mergedSentence = Array.from(sentences).join(' | ');
        // 작은따옴표 이스케이프 처리 (데이터 내부에 ' 가 있을 경우 대비)
        const safeSentence = mergedSentence.replace(/'/g, "\\'");
        queEntries.push(`  { sentence: '${safeSentence}' }`);
    }

    const finalFileContent = `const que = [\n${queEntries.join(',\n')}\n];\n\nexport default que;`;
    fs.writeFileSync(outputPath, finalFileContent, 'utf8');

    console.log("-----------------------------------------");
    console.log(`✅ 완료! 총 ${groupMap.size}개의 그룹으로 병합되었습니다.`);
    console.log(`📂 저장 위치: ${outputPath}`);
    console.log("-----------------------------------------");

} catch (error) {
    console.error("❌ 에러 발생:", error.message);
}