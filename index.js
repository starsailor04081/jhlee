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
 * [신규] 애니메이션 플라이 효과 함수
 */
const animateFly = (startRect, endEl, word) => {
    const flyer = document.createElement('div');
    flyer.innerText = word;
    flyer.className = 'choice'; 
    flyer.style.cssText = `
        position: fixed; top: ${startRect.top}px; left: ${startRect.left}px;
        width: ${startRect.width}px; height: ${startRect.height}px;
        z-index: 10000; margin: 0; pointer-events: none;
        transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.2);
    `;
    document.body.appendChild(flyer);

    const endRect = endEl.getBoundingClientRect();

    requestAnimationFrame(() => {
        flyer.style.top = `${endRect.top}px`;
        flyer.style.left = `${endRect.left}px`;
        flyer.style.transform = 'scale(0.8)';
        flyer.style.opacity = '0.7';
    });

    setTimeout(() => {
        flyer.remove();
        endEl.innerText = word;
        endEl.classList.add('filled');
        endEl.style.transform = 'scale(1.1)';
        setTimeout(() => endEl.style.transform = 'scale(1)', 150);
    }, 350);
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

        // 빈칸 처리 로직
        const mode = getRandomMode();
        const targetKeywords = ((mode === 0) ? [item.main] : [...item.sub])
            .filter(kw => kw && kw.trim())
            .sort((a, b) => b.length - a.length) 
            .slice(0, 4);

        let finalHTML = item.sentense;
        const escapedKws = targetKeywords.map(kw => escapeRegExp(kw.trim()).split('').join('\\s*'));
        const combinedRegex = new RegExp(`(${escapedKws.join('|')})`, 'g');

        finalHTML = finalHTML.replace(combinedRegex, (match) => {
            return `<span class="blank" data-answer="${match.trim()}" style="cursor:pointer">?</span>`;
        });
        
        qText.innerHTML = finalHTML;

        // [수정] 빈칸 드롭 존 설정
        const blanks = newCard.querySelectorAll('.blank');
        blanks.forEach(b => {
            b.addEventListener('dragover', e => e.preventDefault());
            b.addEventListener('drop', e => {
                e.preventDefault();
                const word = e.dataTransfer.getData('text');
                const startRect = JSON.parse(e.dataTransfer.getData('rect'));
                animateFly(startRect, b, word);
            });
        });

        // 빈칸 클릭 시 리셋
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
            const currentHTML = qText.innerHTML;
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
            btn.draggable = true; // 드래그 활성화

            // 드래그 시작 시 위치 정보 저장
            btn.addEventListener('dragstart', (e) => {
                const rect = btn.getBoundingClientRect();
                e.dataTransfer.setData('text', word);
                e.dataTransfer.setData('rect', JSON.stringify({
                    top: rect.top, left: rect.left, width: rect.width, height: rect.height
                }));
            });

            // 클릭 시 입력 (기존 로직 유지 + 애니메이션 추가)
            btn.onclick = () => {
                const emptyBlank = newCard.querySelector('.blank:not(.filled)');
                if (emptyBlank) {
                    animateFly(btn.getBoundingClientRect(), emptyBlank, word);
                }
            };
            choicesArea.appendChild(btn);
        });

        // 제출 로직 (유지)
        submitBtn.onclick = () => {
            const blanks = Array.from(newCard.querySelectorAll('.blank'));
            if (blanks.length === 0) return;

            const isComplete = blanks.every(b => b.classList.contains('filled'));
            if (!isComplete) {
                showToast('모든 빈칸을 채워주세요!', 'error');
                return;
            }

            let allCorrect = false;

            if (item.opt === 1) {
                const userAnswers = blanks.map(b => b.innerText.replace(/\s+/g, '')).sort();
                const correctAnswers = blanks.map(b => b.dataset.answer.replace(/\s+/g, '')).sort();
                allCorrect = userAnswers.every((val, i) => val === correctAnswers[i]);
                blanks.forEach(b => { b.style.backgroundColor = allCorrect ? '#d4edda' : '#f8d7da'; });
            } else {
                allCorrect = true;
                blanks.forEach(blank => {
                    const userAnswer = blank.innerText.replace(/\s+/g, '');
                    const correctAnswer = blank.dataset.answer.replace(/\s+/g, '');
                    if (userAnswer === correctAnswer) {
                        blank.style.backgroundColor = '#d4edda';
                    } else {
                        blank.style.backgroundColor = '#f8d7da';
                        allCorrect = false;
                    }
                });
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
                showToast('오답입니다! 다시 풀어보세요. 🤔', 'error');
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