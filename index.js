import { que } from './refactor.js';

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

// 헤더 점수 업데이트 로직 (실시간 반영 수정)
const updateHeaderScore = () => {
    if (scoreG) scoreG.innerText = currentCorrectCount;
    if (scoreR) scoreR.innerText = currentWrongCount;
    
    // 핵심 수정: 전체(Total) 칸에 '남은 문제 수'를 표시
    if (scoreTtl) {
        const remainingCount = que.length - solvedData.correctIds.length;
        scoreTtl.innerText = remainingCount;
    }
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

        // 빈칸 처리 및 정규식 로직
        const mode = getRandomMode();
        const targetKeywords = ((mode === 0) ? [item.main] : [...item.sub])
            .filter(kw => kw && kw.trim())
            .sort((a, b) => b.length - a.length) 
            .slice(0, 4);

        let finalHTML = item.sentense;
        const escapedKws = targetKeywords.map(kw => {
            const safeWord = escapeRegExp(kw.trim());
            return safeWord.split('').map((char, i, arr) => {
                if (char === '\\') return char;
                if (arr[i - 1] === '\\') return char;
                return char + '\\s*';
            }).join('');
        });
        const combinedRegex = new RegExp(`(${escapedKws.join('|')})`, 'g');

        finalHTML = finalHTML.replace(combinedRegex, (match) => {
            return `<span class="blank" data-answer="${match.trim()}" style="cursor:pointer">?</span>`;
        });
        qText.innerHTML = finalHTML;

        const blanks = newCard.querySelectorAll('.blank');
        blanks.forEach(blank => {
            blank.addEventListener('dragover', (e) => e.preventDefault());
            blank.addEventListener('drop', (e) => {
                e.preventDefault();
                const data = e.dataTransfer.getData("text");
                blank.innerText = data;
                blank.classList.add('filled');
                blank.style.backgroundColor = '';
            });
            blank.addEventListener('click', () => {
                blank.innerText = '?';
                blank.classList.remove('filled');
                blank.style.backgroundColor = '';
            });
        });

        // 힌트 버튼 로직
        hintBtn.onclick = (e) => {
            e.stopPropagation();
            const currentHTML = qText.innerHTML;
            const blanksInCard = newCard.querySelectorAll('.blank');
            let hintHTML = item.sentense;

            blanksInCard.forEach(blank => {
                const answer = blank.dataset.answer.trim();
                const isFilled = blank.classList.contains('filled');
                const regex = new RegExp(escapeRegExp(answer), 'g');
                
                if (!isFilled) {
                    hintHTML = hintHTML.replace(regex, 
                        `<span style="color: #e74c3c; font-weight: bold; background-color: #fff3cd; padding: 0 2px; border-radius: 3px; border-bottom: 2px solid #ffcc00;">${answer}</span>`
                    );
                } else {
                    hintHTML = hintHTML.replace(regex, 
                        `<span style="color: #2ecc71; font-weight: bold;">${answer}</span>`
                    );
                }
            });

            qText.innerHTML = hintHTML;
            hintBtn.disabled = true;

            let timeLeft = 5;
            const timerSpan = document.createElement('span');
            timerSpan.style.fontSize = '12px';
            timerSpan.style.marginLeft = '5px';
            timerSpan.style.color = '#ff4d4d';
            timerSpan.innerText = `(${timeLeft}s)`;
            hintBtn.appendChild(timerSpan);

            const countdown = setInterval(() => {
                timeLeft -= 1;
                timerSpan.innerText = `(${timeLeft}s)`;
                if (timeLeft <= 0) {
                    clearInterval(countdown);
                    qText.innerHTML = currentHTML;
                    timerSpan.remove();
                    hintBtn.disabled = false;
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

        // 보기 영역 생성
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
            btn.draggable = true;
            btn.addEventListener('dragstart', (e) => e.dataTransfer.setData("text", word));
            btn.onclick = () => {
                const emptyBlank = newCard.querySelector('.blank:not(.filled)');
                if (emptyBlank) {
                    emptyBlank.innerText = word;
                    emptyBlank.classList.add('filled');
                }
            };
            choicesArea.appendChild(btn);
        });

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
                currentBlanks.forEach(b => b.style.backgroundColor = '#d4edda');
                currentCorrectCount++;
                solvedData.correctIds.push(index); // 맞춘 아이디 추가
                
                saveProgress();
                updateHeaderScore(); // 즉시 헤더 숫자(Total 포함) 업데이트
                
                showToast('정답입니다! 🎉', 'success');
                setTimeout(() => {
                    newCard.style.opacity = '0';
                    newCard.style.transition = '0.4s';
                    setTimeout(() => newCard.remove(), 400);
                }, 500);
            } else {
                currentWrongCount++;
                saveProgress();
                updateHeaderScore(); // 오답 시에도 카운트 반영
                
                showToast('오답입니다! 5초 후 정답이 가려지고 맨 뒤로 이동합니다.', 'error');

                currentBlanks.forEach(blank => {
                    const userAnswer = blank.innerText.replace(/\s+/g, '');
                    const correctAnswer = blank.dataset.answer.replace(/\s+/g, '');
                    blank.innerText = blank.dataset.answer;
                    blank.style.fontWeight = 'bold';
                    if (userAnswer === correctAnswer) {
                        blank.style.backgroundColor = '#d4edda';
                    } else {
                        blank.style.backgroundColor = '#f8d7da';
                        blank.style.color = '#e74c3c';
                    }
                });

                submitBtn.disabled = true;
                let waitTime = 5;
                submitBtn.innerText = `다시 풀기까지 ${waitTime}초...`;

                const timer = setInterval(() => {
                    waitTime--;
                    submitBtn.innerText = `다시 풀기까지 ${waitTime}초...`;
                    if (waitTime <= 0) clearInterval(timer);
                }, 1000);

                setTimeout(() => {
                    currentBlanks.forEach(blank => {
                        blank.innerText = '?';
                        blank.classList.remove('filled');
                        blank.style.backgroundColor = '';
                        blank.style.color = '';
                        blank.style.fontWeight = 'normal';
                    });
                    submitBtn.disabled = false;
                    submitBtn.innerText = '제출하기';
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