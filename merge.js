import fs from 'fs';
import path from 'path';

const inputPath = path.join(process.cwd(), 'data_fixed_updated.js');
const outputPath = path.join(process.cwd(), 'data_final_que.js');

try {
    console.log("🚀 데이터 병합 분석 시작...");
    const content = fs.readFileSync(inputPath, 'utf8');

    // 1. 객체 단위로 완전히 분리 ({ ... })
    // [수정] 비탐욕적 매칭을 통해 각 객체를 개별적으로 완벽히 쪼갭니다.
    const entryRegex = /\{[\s\S]*?\}/g;
    const allEntries = content.match(entryRegex);

    if (!allEntries) {
        throw new Error("데이터 객체를 찾을 수 없습니다. 형식을 확인하세요.");
    }

    const groupMap = new Map();
    const originalMainNameMap = new Map();
    let totalCount = 0;

    console.log(`🔍 총 ${allEntries.length}개의 객체 분석 중...`);

    allEntries.forEach(entry => {
        // [수정] 객체 내부에서 main과 sentence를 개별적으로 추출 (순서 상관 없음)
        const mainMatch = entry.match(/main:\s*['"`](.*?)['"`]/);
        // 'sentence'와 'sentense' 오타 모두 대응
        const sentenceMatch = entry.match(/senten[sc]e:\s*['"`](.*?)['"`]/);

        if (mainMatch && sentenceMatch) {
            const rawMain = mainMatch[1];
            const sentence = sentenceMatch[1].trim();

            // 비교용 키 (대소문자/공백 무시)
            const mergeKey = rawMain.toLowerCase().replace(/\s+/g, '').trim();

            if (!groupMap.has(mergeKey)) {
                groupMap.set(mergeKey, new Set());
                originalMainNameMap.set(mergeKey, rawMain.trim());
            }

            groupMap.get(mergeKey).add(sentence);
            totalCount++;
        }
    });

    // 2. 결과물 생성
    const queEntries = [];
    for (const [key, sentences] of groupMap.entries()) {
        const mergedSentence = Array.from(sentences).join(' | ');
        const representativeName = originalMainNameMap.get(key);

        // 특수문자 및 줄바꿈 안전 처리
        const safeSentence = mergedSentence
            .replace(/\\/g, "\\\\")
            .replace(/'/g, "\\'")
            .replace(/\r?\n|\r/g, " ")
            .replace(/\s+/g, " ");

        queEntries.push(`  { 
    /* root: ${representativeName} */
    sentence: '${safeSentence}' 
  }`);
    }

    const finalFileContent = `const que = [\n${queEntries.join(',\n')}\n];\n\nexport default que;`;
    fs.writeFileSync(outputPath, finalFileContent, 'utf8');

    console.log("-----------------------------------------");
    console.log(`✅ 병합 완료!`);
    console.log(`- 읽어온 총 객체: ${allEntries.length}개`);
    console.log(`- 실제 병합된 데이터: ${totalCount}개`);
    console.log(`- 생성된 그룹: ${groupMap.size}개`);
    console.log(`📂 결과 확인: ${outputPath}`);
    console.log("-----------------------------------------");

} catch (error) {
    console.error("❌ 에러 발생:", error.message);
}