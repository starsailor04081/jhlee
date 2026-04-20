import { que } from './data_fixed.js';

/**
 * 1. 전역 변수 및 요소 설정
 */
const mainContainer = document.querySelector('.main');
const qCardTemplate = document.querySelector('.q-card');
const resetAllBtn = document.querySelector('.reset'); // 전체 다시풀기 버튼

// 헤더 스코어 요소
const scoreG = document.querySelector('.dot.g + span');
const scoreR = document.querySelector('.dot.r + span');
const scoreTtl = document.querySelector('.dot.ttl + span');

// 로컬 스토리지 키 설정
const STORAGE_KEY = 'quiz_solved_data';

// 학습 데이터 불러오기 (없으면 초기 객체 생성)
let solvedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    correctIds: [], // 맞춘 문제의 인덱스 또는 고유값 저장
    correctCount: 0,
    wrongCount: 0
};

// 초기 스코어 반영
const updateHeaderScore = () => {
    if (scoreG) scoreG.innerText = solvedData.correctCount;
    if (scoreR) scoreR.innerText = solvedData.wrongCount;
    if (scoreTtl) scoreTtl.innerText = que.length;
};

/**
 * 2. 유틸리티 함수
 */

// 데이터 저장 함수
const saveProgress = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(solvedData));
};

// Toast 메시지 출력 함수
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

/**
 * 3. 메인 실행 로직 (카드 생성)
 */
const renderQuiz = () => {
    mainContainer.innerHTML = '';
    updateHeaderScore();

    que.forEach((item, index) => {
        // [중요] 이미 맞춘 문제는 렌더링하지 않음
        if (solvedData.correctIds.includes(index)) return;

        const newCard = qCardTemplate.cloneNode(true);
        const qTopic = newCard.querySelector('.q-topic');
        const qText = newCard.querySelector('.q-text');
        
        // q-topic 설정
        qTopic.innerHTML = ''; 
        const resetBtn = document.createElement('button');
        resetBtn.className = 'btn-reset';
        resetBtn.innerText = '🔄 리셋';
        resetBtn.onclick = (e) => {
            e.stopPropagation();
            newCard.querySelectorAll('.blank').forEach(b => {
                b.innerText = '?';
                b.classList.remove('filled');
                b.style.backgroundColor = '';
            });
        };
        qTopic.appendChild(resetBtn);

        // choices 영역 확보
        let choicesArea = newCard.querySelector('.choices');
        if (!choicesArea) {
            choicesArea = document.createElement('div');
            choicesArea.className = 'choices';
        }
        newCard.appendChild(choicesArea); 

        // 제출 버튼 생성
        const submitBtn = document.createElement('button');
        submitBtn.className = 'btn-submit';
        submitBtn.innerText = '제출하기';
        choicesArea.after(submitBtn);

        // 빈칸 처리
        const mode = getRandomMode();
        let processedSentence = item.sentense;
        const targetKeywords = (mode === 0) ? [item.main] : [...item.sub];

        targetKeywords.forEach(kw => {
            const trimmedKw = kw.trim();
            if (!trimmedKw) return;
            const safeKw = escapeRegExp(trimmedKw);
            const re = new RegExp(safeKw.split('').join('\\s*'), 'g');
            processedSentence = processedSentence.replace(re, `<span class="blank" data-answer="${trimmedKw}">?</span>`);
        });
        qText.innerHTML = processedSentence;

        // 보기 버튼 생성
        choicesArea.innerHTML = '';
        const currentKeywords = [item.main, ...item.sub];
        currentKeywords.forEach(word => {
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

        // 제출 로직
        submitBtn.onclick = () => {
            const blanks = newCard.querySelectorAll('.blank');
            if (blanks.length === 0) return;

            let allCorrect = true;
            let isComplete = true;

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
                // 맞았을 때 처리
                solvedData.correctCount++;
                solvedData.correctIds.push(index); // 맞춘 인덱스 저장
                saveProgress();
                updateHeaderScore();
                showToast('정답입니다! 🎉', 'success');

                setTimeout(() => {
                    newCard.style.opacity = '0';
                    newCard.style.transform = 'scale(0.95)';
                    newCard.style.transition = '0.4s ease';
                    setTimeout(() => newCard.remove(), 400);
                }, 500);

            } else {
                // 틀렸을 때 처리
                solvedData.wrongCount++;
                saveProgress();
                updateHeaderScore();
                showToast('오답입니다! 맨 아래로 이동합니다. 🤔', 'error');

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

        // 빈칸 개별 클릭 시 초기화
        newCard.addEventListener('click', (e) => {
            if (e.target.classList.contains('blank')) {
                e.target.innerText = '?';
                e.target.classList.remove('filled');
                e.target.style.backgroundColor = '';
            }
        });

        mainContainer.appendChild(newCard);
    });
};

/**
 * 4. 전체 리셋 기능
 */
if (resetAllBtn) {
    resetAllBtn.onclick = () => {
        if (confirm('학습 기록을 모두 초기화하고 처음부터 다시 푸시겠습니까?')) {
            localStorage.removeItem(STORAGE_KEY);
            solvedData = {
                correctIds: [],
                correctCount: 0,
                wrongCount: 0
            };
            renderQuiz(); // 화면 다시 그리기
            showToast('모든 기록이 리셋되었습니다.', 'success');
        }
    };
}

// 최초 실행
renderQuiz();