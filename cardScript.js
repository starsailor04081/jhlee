import { que } from './card_data.js';

// 키값을 고정하여 새로고침 시에도 동일한 저장소를 바라보게 합니다.
const STORAGE_KEY = 'quiz_stable_system_v35';

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

// --- 1. 저장 및 스마트 복구 로직 ---
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
    
    try {
        const data = JSON.parse(saved);
        wrongCounts = data.wrongCounts || {};
        correctCount = data.correctCount || 0;
        totalAttempts = data.totalAttempts || 0;
        
        // [핵심] 새로고침 시: 틀린 기록(♣)이 있는 가장 첫 번째 원본 데이터 번호를 찾습니다.
        let firstWrongInQueIdx = -1;
        for(let i = 0; i < que.length; i++) {
            if((wrongCounts[que[i].main] || 0) > 0) {
                firstWrongInQueIdx = i;
                break;
            }
        }

        if (firstWrongInQueIdx !== -1) {
            // 틀린 문제가 있다면 그 번호부터 다시 시작 (스택 초기화)
            currentIdx = firstWrongInQueIdx;
            quizStack = [...que]; 
        } else {
            // 틀린 게 없다면 마지막 풀던 위치로
            currentIdx = data.currentIdx || 0;
            quizStack = data.quizStack || [...que];
        }

        if (data.issueMains) {
            const savedMains = new Set(data.issueMains);
            que.forEach(q => { if (savedMains.has(q.main)) issueSet.add(q); });
        }
    } catch (e) { console.error("Data Load Error", e); }
}

// --- 2. 렌더링 보조 엔진 ---
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

