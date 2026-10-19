/**
 * Patente B - Exam Simulator & Crash Course Engine
 * Self-contained, lightweight, zero dependencies.
 */

// Application State
let totalQuestionsCount = 30;
let timeLimitSeconds = 20 * 60; // 20:00
let maxAllowedErrors = 3;

let questionBank = [];
let questionMap = {};
let examSet = [];
let answers = {};
let curIndex = 0;
let timeLeft = timeLimitSeconds;
let timerId = null;
let examCompleted = false;
let reviewMode = false;
let currentQuizLessonId = null; // null = full exam, 1..15 = topic quiz

let currentSelectedLessonId = 1;

// Initialize when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  if (window.ALL_QUESTIONS && window.ALL_QUESTIONS.length > 0) {
    setupApp(window.ALL_QUESTIONS);
  } else {
    fetch('questions.json')
      .then(res => res.json())
      .then(data => setupApp(data))
      .catch(err => alert("Errore nel caricamento delle domande: " + err.message));
  }

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (document.getElementById('examSimulatorSection').style.display === 'none') return;
    if (e.key === 'v' || e.key === 'V') selectAnswer('V');
    else if (e.key === 'f' || e.key === 'F') selectAnswer('F');
    else if (e.key === 'ArrowRight') goNext();
    else if (e.key === 'ArrowLeft') goPrev();
  });
});

function setupApp(pool) {
  questionBank = pool;
  questionMap = {};
  for (let q of pool) {
    questionMap[q.id] = q;
  }

  initLessonsSidebar();
  renderLessonDetails(1);
  startNewExam();
}

// Switch between Exam Mode and Lessons Mode
function setAppMode(mode) {
  const examSec = document.getElementById('examSimulatorSection');
  const lessonsSec = document.getElementById('lessonsModuleSection');
  const btnExam = document.getElementById('btnModeExam');
  const btnLessons = document.getElementById('btnModeLessons');

  if (mode === 'exam') {
    examSec.style.display = 'flex';
    lessonsSec.style.display = 'none';
    btnExam.classList.add('active');
    btnLessons.classList.remove('active');
  } else {
    examSec.style.display = 'none';
    lessonsSec.style.display = 'flex';
    btnExam.classList.remove('active');
    btnLessons.classList.add('active');
  }
}

// ==========================================
// LESSONS MODULE
// ==========================================
function initLessonsSidebar() {
  const container = document.getElementById('lessonsListButtons');
  container.innerHTML = '';
  if (!window.LESSONS_DATA) return;

  window.LESSONS_DATA.forEach(l => {
    const btn = document.createElement('button');
    btn.className = 'lesson-item-btn' + (l.id === currentSelectedLessonId ? ' active' : '');
    btn.id = 'lessonBtn_' + l.id;
    btn.onclick = () => selectLesson(l.id);
    btn.innerHTML = `
      <span>${l.icon}</span>
      <span style="flex:1;"><strong>درس ${l.id}:</strong> ${l.title_fa}</span>
      <span class="lesson-item-badge">${l.qCount} سوال</span>
    `;
    container.appendChild(btn);
  });
}

function selectLesson(lessonId) {
  currentSelectedLessonId = lessonId;
  document.querySelectorAll('.lesson-item-btn').forEach(b => b.classList.remove('active'));
  const activeBtn = document.getElementById('lessonBtn_' + lessonId);
  if (activeBtn) activeBtn.classList.add('active');
  renderLessonDetails(lessonId);
}

