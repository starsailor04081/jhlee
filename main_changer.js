import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'data_fixed.js');
const outputPath = path.join(process.cwd(), 'data_fixed_updated.js');

try {
    console.log("🚀 객체 조립 방식 리팩터 시작...");
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. 객체 단위로 정확히 쪼개기
    // { ... } 구조를 하나씩 추출합니다.
    const entryRegex = /\{[\s\S]*?\}/g;
    const entries = content.match(entryRegex);

    if (!entries) throw new Error("데이터를 찾을 수 없습니다.");

    const updatedEntries = entries.map(entry => {
        // 2. 현재 객체 내에서 sentence와 main 추출
        const sentenceMatch = entry.match(/senten[sc]e:\s*['"`](.*?)['"`]/);
        const mainMatch = entry.match(/main:\s*['"`](.*?)['"`]/);

        if (!sentenceMatch || !mainMatch) return entry; // 형식이 안 맞으면 패스

        const sentence = sentenceMatch[1];
        const oldMain = mainMatch[1];
        let newMain = oldMain;

        // 3. 문장 앞부분에서 키워드 추출 로직
        const head = sentence.substring(0, 25).trim();
        const separators = [':', '란 ', '이란 ', '은 ', '는 ', '이 ', '가 '];

        for (const sep of separators) {
            if (head.includes(sep)) {
                const extracted = head.split(sep)[0].trim();
                // 2자 이상 12자 이하, 특수기호 없는 깨끗한 단어만 인정
                if (extracted.length >= 2 && extracted.length <= 12 && !/[<>\[\](){}]/.test(extracted)) {
                    newMain = extracted;
                    break;
                }
            }
        }

        // 4. [핵심] 현재 객체(entry) 텍스트 내부에서만 main을 교체
        // g 플래그 없이 replace를 써서 해당 객체의 첫 번째 main만 바꿈
        return entry.replace(/main:\s*['"`].*?['"`]/, `main: '${newMain}'`);
    });

    // 5. 파일 재구성
    const finalFileContent = `const data = [\n${updatedEntries.join(',\n')}\n];\n\nexport default data;`;
    fs.writeFileSync(outputPath, finalFileContent, 'utf8');

    console.log("=========================================");
    console.log("✅ 객체 단위 정밀 리팩토링 완료!");
    console.log(`- 결과 파일: ${outputPath}`);
    console.log("=========================================");

} catch (error) {
    console.error("❌ 에러 발생:", error.message);
}