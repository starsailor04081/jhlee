import { que } from './card_data.js';

const STORAGE_KEY = 'quiz_system_v13_stable';

let quizStack = [...que];
let currentIdx = 0;
let correctCount = 0;
let totalAttempts = 0;
let animating = false;

const stage = document.getElementById('stage');
const progressBar = document.getElementById('progressBar');
const counter = document.getElementById('counter');
const correctDisplay = document.getElementById('correctCount');
const wrongDisplay = document.getElementById('wrongCount');

// --- 1. 저장 및 로드 ---
function saveProgress() {
    const data = { quizStack, currentIdx, correctCount, totalAttempts };
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
    const remaining = savedStack.slice(sIdx);
    if (remaining.length > 0) {
        const nowCard = remaining[0]; 
        const others = remaining.slice(1); 
        const wrongItems = [];
        const normalItems = [];
        const passedMains = new Set(savedStack.slice(0, sIdx).map(m => m.main));
        others.forEach(item => {
            if (passedMains.has(item.main)) wrongItems.push(item);
            else normalItems.push(item);
        });
        quizStack = [...wrongItems, nowCard, ...normalItems];
    }
    currentIdx = 0;
}

// --- 2. 유틸리티 ---
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

function getRandomDistractors(excludeArray, count) {
    const allAnswers = que.flatMap(item => (Array.isArray(item.answer) ? item.answer : [item.answer]));
    const uniquePool = [...new Set(allAnswers.filter(ans => !excludeArray.includes(ans)))];
    return shuffle(uniquePool).slice(0, count);
}

// --- 3. 핵심: 보기 고정 생성기 ---
function prepareChoices(q) {
    // 이미 보기가 생성되어 있다면 다시 만들지 않음 (중요: 변동 방지)
    if (q.fixedChoices) return;

    if (q.type === 'ox') {
        q.fixedChoices = ['O', 'X'];
        q.fixedAnswers = [q.answer];
    } else {
        const originalAnswers = Array.isArray(q.answer) ? q.answer : [q.answer];
        // 정답 1~4개 랜덤 추출
        const maxTake = Math.min(originalAnswers.length, 4);
        const takeCount = Math.floor(Math.random() * maxTake) + 1;
        const selectedAnswers = shuffle([...originalAnswers]).slice(0, takeCount);
        
        // 오답 채워서 무조건 5개 맞춤
        const distractors = getRandomDistractors(originalAnswers, 5 - selectedAnswers.length);
        
        q.fixedChoices = shuffle([...selectedAnswers, ...distractors]);
        q.fixedAnswers = selectedAnswers; // 실제 이 문제에서 정답으로 인정할 리스트
    }
}

// --- 4. 렌더링 엔진 ---
function renderNextCard() {
    updateUI();
    if (!stage) return;
    stage.innerHTML = '';
    animating = false;
    if (currentIdx >= quizStack.length) { showDone(); return; }

    const q = quizStack[currentIdx];
    
    // 이 카드가 처음 렌더링될 때 보기를 딱 한 번만 고정함
    prepareChoices(q);

    const card = document.createElement('div');
    card.className = 'card active';

    if (q.type === 'ox') {
        card.innerHTML = `
            <div class="card-label">OX QUIZ</div>
            <div class="card-main">${q.main}</div>
            <div class="card-divider"></div>
            <div class="card-sentence" style="margin-bottom:20px; font-size:18px;">${q.sentence}</div>
            <div class="choices" style="display:flex; flex-direction: row; gap: 15px;">
                ${q.fixedChoices.map(c => `<button class="choice-btn ox-btn" style="flex:1; height:80px; font-size:24px;">${c}</button>`).join('')}
            </div>
            <div class="result-badge"></div>`;
        card.querySelectorAll('.ox-btn').forEach(btn => {
            btn.onclick = () => { if (!animating) handleResult(btn.textContent === q.answer, q, [q.answer], [btn.textContent]); };
        });
    } else {
        const choicesHtml = q.fixedChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('');
        
        if (q.type === 'blank') {
            let realAnswersInOrder = [];
            const pattern = new RegExp(`(${q.fixedAnswers.map(s => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'g');
            const processedSentence = q.sentence.replace(pattern, (match) => { realAnswersInOrder.push(match); return `<span class="hole">____</span>`; });

            card.innerHTML = `
                <div class="card-label">FILL IN THE BLANK</div>
                <div class="card-main">${q.main}</div>
                <div class="card-divider"></div>
                <div class="sentence-area" style="line-height:2.5; font-size:18px; margin-bottom:20px;">${processedSentence}</div>
                <div class="choices">${choicesHtml}</div>
                <button class="submit-btn" id="submitBtn" style="margin-top:15px; width:100%;">정답 제출</button>
                <div class="result-badge"></div>`;
            setupBlankLogic(card, realAnswersInOrder, q);
        } else {
            card.innerHTML = `
                <div class="card-label">MULTI-SELECT</div>
                <div class="card-main">${q.main}</div>
                <div class="card-divider"></div>
                <div class="choices">${choicesHtml}</div>
                <button class="submit-btn" id="submitBtn" style="margin-top:15px; width:100%;">답안 제출</button>
                <div class="result-badge"></div>`;
            setupMultiSelectLogic(card, q.fixedAnswers, q);
        }
    }
    stage.appendChild(card);
}

// --- 5. 인터랙션 (기존과 동일하되 fixedAnswers 참조) ---
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
        if (animating || selectedTexts.includes(null)) return;
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
        // 맞춘 문제는 초기화해서 나중에 다시 나올 때 새로 생성되게 함 (선택사항)
        delete questionData.fixedChoices;
        delete questionData.fixedAnswers;
    } else {
        quizStack.push(questionData); 
        card.classList.add('drop-away');
        badge.textContent = '❌';
    }
    badge.style.opacity = '1';
    setTimeout(() => { currentIdx++; saveProgress(); renderNextCard(); }, 800);
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
    stage.style.display = 'none';
    const doneScreen = document.getElementById('doneScreen');
    if (doneScreen) doneScreen.classList.add('visible');
}

document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    renderNextCard();
    document.getElementById('resetBtn').onclick = () => {
        if (confirm("학습 기록을 초기화하시겠습니까?")) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    };
});

window.restart = () => { localStorage.removeItem(STORAGE_KEY); location.reload(); };
