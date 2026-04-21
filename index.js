import { que } from './data_fixed.js';

// --- 전역 상태 및 상숫값 ---
const STORAGE_KEY = 'quiz_solved_data';
let solvedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {
    correctIds: [], 
    correctCount: 0,
    wrongCount: 0
};

let currentCorrect = solvedData.correctCount;
let currentWrong = solvedData.wrongCount;

const mainContainer = document.querySelector('.main');
const qCardTemplate = document.querySelector('.q-card');
const scoreG = document.querySelector('.dot.g + span');
const scoreR = document.querySelector('.dot.r + span');
const scoreTtl = document.querySelector('.dot.ttl + span');
const resetAllBtn = document.querySelector('.reset');

// --- 유틸리티 함수 ---
const updateUI = () => {
    if (scoreG) scoreG.innerText = currentCorrect;
    if (scoreR) scoreR.innerText = currentWrong;
    if (scoreTtl) scoreTtl.innerText = que.length;
};

const saveToLocal = () => {
    solvedData.correctCount = currentCorrect;
    solvedData.wrongCount = currentWrong;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(solvedData));
};

const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// --- 인터랙션: 애니메이션 (Flyer Effect) ---
const animateFly = (startRect, endEl, word) => {
    const flyer = document.createElement('div');
    flyer.innerText = word;
    flyer.style.cssText = `
        position: fixed;
        top: ${startRect.top}px;
        left: ${startRect.left}px;
        width: ${startRect.width}px;
        height: ${startRect.height}px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        z-index: 9999;
        pointer-events: none;
        transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    `;
    document.body.appendChild(flyer);

    const endRect = endEl.getBoundingClientRect();

    requestAnimationFrame(() => {
        flyer.style.top = `${endRect.top}px`;
        flyer.style.left = `${endRect.left}px`;
        flyer.style.transform = 'scale(0.6)';
        flyer.style.opacity = '0.5';
    });

    setTimeout(() => {
        flyer.remove();
        endEl.innerText = word;
        endEl.classList.add('filled');
        endEl.style.transform = 'scale(1.1)';
        setTimeout(() => endEl.style.transform = 'scale(1)', 150);
    }, 400);
};

// --- 인터랙션: 카드 위치 이동 애니메이션 ---
const moveCardWithGhost = (card) => {
    const rect = card.getBoundingClientRect();
    const ghost = card.cloneNode(true);
    
    ghost.style.cssText = `
        position: fixed; top: ${rect.top}px; left: ${rect.left}px;
        width: ${rect.width}px; z-index: 1000; pointer-events: none;
        transition: all 0.6s ease-in-out; opacity: 0.7;
    `;
    document.body.appendChild(ghost);

    card.style.visibility = 'hidden';
    mainContainer.appendChild(card); // 실제 데이터 맨 뒤로 이동

    const targetRect = card.getBoundingClientRect();
    
    requestAnimationFrame(() => {
        ghost.style.top = `${targetRect.top}px`;
        ghost.style.opacity = '0';
    });

    setTimeout(() => {
        ghost.remove();
        card.style.visibility = 'visible';
    }, 600);
};

