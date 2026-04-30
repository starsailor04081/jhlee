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

    // [상단 레이아웃] 클로버와 이슈 체크박스
    const topBar = document.createElement('div');
    topBar.className = 'card-top-bar'; // 기존 CSS가 없으면 style 수동 적용 가능
    topBar.style.display = 'flex';
    topBar.style.justifyContent = 'space-between';
    topBar.style.alignItems = 'center';
    topBar.style.marginBottom = '10px';

    const cloverContainer = document.createElement('div');
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
    chk.onchange = (e) => {
        e.stopPropagation(); // 카드 클릭 이벤트 전파 방지
        if (chk.checked) issueSet.add(q);
        else issueSet.delete(q);
    };

    topBar.appendChild(cloverContainer);
    topBar.appendChild(issueLabel);
    card.appendChild(topBar);

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
            btn.onclick = (e) => { 
                e.stopPropagation();
                if (!animating) handleResult(btn.textContent === q.answer, q, [q.answer], [btn.textContent]); 
            };
        });
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

// --- 4. 인터랙션 로직 ---
function setupBlankLogic(card, realAnswersInOrder, questionData) {
    const multiBtns = card.querySelectorAll('.multi-btn');
    const holes = card.querySelectorAll('.hole');
    const submitBtn = card.querySelector('#submitBtn');
    let selectedTexts = new Array(holes.length).fill(null);
    multiBtns.forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
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
        hole.onclick = (e) => {
            e.stopPropagation();
            if (animating) return;
            selectedTexts[idx] = null;
            hole.textContent = "____";
            hole.style.color = "#ccc";
        };
    });
    submitBtn.onclick = (e) => {
        e.stopPropagation();
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
        btn.onclick = (e) => {
            e.stopPropagation();
            if (animating) return;
            btn.classList.toggle('selected');
            const txt = btn.textContent;
            if (btn.classList.contains('selected')) selectedTexts.push(txt);
            else selectedTexts = selectedTexts.filter(t => t !== txt);
        };
    });
    submitBtn.onclick = (e) => {
        e.stopPropagation();
        if (animating || selectedTexts.length === 0) return;
        const isCorrect = JSON.stringify([...selectedTexts].sort()) === JSON.stringify([...correctList].sort());
        handleResult(isCorrect, questionData, correctList, selectedTexts);
    };
}

// --- 5. 결과 처리 (핵심 수정 부분) ---
function handleResult(isSuccess, questionData, correctToHighlight, userSelections = []) {
    animating = true;
    const card = stage.querySelector('.card');
    const badge = card.querySelector('.result-badge');
    const allBtns = card.querySelectorAll('.choice-btn, .multi-btn, #submitBtn');
    
    // UI 업데이트 (버튼 비활성화 및 정답 표시)
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

    badge.style.opacity = '1';

    if (isSuccess) {
        // 정답 시: 잠시 후 자동으로 다음 카드로 날아감
        correctCount++;
        badge.textContent = '⭕';
        setTimeout(() => {
            card.classList.add('fly-away');
            setTimeout(proceedToNext, 600);
        }, 400);
    } else {
        // 오답 시: 사용자가 클릭할 때까지 대기
        wrongCounts[questionData.main] = (wrongCounts[questionData.main] || 0) + 1;
        quizStack.push(questionData);
        badge.textContent = '❌';

        // 안내 문구 추가
        const guide = document.createElement('div');
        guide.innerHTML = "화면을 터치하여 계속하기";
        guide.style.cssText = "font-size:12px; color:#ff4b2b; margin-top:15px; text-align:center; font-weight:bold;";
        card.appendChild(guide);

        // 카드 클릭 시 다음으로 진행
        card.style.cursor = 'pointer';
        card.onclick = () => {
            card.onclick = null; // 중복 클릭 방지
            card.classList.add('drop-away');
            setTimeout(proceedToNext, 600);
        };
    }

    function proceedToNext() {
        currentIdx++;
        saveProgress();
        renderNextCard();
    }
}

function updateUI() {
    if(progressBar) progressBar.style.width = `${(correctCount / que.length) * 100}%`;
    if(counter) counter.textContent = `${correctCount} / ${que.length}`;
}

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
                <p style="font-size:14px; color:#ff4b2b;">⚠️ 체크된 이슈 문제 데이터 (${issueSet.size}건)</p>
                <textarea readonly style="width:100%; height:150px; padding:10px; font-family:monospace; font-size:12px; border:1px solid #ddd; border-radius:5px; background:#f9f9f9;">${JSON.stringify(issueData, null, 2)}</textarea>
                <button onclick="copyIssueData(this)" style="margin-top:10px; width:100%; padding:10px; background:#444; color:#fff; border:none; border-radius:5px; cursor:pointer;">데이터 복사하기</button>
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
    setTimeout(() => btn.textContent = "데이터 복사하기", 2000);
};

document.addEventListener('DOMContentLoaded', () => {
    loadProgress();
    renderNextCard();
    const rb = document.getElementById('resetBtn');
    if(rb) rb.onclick = () => { if(confirm("리셋하시겠습니까?")) { localStorage.removeItem(STORAGE_KEY); location.reload(); } };
});

window.restart = () => { localStorage.removeItem(STORAGE_KEY); location.reload(); };
