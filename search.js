const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const fileName = 'data_fixed.js';
const filePath = path.join(__dirname, fileName);

if (!fs.existsSync(filePath)) {
    console.error(`❌ 파일을 찾을 수 없습니다: ${fileName}`);
    process.exit(1);
}

const keyword = process.argv[2];
if (!keyword) {
    console.log('❌ 검색어를 입력해주세요.');
    process.exit(0);
}

// 대소문자 구분 없는 검색을 위해 키워드를 미리 소문자로 변환
const lowerKeyword = keyword.toLowerCase();

try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const objects = content.match(/\{[\s\S]*?\}(?:,)?/g);

    if (!objects) {
        console.log('⚠️ 데이터를 찾을 수 없습니다.');
    } else {
        let count = 0;
        let copyText = "";

        objects.forEach((objText) => {
            // 원본 텍스트를 소문자로 변환한 뒤 키워드가 포함되어 있는지 확인
            if (objText.toLowerCase().includes(lowerKeyword)) {
                count++;
                const trimmedObj = objText.trim();
                
                console.log(trimmedObj);
                console.log('---');

                copyText += trimmedObj + "\n---\n";
            }
        });

        if (count === 0) {
            console.log('결과가 없습니다.');
        } else {
          
                  // 3. 변수 선언과 Export를 명시적으로 결합
            const finalFileContent = copyText;
            
            if (fs.existsSync('./result.txt')) {
                fs.unlinkSync('./result.txt');
            }
            
            fs.writeFileSync('./result.txt', finalFileContent, 'utf8');
            console.log(`✅ result.txt 생성 완료!  총 ${count} 문제`);
        }
    }
} catch (err) {
    console.error('오류 발생:', err.message);
}