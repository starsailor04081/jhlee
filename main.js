

const fs = require('fs');
const path = require('path');

// 1. 파일 읽기 (data_fixed.js 내용 전체를 문자열로 가져옴)
const filePath = path.join(__dirname, 'data_fixed_updated.js');

try {
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // 2. 정규표현식을 사용하여 main: '키워드' 패턴 추출
    // main: 이후의 작은따옴표(')나 큰따옴표(") 사이의 문자를 찾습니다.
    const regex = /main:\s*['"](.+?)['"]/g;
    let match;
    const keywords = [];

    while ((match = regex.exec(fileContent)) !== null) {
        keywords.push(match[1]);
    }

    // 3. Set을 이용한 중복 제거 및 가나다순 정렬
    const uniqueKeywords = [...new Set(keywords)].sort();
    let kwF = '';

    // 4. 터미널 출력
    console.log('\n🚀 [data_fixed.js] Main 키워드 추출 결과');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (uniqueKeywords.length === 0) {
        console.log('❌ 추출된 키워드가 없습니다. 파일 형식을 확인하세요.');
    } else {
        uniqueKeywords.forEach((kw, idx) => {
            // console.log(`${String(idx + 1).padStart(2, '0')}. ${kw}`);
            kwF += `${String(idx + 1).padStart(2, '0')}. ${kw}\n`
        });
        

        // 3. 변수 선언과 Export를 명시적으로 결합
        const finalFileContent = kwF;
        
        if (fs.existsSync('./data_main.txt')) {
            fs.unlinkSync('./data_main.txt');
        }
        
        fs.writeFileSync('./data_main.txt', finalFileContent, 'utf8');
        console.log('✅ data_main.txt 생성 완료!');

        // console.log(kwF);
        // console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // console.log(`✅ 총 ${uniqueKeywords.length}개의 고유 키워드 발견!\n`);
    }

} catch (err) {
    console.error('파일을 읽는 중 오류가 발생했습니다:', err.message);
}