function renderLessonDetails(lessonId) {
  const main = document.getElementById('lessonMainContent');
  if (!window.LESSONS_DATA) return;
  const lesson = window.LESSONS_DATA.find(l => l.id === lessonId);
  if (!lesson) return;

  const rulesHTML = lesson.rules.map(r => `<div class="rule-bullet">${formatMarkdown(r)}</div>`).join('');

  let numbersHTML = '';
  if (lesson.numbers && lesson.numbers.length > 0) {
    numbersHTML = `
      <div class="lesson-section-box" style="margin-top:16px;">
        <div class="section-header-title">📊 جدول اعداد و مقادیر طلایی این درس:</div>
        <table class="numbers-table">
          <thead>
            <tr>
              <th>موضوع / مورد</th>
              <th>مقدار قانونی دقیق</th>
              <th>نکته کنکوری</th>
            </tr>
          </thead>
          <tbody>
            ${lesson.numbers.map(n => `
              <tr>
                <td><strong>${n.label}</strong></td>
                <td style="color:#092c53; font-weight:bold; direction:ltr;">${n.val}</td>
                <td style="color:#555;">${n.note}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  let imagesHTML = '';
  if (lesson.key_images && lesson.key_images.length > 0) {
    imagesHTML = `
      <div class="lesson-section-box">
        <div class="section-header-title">🖼️ تابلوها و علائم کلیدی این درس (با پیام تک‌خطی):</div>
        <div class="images-grid">
          ${lesson.key_images.map(img => `
            <div class="sign-card">
              <img src="image/${img.img}" alt="${img.title}">
              <div class="sign-card-title">${img.title}</div>
              <div class="sign-card-desc">${img.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  let trapsHTML = '';
  if (lesson.traps && lesson.traps.length > 0) {
    trapsHTML = `
      <div class="trap-box">
        <div class="trap-header">⚠️ تله‌های پرتکرار امتحانی در این درس (Trabocchetti):</div>
        ${lesson.traps.map(t => `<div class="trap-item">${t}</div>`).join('')}
      </div>
    `;
  }

  main.innerHTML = `
    <div class="lesson-header">
      <div>
        <div class="lesson-title-fa">
          <span>${lesson.icon}</span>
          <span>درس ${lesson.id}: ${lesson.title_fa}</span>
        </div>
        <span class="lesson-title-it">${lesson.title_it} (${lesson.qCount} سوال در بانک رسمی)</span>
      </div>
      <div>
        <button class="btn-take-quiz" onclick="startLessonQuiz(${lesson.id})">
          <span>🎯</span>
          <span>شروع کوئیز ۱۰ سوالی این درس</span>
        </button>
      </div>
    </div>

    <div class="lesson-section-box">
      <div class="section-header-title">💡 قواعد، اصول و منطق کلیدی:</div>
      ${rulesHTML}
    </div>

    ${numbersHTML}
    ${imagesHTML}
    ${trapsHTML}

    <div style="text-align:center; margin: 24px 0 10px;">
      <button class="btn-take-quiz" style="margin: 0 auto; padding: 12px 28px; font-size:16px;" onclick="startLessonQuiz(${lesson.id})">
        <span>🚀 شروع آزمون تستی این درس (۱۰ سوال هدفمند)</span>
      </button>
    </div>
  `;
}

// Start a 10-question quiz targeted to a specific lesson
function startLessonQuiz(lessonId) {
  const lesson = window.LESSONS_DATA.find(l => l.id === lessonId);
  if (!lesson || !lesson.question_ids || lesson.question_ids.length === 0) return;

  currentQuizLessonId = lessonId;
  totalQuestionsCount = 10;
  timeLimitSeconds = 7 * 60; // 7 minutes
  maxAllowedErrors = 1;

  const qPool = lesson.question_ids.map(id => questionMap[id]).filter(Boolean);
  const shuffled = [...qPool].sort(() => 0.5 - Math.random());
  examSet = shuffled.slice(0, 10);

  document.getElementById('lblTitleScheda').textContent = 'QUIZ';
  document.getElementById('lblTitleEsame').textContent = 'LEZIONE ' + lessonId;
  document.getElementById('examTabsBar').style.display = 'none';

  setAppMode('exam');
  runQuizEngine();
}

// Start a full 30-question official exam
function startNewExam() {
  currentQuizLessonId = null;
  totalQuestionsCount = 30;
  timeLimitSeconds = 20 * 60; // 20:00 minutes
  maxAllowedErrors = 3;

  document.getElementById('lblTitleScheda').textContent = 'SCHEDA';
  document.getElementById('lblTitleEsame').textContent = 'ESAME';
  document.getElementById('examTabsBar').style.display = 'grid';

  const shuffled = [...questionBank].sort(() => 0.5 - Math.random());
  examSet = shuffled.slice(0, 30);

  runQuizEngine();
}

function runQuizEngine() {
  closeAllModals();
  examCompleted = false;
  reviewMode = false;
  answers = {};
  curIndex = 0;

  clearInterval(timerId);
  timeLeft = timeLimitSeconds;
  updateTimerUI();
  timerId = setInterval(() => {
    if (timeLeft > 0) {
      timeLeft--;
      updateTimerUI();
    } else {
      clearInterval(timerId);
      alert("Tempo scaduto! Correzione automatica della scheda.");
      proceedGrading();
    }
  }, 1000);

  document.getElementById('btnCorreggi').textContent = 'Correggi';
  document.getElementById('farsiContentBox').classList.remove('open');
  initNavRows();
  render();
}

function updateTimerUI() {
  const min = Math.floor(timeLeft / 60);
  const sec = timeLeft % 60;
  const el = document.getElementById('timerBox');
  el.textContent = `Timer  ${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  if (timeLeft <= 180) el.classList.add('hurry');
  else el.classList.remove('hurry');
}

function getGroup(idx) {
  return Math.floor(idx / 10);
}

function switchGroup(group) {
  curIndex = group * 10;
  render();
}

function jumpTo(idx) {
  if (idx >= 0 && idx < totalQuestionsCount) {
    curIndex = idx;
    render();
  }
}

function goNext() {
  if (curIndex < totalQuestionsCount - 1) {
    curIndex++;
    render();
  }
}

function goPrev() {
  if (curIndex > 0) {
    curIndex--;
    render();
  }
}

function selectAnswer(val) {
  if (examCompleted && reviewMode) return;
  if (answers[curIndex] === val) {
    delete answers[curIndex];
  } else {
    answers[curIndex] = val;
  }
  render();
}

function initNavRows() {
  const smallContainer = document.getElementById('smallNavRow');
  smallContainer.innerHTML = '';
  smallContainer.style.gridTemplateColumns = `repeat(${totalQuestionsCount}, 1fr)`;

  for (let i = 0; i < totalQuestionsCount; i++) {
    const btn = document.createElement('div');
    btn.id = 'smallBtn_' + i;
    btn.className = 'small-btn';
    btn.textContent = i + 1;
    btn.onclick = () => jumpTo(i);
    smallContainer.appendChild(btn);
  }
}

function updateNavUI() {
  const grp = getGroup(curIndex);
  document.getElementById('tab0').className = 'tab-btn' + (grp === 0 ? ' active' : '');
  document.getElementById('tab1').className = 'tab-btn' + (grp === 1 ? ' active' : '');
  document.getElementById('tab2').className = 'tab-btn' + (grp === 2 ? ' active' : '');

  // Big 10 row
  const bigContainer = document.getElementById('bigNavRow');
  bigContainer.innerHTML = '';
  const start = grp * 10;
  const countInGrp = Math.min(10, totalQuestionsCount - start);

  for (let i = 0; i < countInGrp; i++) {
    const qIdx = start + i;
    const btn = document.createElement('div');
    btn.className = 'big-btn';
    btn.textContent = qIdx + 1;

    if (qIdx === curIndex) btn.classList.add('active');
    if (answers[qIdx]) btn.classList.add('answered');

    if (reviewMode) {
      const isCorrect = answers[qIdx] === examSet[qIdx].answer;
      btn.classList.add(isCorrect ? 'review-correct' : 'review-wrong');
    }

    btn.onclick = () => jumpTo(qIdx);
    bigContainer.appendChild(btn);
  }

  // Small row
  for (let i = 0; i < totalQuestionsCount; i++) {
    const btn = document.getElementById('smallBtn_' + i);
    if (!btn) continue;
    btn.className = 'small-btn';
    if (i === curIndex) btn.classList.add('active');
    if (answers[i]) btn.classList.add('answered');

    if (reviewMode) {
      const isCorrect = answers[i] === examSet[i].answer;
      btn.classList.add(isCorrect ? 'review-correct' : 'review-wrong');
    }
  }
}

function formatMarkdown(desc) {
  if (!desc) return '<p style="color:#777;">توضیحات و ترجمه اختصاصی برای این سوال ثبت نشده است.</p>';

  let html = desc
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/^### (.*$)/gim, '<h4 style="color:#1b5e20; margin: 10px 0 4px; font-size:14.5px;">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="color:#092c53; margin: 12px 0 6px; font-size:15.5px;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong style="color:#000;">$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^- (.*$)/gim, '<div style="margin-right:12px; margin-bottom:3px;">• $1</div>');

  if (html.includes('|')) {
    const lines = html.split('\n');
    let inTable = false;
    let tableHTML = '<table>';
    let newLines = [];

    for (let line of lines) {
      line = line.trim();
      if (line.startsWith('|') && line.endsWith('|')) {
        if (line.includes('---')) continue;
        const cells = line.split('|').slice(1, -1);
        if (!inTable) {
          inTable = true;
          tableHTML += '<tr>' + cells.map(c => `<th>${c.trim()}</th>`).join('') + '</tr>';
        } else {
          tableHTML += '<tr>' + cells.map(c => `<td>${c.trim()}</td>`).join('') + '</tr>';
        }
      } else {
        if (inTable) {
          tableHTML += '</table>';
          newLines.push(tableHTML);
          tableHTML = '<table>';
          inTable = false;
        }
        newLines.push(line);
      }
    }
    if (inTable) tableHTML += '</table>', newLines.push(tableHTML);
    html = newLines.join('<br>');
  } else {
    html = html.replace(/\n/g, '<br>');
  }

  return html;
}

function render() {
  if (!examSet.length) return;
  const q = examSet[curIndex];

  document.getElementById('qNumberCorner').textContent = curIndex + 1;
  document.getElementById('qText').textContent = q.text;

  const img = document.getElementById('qImage');
  if (q.image && q.image.trim() !== '') {
    img.src = 'image/' + q.image.trim();
    img.style.display = 'block';
  } else {
    img.src = '';
    img.style.display = 'none';
  }

  const optV = document.getElementById('choiceVero');
  const optF = document.getElementById('choiceFalso');
  optV.className = 'vf-choice';
  optF.className = 'vf-choice';

  const userAns = answers[curIndex];
  if (userAns === 'V') optV.classList.add('selected');
  if (userAns === 'F') optF.classList.add('selected');

  if (reviewMode) {
    if (q.answer === 'V') optV.classList.add('is-correct');
    if (q.answer === 'F') optF.classList.add('is-correct');

    if (userAns && userAns !== q.answer) {
      if (userAns === 'V') optV.classList.add('is-wrong');
      if (userAns === 'F') optF.classList.add('is-wrong');
    }
  }

  const farsiBox = document.getElementById('farsiContentBox');
  const ansText = q.answer === 'V' ? 'Vero (درست)' : 'Falso (نادرست)';
  const ansColor = q.answer === 'V' ? '#2e7d32' : '#c62828';

  let headerHTML = '';
  if (reviewMode) {
    headerHTML = `<div style="font-weight:bold; margin-bottom:8px; font-size:14.5px;">
      🇮🇷 پاسخ صحیح: <span style="color:${ansColor};">${ansText}</span>
      ${userAns ? ` | پاسخ شما: <strong>${userAns === 'V' ? 'Vero' : 'Falso'}</strong>` : ' | (بدون پاسخ)'}
    </div>`;
  } else {
    headerHTML = `<div style="font-size:12.5px; color:#555; margin-bottom:6px;">
      (نکته: در حین آزمون، پاسخ برای تست آمادگی شما مخفی است و با کلیک روی Correggi نمایان خواهد شد.)
    </div>`;
  }

  farsiBox.innerHTML = headerHTML + formatMarkdown(q.description);
  updateNavUI();
}

function toggleFarsiDrawer() {
  document.getElementById('farsiContentBox').classList.toggle('open');
}

function onCorreggiClicked() {
  if (examCompleted) {
    document.getElementById('modalResult').classList.add('show');
    return;
  }

  const answeredTotal = Object.keys(answers).length;
  if (answeredTotal < totalQuestionsCount) {
    const remaining = totalQuestionsCount - answeredTotal;
    document.getElementById('confirmText').innerHTML = `
      Hai risposto a <strong>${answeredTotal}</strong> domande su <strong>${totalQuestionsCount}</strong>.<br>
      Ci sono ancora <strong>${remaining}</strong> domande senza پاسخ!<br><br>
      Vuoi davvero terminare e correggere la scheda?
    `;
    document.getElementById('modalConfirm').classList.add('show');
  } else {
    proceedGrading();
  }
}

function proceedGrading() {
  closeModal('modalConfirm');
  clearInterval(timerId);
  examCompleted = true;

  let errors = 0;
  let correct = 0;
  let unanswered = 0;

  for (let i = 0; i < totalQuestionsCount; i++) {
    const u = answers[i];
    const c = examSet[i].answer;
    if (!u) {
      unanswered++;
      errors++;
    } else if (u === c) {
      correct++;
    } else {
      errors++;
    }
  }

  const isPassed = errors <= maxAllowedErrors;
  const pill = document.getElementById('resultPill');
  pill.textContent = isPassed ? 'IDONEO (SUPERATO)' : 'BOCCIATO (NON SUPERATO)';
  pill.className = 'result-pill ' + (isPassed ? 'result-idoneo' : 'result-bocciato');

  const usedMin = Math.floor((timeLimitSeconds - timeLeft) / 60);
  const usedSec = (timeLimitSeconds - timeLeft) % 60;

  document.getElementById('scoreBreakdown').innerHTML = `
    • <strong>Esito:</strong> ${isPassed ? '<span style="color:#2e7d32; font-weight:bold;">Idoneo (Promosso)</span>' : '<span style="color:#c62828; font-weight:bold;">Non idoneo (Bocciato)</span>'}<br>
    • <strong>Errori commessi:</strong> <span style="font-size:18px; font-weight:bold; color:${errors > maxAllowedErrors ? '#c62828' : '#2e7d32'};">${errors}</span> (Massimo consentito: ${maxAllowedErrors})<br>
    • <strong>Risposte corrette:</strong> ${correct} su ${totalQuestionsCount}<br>
    • <strong>Non risposte:</strong> ${unanswered}<br>
    • <strong>Tempo impiegato:</strong> ${usedMin} min e ${usedSec} sec
  `;

  const restartBtn = document.getElementById('btnRestartQuiz');
  if (currentQuizLessonId) {
    restartBtn.textContent = 'Rifai Quiz Lezione ' + currentQuizLessonId;
    restartBtn.onclick = () => startLessonQuiz(currentQuizLessonId);
  } else {
    restartBtn.textContent = 'Nuova Scheda Esame';
    restartBtn.onclick = () => startNewExam();
  }

  document.getElementById('modalResult').classList.add('show');
}

function openReviewMode() {
  closeModal('modalResult');
  reviewMode = true;
  curIndex = 0;
  document.getElementById('farsiContentBox').classList.add('open');
  render();
}

function openOverview() {
  const matrix = document.getElementById('overviewMatrix');
  matrix.innerHTML = '';

  for (let i = 0; i < totalQuestionsCount; i++) {
    const itm = document.createElement('div');
    itm.className = 'matrix-item';
    const ans = answers[i] ? ` [${answers[i]}]` : ' [ - ]';
    itm.textContent = `D. ${i + 1}${ans}`;

    if (answers[i]) itm.classList.add('has-answer');

    if (reviewMode) {
      const isCorrect = answers[i] === examSet[i].answer;
      itm.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
    }

    itm.onclick = () => {
      closeModal('modalOverview');
      jumpTo(i);
    };
    matrix.appendChild(itm);
  }

  document.getElementById('modalOverview').classList.add('show');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

function closeAllModals() {
  closeModal('modalResult');
  closeModal('modalConfirm');
  closeModal('modalOverview');
}
