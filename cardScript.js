import { que } from './card_data.js';

const STORAGE_KEY = 'quiz_final_system_stable_v30';

let quizStack = [...que];
let currentIdx = 0;
let correctCount = 0;
let totalAttempts = 0;
let animating = false;
let wrongCounts = {}; 
let issueSet = new Set(); 

let touchStartX = 0;
let touchEndX = 0;

const stage = document.getElementById('stage');
const progressBar = document.getElementById('progressBar');
const counter = document.getElementById('counter');
const correctDisplay = document.getElementById('correctCount');

// --- 1. 저장 및 복구 ---
function saveProgress() {
    const issueMains = Array.from(issueSet).map(q => q.main);
    const data = { quizStack, currentIdx, correctCount, totalAttempts, wrongCounts, issueMains };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        wrongCounts = data.wrongCounts || {};
        correctCount = data.correctCount || 0;
        totalAttempts = data.totalAttempts || 0;
        
        // [복구 로직 핵심] 틀린 기록이 있는 가장 앞 번호를 찾음
        let firstWrongInQueIdx = -1;
        for(let i=0; i<que.length; i++) {
            if(wrongCounts[que[i].main] > 0) {
                firstWrongInQueIdx = i;
                break;
            }
        }

        // 새로고침 시, 틀린 문제가 있다면 그 번호부터 다시 시작
        if (firstWrongInQueIdx !== -1) {
            currentIdx = firstWrongInQueIdx;
            quizStack = [...que]; // 스택 순서를 원본으로 되돌려 복습 환경 조성
        } else {
            currentIdx = data.currentIdx || 0;
            quizStack = data.quizStack || [...que];
        }

        if (data.issueMains) {
            const savedMains = new Set(data.issueMains);
            que.forEach(q => { if (savedMains.has(q.main)) issueSet.add(q); });
        }
    } catch (e) { console.error(e); }
}

// --- 2. 보기 생성 ---
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function getRandomDistractors(excludeArray, count) {
    const allAnswers = que.flatMap(item => (Array.isArray(item.answer) ? item.answer : [item.answer]));
    const uniquePool = [...new Set(allAnswers.filter(ans => !excludeArray.includes(ans)))];
    return shuffle(uniquePool).slice(0, count);
}

function prepareChoices(q) {
    if (q.fixedChoices) return;
    if (q.type === 'ox') {
        q.fixedChoices = ['O', 'X'];
        q.fixedAnswers = [q.answer];
    } else {
        const originalAnswers = Array.isArray(q.answer) ? q.answer : [q.answer];
        const maxTake = Math.min(originalAnswers.length, 4);
        const takeCount = Math.floor(Math.random() * maxTake) + 1;
        const selectedAnswers = shuffle([...originalAnswers]).slice(0, takeCount);
        const distractors = getRandomDistractors(originalAnswers, 5 - selectedAnswers.length);
        q.fixedChoices = shuffle([...selectedAnswers, ...distractors]);
        q.fixedAnswers = selectedAnswers;
    }
}

