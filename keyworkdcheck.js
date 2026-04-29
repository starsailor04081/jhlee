const rawData = require('./refactor.js');

/**
 * 모든 공백을 제거하는 함수
 */
const removeSpace = (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/\s+/g, '');
};

// 1. 데이터 배열 추출 로직
let data = [];
if (Array.isArray(rawData)) {
    data = rawData;
} else if (rawData && typeof rawData === 'object') {
    const possibleArray = Object.values(rawData).find(val => Array.isArray(val));
    data = possibleArray ? possibleArray : [rawData];
}

function startValidation() {
    console.log(`🔍 띄어쓰기를 제외한 키워드 검사를 시작합니다. (총 ${data.length}개 항목)\n`);
    let errorCount = 0;

    data.forEach((item, index) => {
        const lineNum = index + 1;
        
        // 필드명 유연하게 대응 (sentense 또는 sentence)
        const originalText = item.sentense || item.sentence;
        const main = item.main;
        const sub = item.sub;

        // 필수 데이터 체크
        if (!originalText || main === undefined || !Array.isArray(sub)) {
            console.log(`⚠️ [${lineNum}번째] 데이터 구조가 올바르지 않아 건너뜁니다.`);
            return;
        }

        // [핵심] 비교를 위해 문장과 키워드에서 모든 공백 제거
        const cleanText = removeSpace(originalText);
        const cleanMain = removeSpace(main);

        const missingSub = [];

        // 1. main 검사 (공백 없이)
        const isMainValid = cleanText.includes(cleanMain);

        // 2. sub 검사 (공백 없이)
        sub.forEach(word => {
            if (!cleanText.includes(removeSpace(word))) {
                missingSub.push(word);
            }
        });

        // 결과 출력
        if (!isMainValid || missingSub.length > 0) {
            errorCount++;
            console.log(`❌ [${lineNum}번째 항목] 불일치 발견!`);
            if (!isMainValid) {
                console.log(`   - [main] 없음: "${main}"`);
            }
            if (missingSub.length > 0) {
                console.log(`   - [sub] 없음: ${JSON.stringify(missingSub)}`);
            }
            console.log(`   - 실제 문장: "${originalText.substring(0, 50)}..."`);
            console.log("-".repeat(50));
        }
    });

    if (errorCount === 0) {
        console.log("✅ 검사 완료: 띄어쓰기에 관계없이 모든 키워드가 포함되어 있습니다.");
    } else {
        console.log(`\n⚠️ 검사 완료: 총 ${errorCount}개의 오류를 발견했습니다.`);
    }
}

startValidation();