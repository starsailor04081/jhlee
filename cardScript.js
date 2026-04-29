import { que } from './card_data.js';

const STORAGE_KEY = 'quiz_system_final_fixed_v7';

// 상태 관리 변수
let quizStack = [...que];
let currentIdx = 0;
let correctCount = 0;
let totalAttempts = 0;
let animating = false;

// DOM 요소 캐싱
const stage = document.getElementById('stage');
const progressBar = document.getElementById('progressBar');
const counter = document.getElementById('counter');
const correctDisplay = document.getElementById('correctCount');
const wrongDisplay = document.getElementById('wrongCount');

// --- 1. 데이터 저장 및 로드 로직 ---

function saveProgress() {
    const data = {
        quizStack, 
        currentIdx,
        correctCount,
        totalAttempts
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    const data = JSON.parse(saved);
    correctCount = data.correctCount;
    totalAttempts = data.totalAttempts;
    
    const savedStack = data.quizStack;
    const sIdx = data.currentIdx;

    // 현재 인덱스부터 끝까지의 남은 리스트
    const remaining = savedStack.slice(sIdx);
    
    if (remaining.length > 0) {
        const nowCard = remaining[0]; // 새로고침 시 화면에 떠 있어야 할 문제 (예: 2번)
        const others = remaining.slice(1); // 그 뒤의 대기열

        const wrongItems = [];
        const normalItems = [];
        
        // 이미 지나온 문제(0 ~ sIdx-1)의 식별자 추출
        const passedMains = new Set(savedStack.slice(0, sIdx).map(m => m.main));

        others.forEach(item => {
            // 과거에 이미 등장했던 문제가 뒤에 또 있다면 '틀린 문제'임
            if (passedMains.has(item.main)) {
                wrongItems.push(item);
            } else {
                normalItems.push(item);
            }
        });

        // 재배치: [틀린 문제들] + [방금 풀던 문제] + [나머지]
        quizStack = [...wrongItems, nowCard, ...normalItems];
    }
    
    currentIdx = 0; // 재배치했으므로 인덱스는 항상 0부터 시작
    if (correctDisplay) correctDisplay.textContent = correctCount;
}

// --- 2. 퀴즈 실행 관련 유틸리티 ---

function shuffle(arr) { 
    return [...arr].sort(() => Math.random() - 0.5); 
}

function getRandomDistractors(fullAnswerArray) {
    const allPossible = que
        .filter(item => item.type === 'multi' || item.type === 'blank')
        .flatMap(item => item.answer);
    const unique = [...new Set(allPossible.filter(ans => !fullAnswerArray.includes(ans)))];
    return shuffle(unique);
}

// --- 3. 카드 렌더링 엔진 ---

function renderNextCard() {
    updateUI();
    if (!stage) return;
    stage.innerHTML = '';
    animating = false;
    
    if (currentIdx >= quizStack.length) {
        showDone();
        return;
    }

    const q = quizStack[currentIdx];
    const card = document.createElement('div');
    card.className = 'card active';

    // A. OX 퀴즈 렌더링
    if (q.type === 'ox') {
        card.innerHTML = `
            <div class="card-label">OX QUIZ</div>
            <div class="card-main">${q.main}</div>
            <div class="card-divider"></div>
            <div class="card-sentence" style="margin-bottom:20px; font-size:18px;">${q.sentence}</div>
            <div class="choices" style="display:flex; flex-direction: row; gap: 15px;">
                <button class="choice-btn ox-btn" style="flex:1; height:80px; font-size:24px;">O</button>
                <button class="choice-btn ox-btn" style="flex:1; height:80px; font-size:24px;">X</button>
            </div>
            <div class="result-badge"></div>
        `;
        card.querySelectorAll('.ox-btn').forEach(btn => {
            btn.onclick = () => { if (!animating) handleResult(btn.textContent === q.answer, q, [q.answer], [btn.textContent]); };
        });

    // B. 빈칸 채우기(Blank) 렌더링
    } else if (q.type === 'blank') {
        const holeCandidateCount = Math.min(q.answer.length, 3);
        const selectedCandidates = shuffle([...q.answer]).slice(0, holeCandidateCount);
        let realAnswersInOrder = [];
        const pattern = new RegExp(`(${selectedCandidates.map(s => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'g');
        const processedSentence = q.sentence.replace(pattern, (match) => { realAnswersInOrder.push(match); return `<span class="hole">____</span>`; });
        
        const distractors = getRandomDistractors(selectedCandidates).slice(0, 4 - selectedCandidates.length);
        const finalChoices = shuffle([...selectedCandidates, ...distractors]);
        
        card.innerHTML = `
            <div class="card-label">FILL IN THE BLANK</div>
            <div class="card-main">${q.main}</div>
            <div class="card-divider"></div>
            <div class="sentence-area" style="line-height:2.5; font-size:18px; margin-bottom:20px;">${processedSentence}</div>
            <div class="choices">${finalChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('')}</div>
            <button class="submit-btn" id="submitBtn" style="margin-top:15px; width:100%;">정답 제출</button>
            <div class="result-badge"></div>
        `;
        setupBlankLogic(card, realAnswersInOrder, q);

    // C. 객관식(Multi) 렌더링
    } else {
        const selectedDistractors = getRandomDistractors(q.answer).slice(0, 4 - q.answer.length);
        const finalChoices = shuffle([...q.answer, ...selectedDistractors]);
        card.innerHTML = `
            <div class="card-label">MULTI-SELECT</div>
            <div class="card-main">${q.main}</div>
            <div class="card-divider"></div>
            <div class="choices">${finalChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('')}</div>
            <button class="submit-btn" id="submitBtn" style="margin-top:15px; width:100%;">답안 제출</button>
            <div class="result-badge"></div>
        `;
        setupMultiSelectLogic(card, q.answer, q);
    }
    stage.appendChild(card);
}

// --- 4. 타입별 인터랙션 로직 ---

function setupBlankLogic(card, realAnswersInOrder, questionData) {
    const multiBtns = card.querySelectorAll('.multi-btn');
    const holes = card.querySelectorAll('.hole');
    const submitBtn = card.querySelector('#submitBtn');
    let selectedTexts = new Array(holes.length).fill(null);

    multiBtns.forEach(btn => {
        btn.onclick = () => {
            if (animating) return;
            const emptyIdx = selectedTexts.indexOf(null);
            if (emptyIdx !== -1) {
                selectedTexts[emptyIdx] = btn.textContent;
                holes[emptyIdx].textContent = btn.textContent;
                holes[emptyIdx].style.color = "var(--accent)";
            }
        };
    });

    holes.forEach((hole, idx) => {
        hole.onclick = () => {
            if (animating) return;
            selectedTexts[idx] = null;
            hole.textContent = "____";
            hole.style.color = "#ccc";
        };
    });

    submitBtn.onclick = () => {
        if (animating) return;
        if (selectedTexts.includes(null)) { alert("모든 빈칸을 채워주세요."); return; }
        const isCorrect = selectedTexts.every((val, idx) => val === realAnswersInOrder[idx]);
        handleResult(isCorrect, questionData, [...new Set(realAnswersInOrder)], selectedTexts);
    };
}

function setupMultiSelectLogic(card, correctList, questionData) {
    const multiBtns = card.querySelectorAll('.multi-btn');
    const submitBtn = card.querySelector('#submitBtn');
    let selectedTexts = [];

    multiBtns.forEach(btn => {
        btn.onclick = () => {
            if (animating) return;
            btn.classList.toggle('selected');
            const txt = btn.textContent;
            if (btn.classList.contains('selected')) selectedTexts.push(txt);
            else selectedTexts = selectedTexts.filter(t => t !== txt);
        };
    });

    submitBtn.onclick = () => {
        if (animating || selectedTexts.length === 0) return;
        const isCorrect = JSON.stringify([...selectedTexts].sort()) === JSON.stringify([...correctList].sort());
        handleResult(isCorrect, questionData, correctList, selectedTexts);
    };
}

// --- 5. 결과 처리 및 UI 업데이트 ---

function handleResult(isSuccess, questionData, correctToHighlight, userSelections = []) {
    animating = true;
    totalAttempts++;
    
    const card = stage.querySelector('.card');
    const badge = card.querySelector('.result-badge');
    const allBtns = card.querySelectorAll('.choice-btn, .multi-btn');

    allBtns.forEach(btn => {
        btn.style.pointerEvents = 'none';
        if (correctToHighlight.includes(btn.textContent)) btn.classList.add('correct');
        else if (userSelections.includes(btn.textContent)) btn.classList.add('wrong');
    });

    if (isSuccess) {
        correctCount++;
        card.classList.add('fly-away');
        badge.textContent = '⭕';
    } else {
        // [원본 유지] 틀리면 맨 뒤로 추가
        quizStack.push(questionData); 
        card.classList.add('drop-away');
        badge.textContent = '❌';
        if (wrongDisplay) wrongDisplay.textContent = 'RE';
    }
    badge.style.opacity = '1';

    setTimeout(() => {
        currentIdx++;
        saveProgress();
        renderNextCard();
    }, 800);
}

function updateUI() {
    if (!progressBar || !counter) return;
    const total = que.length;
    const progress = Math.min((correctCount / total) * 100, 100);
    progressBar.style.width = `${progress}%`;
    counter.textContent = `${correctCount} / ${total}`;
    if (correctDisplay) correctDisplay.textContent = correctCount;
}

function showDone() {
    if (stage) stage.style.display = 'none';
    const doneScreen = document.getElementById('doneScreen');
    if (doneScreen) {
        doneScreen.classList.add('visible');
        document.getElementById('scoreText').textContent = `학습 완료! (총 시도: ${totalAttempts}회)`;
    }
}

// --- 6. 초기 실행 설정 ---

document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    renderNextCard();

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
        resetBtn.onclick = () => {
            if (confirm("모든 기록을 초기화하시겠습니까?")) {
                localStorage.removeItem(STORAGE_KEY);
                location.reload();
            }
        };
    }
});

// 전역 리스타트
window.restart = () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
};