// --- 메인 렌더링 로직 ---
const render = () => {
    if (!mainContainer || !qCardTemplate) return;
    mainContainer.innerHTML = '';
    updateUI();

    que.forEach((item, idx) => {
        if (solvedData.correctIds.includes(idx)) return;

        const card = qCardTemplate.cloneNode(true);
        card.style.display = 'block';
        const qTopic = card.querySelector('.q-topic');
        const qText = card.querySelector('.q-text');
        const choicesArea = card.querySelector('.choices');

        // 1. 상단 버튼 (힌트, 리셋)
        qTopic.innerHTML = '';
        const hBtn = document.createElement('button');
        hBtn.innerText = '💡 힌트';
        hBtn.className = 'btn-hint';
        const rBtn = document.createElement('button');
        rBtn.innerText = '🔄 리셋';
        rBtn.className = 'btn-reset';
        qTopic.append(hBtn, rBtn);

        // 2. 문제 텍스트 및 빈칸 생성 (순서 버그 방지 로직)
        const isSubMode = Math.random() > 0.5;
        const targets = (isSubMode && item.sub) ? [...item.sub] : [item.main];
        const sortedTargets = [...targets].sort((a, b) => b.length - a.length);
        
        let htmlContent = item.sentense;
        const regex = new RegExp(`(${sortedTargets.map(escapeRegExp).join('|')})`, 'g');
        qText.innerHTML = htmlContent.replace(regex, (m) => `<span class="blank" data-answer="${m}">?</span>`);

        // 3. 드롭 존(빈칸) 설정
        const blanks = card.querySelectorAll('.blank');
        blanks.forEach(b => {
            b.addEventListener('dragover', e => e.preventDefault());
            b.addEventListener('drop', e => {
                e.preventDefault();
                const word = e.dataTransfer.getData('text');
                const startRect = JSON.parse(e.dataTransfer.getData('rect'));
                animateFly(startRect, b, word);
            });
            b.onclick = () => {
                b.innerText = '?';
                b.classList.remove('filled');
                b.style.backgroundColor = '';
            };
        });

        // 4. 보기 버튼 생성
        choicesArea.innerHTML = '';
        const choicePool = [...new Set([...targets, ...getExtraWords(targets, 4 - targets.length)])].sort(() => Math.random() - 0.5);

        choicePool.forEach(word => {
            const btn = document.createElement('button');
            btn.className = 'choice';
            btn.innerText = word;
            btn.draggable = true;

            btn.addEventListener('dragstart', (e) => {
                const rect = btn.getBoundingClientRect();
                e.dataTransfer.setData('text', word);
                e.dataTransfer.setData('rect', JSON.stringify({top: rect.top, left: rect.left, width: rect.width, height: rect.height}));
            });

            btn.onclick = () => {
                const emptyBlank = card.querySelector('.blank:not(.filled)');
                if (emptyBlank) animateFly(btn.getBoundingClientRect(), emptyBlank, word);
            };
            choicesArea.appendChild(btn);
        });

        // 5. 제출 로직
        const sBtn = document.createElement('button');
        sBtn.innerText = '제출하기';
        sBtn.className = 'btn-submit';
        card.appendChild(sBtn);

        sBtn.onclick = () => {
            const currentBlanks = Array.from(card.querySelectorAll('.blank'));
            if (currentBlanks.some(b => !b.classList.contains('filled'))) return alert('빈칸을 채워주세요!');

            let isCorrect = false;
            if (item.opt === 1) {
                const user = currentBlanks.map(b => b.innerText.trim()).sort();
                const ans = currentBlanks.map(b => b.dataset.answer.trim()).sort();
                isCorrect = user.every((v, i) => v === ans[i]);
            } else {
                isCorrect = currentBlanks.every(b => b.innerText.trim() === b.dataset.answer.trim());
            }

            if (isCorrect) {
                currentCorrect++;
                solvedData.correctIds.push(idx);
                currentBlanks.forEach(b => b.style.backgroundColor = '#d4edda');
                saveToLocal();
                updateUI();
                setTimeout(() => {
                    card.style.opacity = '0';
                    card.style.transform = 'translateY(-20px)';
                    card.style.transition = '0.4s';
                    setTimeout(() => card.remove(), 400);
                }, 500);
            } else {
                currentWrong++;
                updateUI();
                currentBlanks.forEach(b => b.style.backgroundColor = '#f8d7da');
                setTimeout(() => {
                    currentBlanks.forEach(b => { b.innerText = '?'; b.classList.remove('filled'); b.style.backgroundColor = ''; });
                    moveCardWithGhost(card);
                }, 800);
            }
        };

        // 6. 힌트 및 리셋
        hBtn.onclick = () => {
            const original = qText.innerHTML;
            qText.innerText = item.sentense;
            hBtn.disabled = true;
            let count = 3;
            const timer = setInterval(() => {
                hBtn.innerText = `⏳ ${count}s`;
                if (count <= 0) {
                    clearInterval(timer);
                    qText.innerHTML = original;
                    hBtn.innerText = '💡 힌트';
                    hBtn.disabled = false;
                    moveCardWithGhost(card);
                }
                count--;
            }, 1000);
        };

        rBtn.onclick = () => {
            card.querySelectorAll('.blank').forEach(b => { b.innerText = '?'; b.classList.remove('filled'); b.style.backgroundColor = ''; });
        };

        mainContainer.appendChild(card);
    });
};

const getExtraWords = (exclude, count) => {
    const pool = [];
    que.forEach(q => { pool.push(q.main); if(q.sub) q.sub.forEach(s => pool.push(s)); });
    return [...new Set(pool)].filter(w => !exclude.includes(w)).sort(() => Math.random() - 0.5).slice(0, count);
};

if (resetAllBtn) resetAllBtn.onclick = () => { if(confirm('초기화하시겠습니까?')) { localStorage.removeItem(STORAGE_KEY); location.reload(); } };

render();
