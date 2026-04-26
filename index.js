import { que } from './data_fixed.js';

/**
 * 1. 전역 변수 및 요소 설정
 */
const mainContainer = document.querySelector('.main');
const qCardTemplate = document.querySelector('.q-card');
const resetAllBtn = document.querySelector('.reset'); 

const scoreG = document.querySelector('.dot.g + span');
const scoreR = document.querySelector('.dot.r + span');
const scoreTtl = document.querySelector('.dot.ttl + span');

const STORAGE_KEY = 'quiz_solved_data';

let solvedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    correctIds: [], 
    correctCount: 0,
    wrongCount: 0
};

let currentWrongCount = solvedData.wrongCount; 
let currentCorrectCount = solvedData.correctCount;

const updateHeaderScore = () => {
    if (scoreG) scoreG.innerText = currentCorrectCount;
    if (scoreR) scoreR.innerText = currentWrongCount;
    if (scoreTtl) scoreTtl.innerText = que.length;
};

/**
 * 2. 유틸리티 함수
 */
const saveProgress = () => {
    solvedData.correctCount = currentCorrectCount;
    solvedData.wrongCount = currentWrongCount;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(solvedData));
};

const showToast = (message, type = 'success') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

const getRandomMode = () => Math.floor(Math.random() * 2);

const escapeRegExp = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const getExtraKeywords = (excludeWords, count) => {
    const allWords = [];
    que.forEach(item => {
        if(item.main) allWords.push(item.main);
        if(item.sub) item.sub.forEach(s => allWords.push(s));
    });
    const filteredPool = Array.from(new Set(allWords))
        .filter(word => !excludeWords.includes(word));
    return filteredPool.sort(() => Math.random() - 0.5).slice(0, count);
};

/**
 * 3. 메인 실행 로직
 */
