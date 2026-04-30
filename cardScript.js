import { que } from './card_data.js';

const STORAGE_KEY = 'quiz_system_v22_final_full';

let quizStack = [...que];
let currentIdx = 0;
let correctCount = 0;
let totalAttempts = 0;
let animating = false;
let wrongCounts = {}; 
let issueSet = new Set(); 

const stage = document.getElementById('stage');
const progressBar = document.getElementById('progressBar');
const counter = document.getElementById('counter');
const correctDisplay = document.getElementById('correctCount');

// --- 1. 데이터 저장 및 로드 (이슈 데이터 포함) ---
function saveProgress() {
    const issueMains = Array.from(issueSet).map(q => q.main);
    const data = { 
        quizStack, 
        currentIdx, 
        correctCount, 
        totalAttempts, 
        wrongCounts,
        issueMains 
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadProgress() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const data = JSON.parse(saved);
    correctCount = data.correctCount;
    totalAttempts = data.totalAttempts;
    wrongCounts = data.wrongCounts || {};
    
    if (data.issueMains) {
        const savedMains = new Set(data.issueMains);
        que.forEach(q => {
            if (savedMains.has(q.main)) issueSet.add(q);
        });
    }

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

// --- 2. 보기 생성 엔진 ---
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

// --- 3. 렌더링 엔진 ---
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

    // 상단 레이아웃 (클로버 + 이슈 체크박스)
    const topBar = document.createElement('div');
    topBar.style.display = 'flex';
    topBar.style.justifyContent = 'space-between';
    topBar.style.alignItems = 'center';
    topBar.style.marginBottom = '10px';

    const cloverContainer = document.createElement('div');
    const wCount = wrongCounts[q.main] || 0;
    for (let i = 0; i < wCount; i++) {
        const clover = document.createElement('span');
        clover.textContent = '♣';
        clover.style.fontSize = '10px';
        clover.style.color = '#ff4b2b';
        clover.style.marginRight = '2px';
        cloverContainer.appendChild(clover);
    }

    const issueLabel = document.createElement('label');
    issueLabel.style.fontSize = '12px';
    issueLabel.style.color = '#888';
    issueLabel.style.cursor = 'pointer';
    issueLabel.innerHTML = `<input type="checkbox" id="issueChk"> 이슈문제`;
    const chk = issueLabel.querySelector('input');
    
    if (issueSet.has(q)) chk.checked = true;
    
    chk.onchange = () => {
        if (chk.checked) issueSet.add(q);
        else issueSet.delete(q);
        saveProgress(); 
    };

    topBar.appendChild(cloverContainer);
    topBar.appendChild(issueLabel);
    card.prepend(topBar);

    if (q.type === 'ox') {
        card.insertAdjacentHTML('beforeend', `
            <div class="card-label">OX QUIZ</div>
            <div class="card-main">${q.main}</div>
            <div class="card-divider"></div>
            <div class="card-sentence" style="margin-bottom:20px; font-size:18px;">${q.sentence}</div>
            <div class="choices" style="display:flex; flex-direction: row; gap: 15px;">
                ${q.fixedChoices.map(c => `<button class="choice-btn ox-btn" style="flex:1; height:80px; font-size:24px;">${c}</button>`).join('')}
            </div>
            <div class="result-badge"></div>`);
        card.querySelectorAll('.ox-btn').forEach(btn => {
            btn.onclick = () => { if (!animating) handleResult(btn.textContent === q.answer, q, [q.answer], [btn.textContent]); };
        });
    } else {
        const choicesHtml = q.fixedChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('');
        if (q.type === 'blank') {
            let realAnswersInOrder = [];
            const pattern = new RegExp(`(${q.fixedAnswers.map(s => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'g');
            const processedSentence = q.sentence.replace(pattern, (match) => { realAnswersInOrder.push(match); return `<span class="hole">____</span>`; });

            card.insertAdjacentHTML('beforeend', `
                <div class="card-label">FILL IN THE BLANK</div>
                <div class="card-main">${q.main}</div>
                <div class="card-divider"></div>
                <div class="sentence-area" style="line-height:2.5; font-size:18px; margin-bottom:20px;">${processedSentence}</div>
                <div class="choices">${choicesHtml}</div>
                <button class="submit-btn" id="submitBtn" style="margin-top:15px; width:100%;">정답 제출</button>
                <div class="result-badge"></div>`);
            setupBlankLogic(card, realAnswersInOrder, q);
        } else {
            card.insertAdjacentHTML('beforeend', `
                <div class="card-label">MULTI-SELECT</div>
                <div class="card-main">${q.main}</div>
                <div class="card-divider"></div>
                <div class="choices">${choicesHtml}</div>
                <button class="submit-btn" id="submitBtn" style="margin-top:15px; width:100%;">답안 제출</button>
                <div class="result-badge"></div>`);
            setupMultiSelectLogic(card, q.fixedAnswers, q);
        }
    }
    stage.appendChild(card);
}

// --- 4. 인터랙션 로직 ---
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
        handleResult(isCorrect, questionData, realAnswersInOrder, selectedTexts);
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

// --- 5. 결과 처리 ---
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

    if (!isSuccess && questionData.type === 'blank') {
        const holes = card.querySelectorAll('.hole');
        holes.forEach((hole, idx) => {
            hole.textContent = correctToHighlight[idx];
            hole.style.color = "#4CAF50";
            hole.style.borderBottom = "2px solid #4CAF50";
        });
    }

    let animationTriggerDelay; 
    let nextRenderDelay;      

    if (isSuccess) {
        animationTriggerDelay = 300; 
        nextRenderDelay = 800; 
        correctCount++;
        badge.textContent = '⭕';
        setTimeout(() => card.classList.add('fly-away'), animationTriggerDelay);
    } else {
        wrongCounts[questionData.main] = (wrongCounts[questionData.main] || 0) + 1;
        animationTriggerDelay = 5000; 
        nextRenderDelay = 5800; 
        quizStack.push(questionData);
        badge.textContent = '❌';
        setTimeout(() => card.classList.add('drop-away'), animationTriggerDelay);
    }
    
    badge.style.opacity = '1';

    setTimeout(() => {
        currentIdx++;
        saveProgress();
        renderNextCard();
    }, nextRenderDelay);
}

function updateUI() {
    if (!progressBar || !counter) return;
    const total = que.length;
    const progress = Math.min((correctCount / total) * 100, 100);
    progressBar.style.width = `${progress}%`;
    counter.textContent = `${correctCount} / ${total}`;
    if (correctDisplay) correctDisplay.textContent = correctCount;
}

// --- 6. 종료 화면 및 이슈 데이터 출력 ---
function showDone() {
    stage.style.display = 'none';
    const doneScreen = document.getElementById('doneScreen');
    const doneTitle = document.getElementById('doneTitle');
    
    if (doneScreen && doneTitle) {
        doneScreen.classList.add('visible');
        
        if (issueSet.size > 0) {
            const issueData = Array.from(issueSet).map(item => {
                const { fixedChoices, fixedAnswers, ...cleanItem } = item;
                return cleanItem;
            });
            
            const reporterArea = document.createElement('div');
            reporterArea.style.marginTop = '20px';
            reporterArea.innerHTML = `
                <p style="font-size:14px; color:#ff4b2b; font-weight:bold;">⚠️ 체크된 이슈 문제 데이터 (${issueSet.size}건)</p>
                <textarea readonly style="width:100%; height:150px; padding:10px; font-family:monospace; font-size:12px; border:1px solid #ddd; border-radius:5px; background:#f9f9f9; color:#333; margin-top:5px;">${JSON.stringify(issueData, null, 2)}</textarea>
                <button onclick="copyIssueData(this)" style="margin-top:10px; width:100%; padding:12px; background:#444; color:#fff; border:none; border-radius:5px; cursor:pointer; font-weight:bold;">이슈 데이터 복사하기</button>
            `;
            doneTitle.after(reporterArea);
        }
    }
}

window.copyIssueData = (btn) => {
    const txt = btn.previousElementSibling;
    txt.select();
    document.execCommand('copy');
    btn.textContent = "복사 완료!";
    btn.style.background = "#4CAF50";
    setTimeout(() => {
        btn.textContent = "이슈 데이터 복사하기";
        btn.style.background = "#444";
    }, 2000);
};

document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    renderNextCard();
    document.getElementById('resetBtn').onclick = () => {
        if (confirm("기록을 초기화하시겠습니까?")) {
            localStorage.removeItem(STORAGE_KEY);
            location.reload();
        }
    };
});

window.restart = () => {
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
};
