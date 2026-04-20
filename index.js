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
        allWords.push(item.main);
        item.sub.forEach(s => allWords.push(s));
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

        // 버튼 생성 (힌트, 리셋)
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

        // 빈칸 처리 (최대 4개)
        const mode = getRandomMode();
        let processedSentence = item.sentense;
        
        // 정답 순서가 유지되도록 정렬 없이 slice 하거나, 랜덤 선정이면 선정된 순서대로 mapping
        let targetKeywords = (mode === 0) 
            ? [item.main] 
            : [...item.sub].sort(() => Math.random() - 0.5).slice(0, 4);

        targetKeywords.forEach(kw => {
            const trimmedKw = kw.trim();
            if (!trimmedKw) return;
            const safeKw = escapeRegExp(trimmedKw);
            const re = new RegExp(safeKw.split('').join('\\s*'), 'g');
            // [원복] data-answer 속성을 다시 부여하여 정확한 위치의 정답을 저장
            processedSentence = processedSentence.replace(re, `<span class="blank" data-answer="${trimmedKw}" style="cursor:pointer">?</span>`);
        });
        qText.innerHTML = processedSentence;

        // 빈칸 클릭 시 리셋 로직
        newCard.addEventListener('click', (e) => {
            if (e.target.classList.contains('blank')) {
                e.target.innerText = '?';
                e.target.classList.remove('filled');
                e.target.style.backgroundColor = '';
            }
        });

        // 힌트 로직
        hintBtn.onclick = (e) => {
            e.stopPropagation();
            const originalHTML = qText.innerHTML;
            qText.innerText = item.sentense;
            hintBtn.disabled = true;

            let timeLeft = 3;
            const timerSpan = document.createElement('span');
            timerSpan.style.fontSize = '12px';
            timerSpan.style.marginLeft = '5px';
            timerSpan.innerText = `(${timeLeft}s)`;
            hintBtn.appendChild(timerSpan);

            const countdown = setInterval(() => {
                timeLeft -= 1;
                timerSpan.innerText = `(${timeLeft}s)`;
                if (timeLeft <= 0) {
                    clearInterval(countdown);
                    qText.innerHTML = originalHTML;
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

        // 보기 버튼 생성
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
            btn.onclick = () => {
                const emptyBlank = newCard.querySelector('.blank:not(.filled)');
                if (emptyBlank) {
                    emptyBlank.innerText = word;
                    emptyBlank.classList.add('filled');
                }
            };
            choicesArea.appendChild(btn);
        });

        // 제출 로직 (정확한 위치 순서 매칭)
        submitBtn.onclick = () => {
            const blanks = newCard.querySelectorAll('.blank');
            if (blanks.length === 0) return;

            let isComplete = true;
            let allCorrect = true;

            blanks.forEach(blank => {
                if (!blank.classList.contains('filled')) isComplete = false;
                
                const userAnswer = blank.innerText.replace(/\s+/g, '');
                const correctAnswer = blank.dataset.answer.replace(/\s+/g, '');

                if (userAnswer === correctAnswer) {
                    blank.style.backgroundColor = '#d4edda';
                } else {
                    blank.style.backgroundColor = '#f8d7da';
                    allCorrect = false;
                }
            });

            if (!isComplete) {
                showToast('모든 빈칸을 채워주세요!', 'error');
                return;
            }

            if (allCorrect) {
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
                currentWrongCount++;
                saveProgress();
                updateHeaderScore();
                showToast('오답이 있습니다! 다시 풀어보세요. 🤔', 'error');
                setTimeout(() => {
                    blanks.forEach(blank => {
                        blank.innerText = '?';
                        blank.classList.remove('filled');
                        blank.style.backgroundColor = '';
                    });
                    mainContainer.appendChild(newCard);
                }, 500);
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