const renderQuiz = () => {
    mainContainer.innerHTML = '';
    updateHeaderScore();

    que.forEach((item, index) => {
        if (solvedData.correctIds.includes(index)) return;

        const newCard = qCardTemplate.cloneNode(true);
        const qTopic = newCard.querySelector('.q-topic');
        const qText = newCard.querySelector('.q-text');
        
        qTopic.innerHTML = ''; 
        const hintBtn = document.createElement('button');
        hintBtn.className = 'btn-hint';
        hintBtn.innerText = '💡 힌트';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn-reset';
        resetBtn.innerText = '🔄';
        qTopic.appendChild(hintBtn);
        qTopic.appendChild(resetBtn);

        let choicesArea = newCard.querySelector('.choices');
        if (!choicesArea) {
            choicesArea = document.createElement('div');
            choicesArea.className = 'choices';
        }
        newCard.appendChild(choicesArea); 

        const submitBtn = document.createElement('button');
        submitBtn.className = 'btn-submit';
        submitBtn.innerText = '제출하기';
        choicesArea.after(submitBtn);

        // 빈칸 처리
        const mode = getRandomMode();
        const targetKeywords = ((mode === 0) ? [item.main] : [...item.sub])
            .filter(kw => kw && kw.trim())
            .sort((a, b) => b.length - a.length) 
            .slice(0, 4);

        let finalHTML = item.sentense;
        // const escapedKws = targetKeywords.map(kw => escapeRegExp(kw.trim()).split('').join('\\s*'));
        const escapedKws = targetKeywords.map(kw => {
        // 1. 먼저 단어 전체를 안전하게 이스케이프 (특수문자 앞에 \ 붙임)
        const safeWord = escapeRegExp(kw.trim());
        // 2. 글자 하나하나 사이에 \s* (공백 허용)를 넣되, 이미 \가 붙은 그룹은 유지
        // 안전을 위해 글자 단위 분리 후 합치기
        return safeWord.split('').map((char, i, arr) => {
            // 백슬래시(\) 자체는 뒤의 문자와 결합되어야 하므로 제외
            if (char === '\\') return char;
            // 앞 문자가 백슬래시였다면 공백 허용 기호를 붙이지 않음 (이스케이프 그룹 유지)
            if (arr[i - 1] === '\\') return char;
            // 일반 문자 뒤에만 \s* 추가
            return char + '\\s*';
        }).join('');
    });
        const combinedRegex = new RegExp(`(${escapedKws.join('|')})`, 'g');

        finalHTML = finalHTML.replace(combinedRegex, (match) => {
            // 드롭을 받기 위한 이벤트 속성 추가
            return `<span class="blank" data-answer="${match.trim()}" style="cursor:pointer">?</span>`;
        });
        qText.innerHTML = finalHTML;

        // 드롭 대상(빈칸) 설정
        const blanks = newCard.querySelectorAll('.blank');
        blanks.forEach(blank => {
            blank.addEventListener('dragover', (e) => e.preventDefault()); // 드롭 허용
            blank.addEventListener('drop', (e) => {
                e.preventDefault();
                const data = e.dataTransfer.getData("text");
                blank.innerText = data;
                blank.classList.add('filled');
                blank.style.backgroundColor = ''; // 이전 오답 색상 초기화
            });
            // 클릭 시 리셋 기능 유지
            blank.addEventListener('click', () => {
                blank.innerText = '?';
                blank.classList.remove('filled');
                blank.style.backgroundColor = '';
            });
        });

        // 힌트/리셋 로직은 동일
        // 힌트 버튼 클릭 로직 수정
        hintBtn.onclick = (e) => {
            e.stopPropagation();
            const currentHTML = qText.innerHTML; // 현재 빈칸(? 상태) 유지된 HTML 저장
            
            // 1. 힌트용 문구 생성 로직
            // 현재 카드 내의 모든 빈칸 요소를 가져옴
            const blanksInCard = newCard.querySelectorAll('.blank');
            let hintHTML = item.sentense; // 원본 문장에서 시작

            // 모든 정답 키워드를 순회하며 강조 처리
            blanksInCard.forEach(blank => {
                const answer = blank.dataset.answer.trim();
                const isFilled = blank.classList.contains('filled');
                
                // 정규식 생성 (특수문자 보호를 위해 escapeRegExp 사용)
                const regex = new RegExp(escapeRegExp(answer), 'g');
                
                if (!isFilled) {
                    // [핵심] 아직 못 맞춘 키워드: 노란 배경 + 빨간 글씨로 튀게 처리
                    hintHTML = hintHTML.replace(regex, 
                        `<span style="color: #e74c3c; font-weight: bold; background-color: #fff3cd; padding: 0 2px; border-radius: 3px; border-bottom: 2px solid #ffcc00;">${answer}</span>`
                    );
                } else {
                    // 이미 맞춘 키워드: 초록색 글씨로만 표시 (구분용)
                    hintHTML = hintHTML.replace(regex, 
                        `<span style="color: #2ecc71; font-weight: bold;">${answer}</span>`
                    );
                }
            });

            qText.innerHTML = hintHTML; // 강조된 힌트 텍스트로 교체
            hintBtn.disabled = true;

            let timeLeft = 5;
            const timerSpan = document.createElement('span');
            timerSpan.style.fontSize = '12px';
            timerSpan.style.marginLeft = '5px';
            timerSpan.style.color = '#ff4d4d'; // 타이머 색상 강조
            timerSpan.innerText = `(${timeLeft}s)`;
            hintBtn.appendChild(timerSpan);

            const countdown = setInterval(() => {
                timeLeft -= 1;
                timerSpan.innerText = `(${timeLeft}s)`;
                if (timeLeft <= 0) {
                    clearInterval(countdown);
                    qText.innerHTML = currentHTML; // 원래의 빈칸(<span>) 구조로 복구
                    timerSpan.remove();
                    hintBtn.disabled = false;
                    
                    // 힌트를 봤으므로 카드를 맨 뒤로 이동
                    mainContainer.appendChild(newCard);
                    showToast('힌트 확인! 맨 뒤로 이동합니다.', 'error');
                }
            }, 1000);
        };

        resetBtn.onclick = (e) => {
            e.stopPropagation();
            newCard.querySelectorAll('.blank').forEach(b => {
                b.innerText = '?';
                b.classList.remove('filled');
                b.style.backgroundColor = '';
            });
        };

        // 보기 버튼 생성 (드래그 가능하도록 수정)
        choicesArea.innerHTML = '';
        let currentPool = Array.from(new Set(targetKeywords));
        if (currentPool.length < 4) {
            const extras = getExtraKeywords(currentPool, 4 - currentPool.length);
            currentPool = [...currentPool, ...extras];
        }
        const finalChoices = currentPool.sort(() => Math.random() - 0.5).slice(0, 4);

        finalChoices.forEach(word => {
            const btn = document.createElement('button');
            btn.className = 'choice';
            btn.innerText = word;
            btn.draggable = true; // 드래그 가능하게 설정

            // 드래그 시작 시 데이터 설정
            btn.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData("text", word);
            });

            // 클릭 시에도 입력되도록 기존 기능 유지 (모바일 및 편의성)
            btn.onclick = () => {
                const emptyBlank = newCard.querySelector('.blank:not(.filled)');
                if (emptyBlank) {
                    emptyBlank.innerText = word;
                    emptyBlank.classList.add('filled');
                }
            };
            choicesArea.appendChild(btn);
        });

        // 제출 로직 (기존 opt 판별 로직 포함)
      // 제출 로직
        submitBtn.onclick = () => {
            const currentBlanks = Array.from(newCard.querySelectorAll('.blank'));
            if (currentBlanks.length === 0) return;

            const isComplete = currentBlanks.every(b => b.classList.contains('filled'));
            if (!isComplete) {
                showToast('모든 빈칸을 채워주세요!', 'error');
                return;
            }

            let allCorrect = false;
            // 1. 정답 판별 (기존 로직 유지)
            if (item.opt === 1) {
                const userAnswers = currentBlanks.map(b => b.innerText.replace(/\s+/g, '')).sort();
                const correctAnswers = currentBlanks.map(b => b.dataset.answer.replace(/\s+/g, '')).sort();
                allCorrect = userAnswers.every((val, i) => val === correctAnswers[i]);
            } else {
                allCorrect = true;
                currentBlanks.forEach(blank => {
                    const userAnswer = blank.innerText.replace(/\s+/g, '');
                    const correctAnswer = blank.dataset.answer.replace(/\s+/g, '');
                    if (userAnswer !== correctAnswer) allCorrect = false;
                });
            }

            if (allCorrect) {
                // [정답 시] 기존 로직 동일
                currentBlanks.forEach(b => b.style.backgroundColor = '#d4edda');
                currentCorrectCount++;
                solvedData.correctIds.push(index); 
                saveProgress();
                updateHeaderScore();
                showToast('정답입니다! 🎉', 'success');
                setTimeout(() => {
                    newCard.style.opacity = '0';
                    newCard.style.transition = '0.4s';
                    setTimeout(() => newCard.remove(), 400);
                }, 500);
            } else {
                // [오답 시] 정답 공개 및 5초 후 이동 로직
                currentWrongCount++;
                saveProgress();
                updateHeaderScore();
                showToast('오답입니다! 5초 후 정답이 가려지고 맨 뒤로 이동합니다.', 'error');

                // 1. 모든 빈칸에 정답 표시 및 오답 강조
                currentBlanks.forEach(blank => {
                    const userAnswer = blank.innerText.replace(/\s+/g, '');
                    const correctAnswer = blank.dataset.answer.replace(/\s+/g, '');
                    
                    blank.innerText = blank.dataset.answer; // 정답으로 텍스트 교체
                    blank.style.fontWeight = 'bold';
                    
                    if (userAnswer === correctAnswer) {
                        blank.style.backgroundColor = '#d4edda'; // 맞춘 건 초록색
                    } else {
                        blank.style.backgroundColor = '#f8d7da'; // 틀린 건 빨간색
                        blank.style.color = '#e74c3c';
                    }
                });

                // 2. 버튼 비활성화 (중복 클릭 방지)
                submitBtn.disabled = true;
                let waitTime = 5;
                submitBtn.innerText = `다시 풀기까지 ${waitTime}초...`;

                const timer = setInterval(() => {
                    waitTime--;
                    submitBtn.innerText = `다시 풀기까지 ${waitTime}초...`;
                    if (waitTime <= 0) clearInterval(timer);
                }, 1000);

                // 3. 5초 뒤 원래 상태로 복구하며 맨 아래로 이동
                setTimeout(() => {
                    currentBlanks.forEach(blank => {
                        blank.innerText = '?'; // 다시 물음표로
                        blank.classList.remove('filled');
                        blank.style.backgroundColor = '';
                        blank.style.color = '';
                        blank.style.fontWeight = 'normal';
                    });
                    
                    submitBtn.disabled = false;
                    submitBtn.innerText = '제출하기';
                    
                    // 맨 아래로 이동
                    mainContainer.appendChild(newCard);
          
                }, 5000);
            }
        };

        mainContainer.appendChild(newCard);
    });
};

if (resetAllBtn) {
    resetAllBtn.onclick = () => {
        if (confirm('모든 기록을 초기화하시겠습니까?')) {
            localStorage.removeItem(STORAGE_KEY);
            solvedData = { correctIds: [], correctCount: 0, wrongCount: 0 };
            currentCorrectCount = 0;
            currentWrongCount = 0;
            renderQuiz();
        }
    };
}

renderQuiz();