// --- 3. 메인 렌더링 (기존 CSS 유지용 구조) ---
function renderNextCard() {
    updateUI();
    if (!stage) return;
    stage.innerHTML = '';
    animating = false;
    if (currentIdx >= quizStack.length) { showDone(); return; }

    const q = quizStack[currentIdx];
    prepareChoices(q);

    const card = document.createElement('div');
    card.className = 'card active'; // 기존 CSS의 .card 클래스 활용

    // [스와이프 이벤트 설정]
    card.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive: true});
    card.addEventListener('touchend', e => { touchEndX = e.changedTouches[0].screenX; handleSwipe(card); }, {passive: true});

    // 상단 툴바 (클로버 + 이슈)
    const topBar = document.createElement('div');
    topBar.className = 'card-top-bar'; // 기존 CSS가 없으면 style 수동 적용 가능
    topBar.style.display = 'flex';
    topBar.style.justifyContent = 'space-between';
    
    const cloverWrap = document.createElement('div');
    const wCount = wrongCounts[q.main] || 0;
    for(let i=0; i<wCount; i++) {
        const span = document.createElement('span');
        span.textContent = '♣'; span.style.color = 'red'; span.style.fontSize = '12px';
        cloverWrap.appendChild(span);
    }

    const issueLabel = document.createElement('label');
    issueLabel.innerHTML = `<input type="checkbox"> 이슈`;
    const chk = issueLabel.querySelector('input');
    if (issueSet.has(q)) chk.checked = true;
    chk.onchange = () => { if(chk.checked) issueSet.add(q); else issueSet.delete(q); saveProgress(); };

    topBar.append(cloverWrap, issueLabel);
    card.appendChild(topBar);

    // [Blank 타입일 때 main 노출 안함]
    const mainSection = (q.type === 'blank') ? '' : `
        <div class="card-main">${q.main}</div>
        <div class="card-divider"></div>
    `;

    // 카드 내부 템플릿
    let innerHTML = `<div class="card-label">${q.type.toUpperCase()} QUIZ</div>${mainSection}`;

    if (q.type === 'ox') {
        innerHTML += `
            <div class="card-sentence">${q.sentence}</div>
            <div class="choices ox-layout">${q.fixedChoices.map(c => `<button class="choice-btn ox-btn">${c}</button>`).join('')}</div>
        `;
    } else if (q.type === 'blank') {
        let realAnswers = [];
        const pattern = new RegExp(`(${q.fixedAnswers.map(s => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'g');
        const processed = q.sentence.replace(pattern, (m) => { realAnswers.push(m); return `<span class="hole">____</span>`; });
        innerHTML += `
            <div class="sentence-area">${processed}</div>
            <div class="choices">${q.fixedChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('')}</div>
            <button class="submit-btn" id="submitBtn">정답 제출</button>
        `;
    } else {
        innerHTML += `
            <div class="choices">${q.fixedChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('')}</div>
            <button class="submit-btn" id="submitBtn">답안 제출</button>
        `;
    }
    
    innerHTML += `<div class="result-badge"></div>`;
    card.insertAdjacentHTML('beforeend', innerHTML);
    stage.appendChild(card);

    // 이벤트 바인딩
    if(q.type === 'ox') {
        card.querySelectorAll('.ox-btn').forEach(btn => {
            btn.onclick = () => { if(!animating) handleResult(btn.textContent === q.answer, q, [q.answer], [btn.textContent]); };
        });
    } else if(q.type === 'blank') {
        setupBlankLogic(card, realAnswers, q);
    } else {
        setupMultiSelectLogic(card, q.fixedAnswers, q);
    }
}

// --- 4. 결과 및 스와이프 로직 ---
function handleSwipe(card) {
    if (!card.classList.contains('is-wrong-state') || animating) return;
    if (Math.abs(touchEndX - touchStartX) > 60) {
        animating = true;
        card.style.transform = (touchEndX < touchStartX) ? 'translateX(-120%)' : 'translateX(120%)';
        card.style.opacity = '0';
        setTimeout(() => { currentIdx++; saveProgress(); renderNextCard(); }, 400);
    }
}

function handleResult(isSuccess, questionData, correctToHighlight, userSelections = []) {
    animating = true;
    const card = stage.querySelector('.card');
    const badge = card.querySelector('.result-badge');
    
    card.querySelectorAll('.choice-btn').forEach(btn => {
        btn.style.pointerEvents = 'none';
        if (correctToHighlight.includes(btn.textContent)) btn.classList.add('correct');
        else if (userSelections.includes(btn.textContent)) btn.classList.add('wrong');
    });

    if (isSuccess) {
        badge.textContent = '⭕'; badge.style.opacity = '1';
        correctCount++;
        setTimeout(() => {
            card.style.transform = 'translateY(-20px)';
            card.style.opacity = '0';
        }, 500);
        setTimeout(() => { currentIdx++; saveProgress(); renderNextCard(); }, 1000);
    } else {
        wrongCounts[questionData.main] = (wrongCounts[questionData.main] || 0) + 1;
        badge.textContent = '❌'; badge.style.opacity = '1';
        
        if (questionData.type === 'blank') {
            card.querySelectorAll('.hole').forEach((h, i) => { h.textContent = correctToHighlight[i]; h.style.color = 'green'; });
        }

        // [세션] 맨 뒤로 추가
        quizStack.push({...questionData});
        card.classList.add('is-wrong-state');
        card.insertAdjacentHTML('beforeend', `<div style="text-align:center; color:red; margin-top:15px; font-size:12px;">← 밀어서 다음 문제로</div>`);
        animating = false;
        saveProgress();
    }
}

// --- 5. 상세 입력 로직 (기존 유지) ---
function setupBlankLogic(card, realAnswers, questionData) {
    const holes = card.querySelectorAll('.hole');
    const btns = card.querySelectorAll('.multi-btn');
    let selected = new Array(holes.length).fill(null);
    
    btns.forEach(btn => {
        btn.onclick = () => {
            const empty = selected.indexOf(null);
            if(empty !== -1) { selected[empty] = btn.textContent; holes[empty].textContent = btn.textContent; holes[empty].style.color = 'blue'; }
        };
    });
    holes.forEach((h, i) => { h.onclick = () => { selected[i] = null; h.textContent = '____'; h.style.color = '#ccc'; }; });
    card.querySelector('#submitBtn').onclick = () => {
        if(!selected.includes(null)) handleResult(selected.every((v, i) => v === realAnswers[i]), questionData, realAnswers, selected);
    };
}

function setupMultiSelectLogic(card, correctList, questionData) {
    const btns = card.querySelectorAll('.multi-btn');
    let selected = [];
    btns.forEach(btn => {
        btn.onclick = () => {
            btn.classList.toggle('selected');
            const txt = btn.textContent;
            if(btn.classList.contains('selected')) selected.push(txt);
            else selected = selected.filter(t => t !== txt);
        };
    });
    card.querySelector('#submitBtn').onclick = () => {
        if(selected.length > 0) handleResult(JSON.stringify([...selected].sort()) === JSON.stringify([...correctList].sort()), questionData, correctList, selected);
    };
}

function updateUI() {
    if(progressBar) progressBar.style.width = `${(correctCount / que.length) * 100}%`;
    if(counter) counter.textContent = `${correctCount} / ${que.length}`;
}

function showDone() {
    stage.innerHTML = `<div class="done-screen visible">🎉 모든 학습을 완료했습니다!</div>`;
    if(correctDisplay) correctDisplay.textContent = correctCount;
}

// 초기화 실행
document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    renderNextCard();
    const rb = document.getElementById('resetBtn');
    if(rb) rb.onclick = () => { if(confirm("리셋하시겠습니까?")) { localStorage.removeItem(STORAGE_KEY); location.reload(); } };
});