// --- 3. 렌더링 ---
function renderNextCard() {
    updateUI();
    if (!stage) return;
    stage.innerHTML = '';
    animating = false;
    if (currentIdx >= quizStack.length) { showDone(); return; }

    const q = quizStack[currentIdx];
    prepareChoices(q);
    const card = document.createElement('div');
    card.className = 'card active';

    card.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
    card.addEventListener('touchend', e => { touchEndX = e.changedTouches[0].screenX; handleSwipe(card); }, {passive: true});

    const topBar = document.createElement('div');
    topBar.style.display = 'flex'; topBar.style.justifyContent = 'space-between';
    const cloverContainer = document.createElement('div');
    const wCount = wrongCounts[q.main] || 0;
    for (let i = 0; i < wCount; i++) {
        const clover = document.createElement('span');
        clover.textContent = '♣'; clover.style.color = '#ff4b2b'; clover.style.fontSize = '12px';
        cloverContainer.appendChild(clover);
    }
    const issueLabel = document.createElement('label');
    issueLabel.style.fontSize = '12px'; issueLabel.innerHTML = `<input type="checkbox"> 이슈`;
    const chk = issueLabel.querySelector('input');
    if (issueSet.has(q)) chk.checked = true;
    chk.onchange = () => { if(chk.checked) issueSet.add(q); else issueSet.delete(q); saveProgress(); };

    topBar.append(cloverContainer, issueLabel);
    card.appendChild(topBar);

    const mainHtml = (q.type === 'blank') ? '' : `<div class="card-main">${q.main}</div><div class="card-divider"></div>`;

    if (q.type === 'ox') {
        card.insertAdjacentHTML('beforeend', `<div class="card-label">OX QUIZ</div>${mainHtml}<div class="card-sentence">${q.sentence}</div><div class="choices" style="flex-direction:row; gap:15px;">${q.fixedChoices.map(c => `<button class="choice-btn ox-btn" style="flex:1; height:80px; font-size:24px;">${c}</button>`).join('')}</div><div class="result-badge"></div>`);
        card.querySelectorAll('.ox-btn').forEach(btn => { btn.onclick = () => { if(!animating) handleResult(btn.textContent === q.answer, q, [q.answer], [btn.textContent]); }; });
    } else if (q.type === 'blank') {
        let realAnswersInOrder = [];
        const pattern = new RegExp(`(${q.fixedAnswers.map(s => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'g');
        const processedSentence = q.sentence.replace(pattern, (match) => { realAnswersInOrder.push(match); return `<span class="hole">____</span>`; });
        card.insertAdjacentHTML('beforeend', `<div class="card-label">FILL IN THE BLANK</div>${mainHtml}<div class="sentence-area">${processedSentence}</div><div class="choices">${q.fixedChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('')}</div><button class="submit-btn" id="submitBtn">정답 제출</button><div class="result-badge"></div>`);
        setupBlankLogic(card, realAnswersInOrder, q);
    } else {
        card.insertAdjacentHTML('beforeend', `<div class="card-label">MULTI-SELECT</div>${mainHtml}<div class="choices">${q.fixedChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('')}</div><button class="submit-btn" id="submitBtn">답안 제출</button><div class="result-badge"></div>`);
        setupMultiSelectLogic(card, q.fixedAnswers, q);
    }
    stage.appendChild(card);
}

// --- 4. 오답 및 스와이프 로직 ---
function handleSwipe(card) {
    if (!card.classList.contains('is-wrong-state') || animating) return;
    if (Math.abs(touchEndX - touchStartX) > 50) {
        animating = true;
        card.classList.add('drop-away');
        setTimeout(() => { currentIdx++; saveProgress(); renderNextCard(); }, 600);
    }
}

function handleResult(isSuccess, questionData, correctToHighlight, userSelections = []) {
    animating = true; totalAttempts++;
    const card = stage.querySelector('.card');
    const badge = card.querySelector('.result-badge');
    const allBtns = card.querySelectorAll('.choice-btn');

    allBtns.forEach(btn => {
        btn.style.pointerEvents = 'none';
        if (correctToHighlight.includes(btn.textContent)) btn.classList.add('correct');
        else if (userSelections.includes(btn.textContent)) btn.classList.add('wrong');
    });

    if (isSuccess) {
        badge.textContent = '⭕'; badge.style.opacity = '1';
        setTimeout(() => card.classList.add('fly-away'), 400);
        setTimeout(() => { currentIdx++; saveProgress(); renderNextCard(); }, 1000);
    } else {
        wrongCounts[questionData.main] = (wrongCounts[questionData.main] || 0) + 1;
        badge.textContent = '❌'; badge.style.opacity = '1';
        if (questionData.type === 'blank') {
            card.querySelectorAll('.hole').forEach((hole, idx) => { hole.textContent = correctToHighlight[idx]; hole.style.color = "#4CAF50"; });
        }
        // 세션 내에서는 맨 뒤로 보내기
        quizStack.push({...questionData});
        card.insertAdjacentHTML('beforeend', `<div id="swipeGuide" style="position:absolute; bottom:20px; left:0; width:100%; text-align:center; color:#ff4b2b; font-size:12px; animation: blink 1s infinite;">← 스와이프하여 넘기기</div>`);
        card.classList.add('is-wrong-state');
        animating = false; saveProgress();
    }
}

// --- 5. 상세 로직 ---
function setupBlankLogic(card, realAnswersInOrder, questionData) {
    const multiBtns = card.querySelectorAll('.multi-btn');
    const holes = card.querySelectorAll('.hole');
    const submitBtn = card.querySelector('#submitBtn');
    let selectedTexts = new Array(holes.length).fill(null);
    multiBtns.forEach(btn => {
        btn.onclick = () => {
            const emptyIdx = selectedTexts.indexOf(null);
            if (emptyIdx !== -1) { selectedTexts[emptyIdx] = btn.textContent; holes[emptyIdx].textContent = btn.textContent; holes[emptyIdx].style.color = "var(--accent)"; }
        };
    });
    holes.forEach((hole, idx) => { hole.onclick = () => { selectedTexts[idx] = null; hole.textContent = "____"; hole.style.color = "#ccc"; }; });
    submitBtn.onclick = () => { if(!selectedTexts.includes(null)) handleResult(selectedTexts.every((v, i) => v === realAnswersInOrder[i]), questionData, realAnswersInOrder, selectedTexts); };
}

function setupMultiSelectLogic(card, correctList, questionData) {
    const multiBtns = card.querySelectorAll('.multi-btn');
    const submitBtn = card.querySelector('#submitBtn');
    let selected = [];
    multiBtns.forEach(btn => {
        btn.onclick = () => {
            btn.classList.toggle('selected');
            const txt = btn.textContent;
            if (btn.classList.contains('selected')) selected.push(txt);
            else selected = selected.filter(t => t !== txt);
        };
    });
    submitBtn.onclick = () => { if(selected.length > 0) handleResult(JSON.stringify([...selected].sort()) === JSON.stringify([...correctList].sort()), questionData, correctList, selected); };
}

function updateUI() {
    const total = que.length;
    progressBar.style.width = `${Math.min((correctCount / total) * 100, 100)}%`;
    counter.textContent = `${correctCount} / ${total}`;
    if (correctDisplay) correctDisplay.textContent = correctCount;
}

function showDone() {
    stage.style.display = 'none';
    const ds = document.getElementById('doneScreen');
    if (ds) ds.classList.add('visible');
}

document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    renderNextCard();
    document.getElementById('resetBtn').onclick = () => { if(confirm("초기화하시겠습니까?")) { localStorage.removeItem(STORAGE_KEY); location.reload(); } };
});
