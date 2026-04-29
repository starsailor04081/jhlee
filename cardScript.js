import { que } from './card_data.js';

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

function shuffle(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

function getRandomDistractors(fullAnswerArray) {
    const allPossibleAnswers = que
        .filter(item => item.type === 'multi' || item.type === 'blank')
        .flatMap(item => item.answer);
    const uniqueDistractors = [...new Set(allPossibleAnswers.filter(ans => !fullAnswerArray.includes(ans)))];
    return shuffle(uniqueDistractors);
}

function renderNextCard() {
    stage.innerHTML = '';
    animating = false;
    
    if (currentIdx >= quizStack.length) {
        showDone();
        return;
    }

    const q = quizStack[currentIdx];
    const card = document.createElement('div');
    card.className = 'card active';

    if (q.type === 'ox') {
        card.innerHTML = `
            <div class="card-label">OX QUIZ</div>
            <div class="card-main">${q.main}</div>
            <div class="card-divider"></div>
            <div class="card-sentence" style="margin-bottom:20px; font-size:18px;">${q.sentence}</div>
            <div class="choices" style="flex-direction: row; gap: 15px;">
                <button class="choice-btn ox-btn" style="flex:1; height:80px; font-size:24px;">O</button>
                <button class="choice-btn ox-btn" style="flex:1; height:80px; font-size:24px;">X</button>
            </div>
            <div class="result-badge"></div>
        `;
        card.querySelectorAll('.ox-btn').forEach(btn => {
            btn.onclick = () => {
                if (animating) return;
                handleResult(btn.textContent === q.answer, q, [q.answer], [btn.textContent]);
            };
        });

    } else if (q.type === 'blank') {
       const holeCandidateCount = Math.min(q.answer.length, 3);
        const selectedCandidates = shuffle([...q.answer]).slice(0, holeCandidateCount);
        
        let realAnswersInOrder = [];
        let tempSentence = q.sentence;

        // 선택된 정답 단어들을 문장에서 찾아 <span>으로 교체
        // g: 전체 찾기, (word1|word2): 여러 단어 중 하나와 일치
        const pattern = new RegExp(`(${selectedCandidates.map(s => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')).join('|')})`, 'g');

        const processedSentence = q.sentence.replace(pattern, (match) => {
            realAnswersInOrder.push(match);
            return `<span class="hole">____</span>`;
        });

        const distractors = getRandomDistractors(selectedCandidates).slice(0, 4 - selectedCandidates.length);
        const finalChoices = shuffle([...selectedCandidates, ...distractors]);

        card.innerHTML = `
            <div class="card-label">FILL IN THE BLANK</div>
            <div class="card-main">${q.main}</div>
            <div class="card-divider"></div>
            <div class="sentence-area" style="line-height:2.5; font-size:18px; margin-bottom:20px;">${processedSentence}</div>
            <div class="choices">
                ${finalChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('')}
            </div>
            <button class="submit-btn" id="submitBtn" style="margin-top:15px; width:100%;">정답 제출</button>
            <div class="result-badge"></div>
        `;
        setupBlankLogic(card, realAnswersInOrder, q);

    } else {
        const selectedDistractors = getRandomDistractors(q.answer).slice(0, 4 - q.answer.length);
        const finalChoices = shuffle([...q.answer, ...selectedDistractors]);

        card.innerHTML = `
            <div class="card-label">MULTI-SELECT</div>
            <div class="card-main">${q.main}</div>
            <div class="card-divider"></div>
            <div class="choices">
                ${finalChoices.map(c => `<button class="choice-btn multi-btn">${c}</button>`).join('')}
            </div>
            <button class="submit-btn" id="submitBtn" style="margin-top:15px; width:100%;">답안 제출</button>
            <div class="result-badge"></div>
        `;
        setupMultiSelectLogic(card, q.answer, q);
    }

    stage.appendChild(card);
    updateUI();
}

function setupBlankLogic(card, realAnswersInOrder, questionData) {
    const multiBtns = card.querySelectorAll('.multi-btn');
    const holes = card.querySelectorAll('.hole');
    const submitBtn = card.querySelector('#submitBtn');
    let selectedTexts = new Array(holes.length).fill(null);

    multiBtns.forEach(btn => {
        btn.onclick = () => {
            if (animating) return;
            const firstEmptyIdx = selectedTexts.indexOf(null);
            if (firstEmptyIdx !== -1) {
                selectedTexts[firstEmptyIdx] = btn.textContent;
                holes[firstEmptyIdx].textContent = btn.textContent;
                holes[firstEmptyIdx].style.color = "var(--accent)";
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
        if (selectedTexts.includes(null)) {
            alert("모든 빈칸을 채워주세요.");
            return;
        }
        const isAllCorrect = selectedTexts.every((val, idx) => val === realAnswersInOrder[idx]);
        handleResult(isAllCorrect, questionData, [...new Set(realAnswersInOrder)], selectedTexts);
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
            const text = btn.textContent;
            if (btn.classList.contains('selected')) {
                selectedTexts.push(text);
            } else {
                selectedTexts = selectedTexts.filter(t => t !== text);
            }
        };
    });

    submitBtn.onclick = () => {
        if (animating || selectedTexts.length === 0) return;
        const sortedSelected = [...selectedTexts].sort();
        const sortedCorrect = [...correctList].sort();
        const isAllCorrect = JSON.stringify(sortedSelected) === JSON.stringify(sortedCorrect);
        handleResult(isAllCorrect, questionData, correctList, selectedTexts);
    };
}

function handleResult(isSuccess, questionData, correctToHighlight, userSelections = []) {
    animating = true;
    totalAttempts++;
    
    const card = stage.querySelector('.card');
    const badge = card.querySelector('.result-badge');
    const allBtns = card.querySelectorAll('.multi-btn, .ox-btn');
    const submitBtn = card.querySelector('#submitBtn');

    if (submitBtn) submitBtn.style.display = 'none';

    allBtns.forEach(btn => {
        btn.style.pointerEvents = 'none';
        const isCorrectBtn = correctToHighlight.includes(btn.textContent);
        const isSelectedBtn = userSelections.includes(btn.textContent);

        if (isCorrectBtn) {
            btn.classList.add('correct');
        } else if (isSelectedBtn) {
            btn.classList.add('wrong');
        }
    });

    if (isSuccess) {
        correctCount++;
        badge.textContent = '⭕';
        correctDisplay.textContent = correctCount;
        card.classList.add('fly-away');
    } else {
        quizStack.push(questionData); 
        badge.textContent = '❌';
        card.classList.add('drop-away');
        wrongDisplay.textContent = 'RE';
    }
    badge.style.opacity = '1';

    setTimeout(() => {
        currentIdx++;
        renderNextCard();
    }, 800);
}

function updateUI() {
    const totalGoal = que.length;

    const progress = que.length-1>=correctCount ? Math.min((correctCount / totalGoal) * 100, 100) : 100;
    progressBar.style.width = `${progress}%`;
    counter.textContent = `${correctCount} / ${totalGoal}`;
}

function showDone() {
    stage.style.display = 'none';
    const doneScreen = document.getElementById('doneScreen');
    doneScreen.classList.add('visible');
    document.getElementById('scoreText').textContent = `회독 완료! (총 시도: ${totalAttempts}회)`;
}

window.restart = () => {
    quizStack = [...que];
    currentIdx = 0;
    correctCount = 0;
    totalAttempts = 0;
    animating = false;
    correctDisplay.textContent = '0';
    wrongDisplay.textContent = '0';
    stage.style.display = '';
    document.getElementById('doneScreen').classList.remove('visible');
    renderNextCard();
};

renderNextCard();