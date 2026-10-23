(function () {
  'use strict';
  const H = Hospital;
  const storageKey = 'hospital-bug-mvp-v1';
  const stages = ['intro', 'route1', 'dialogue', 'route2', 'puzzle', 'route3', 'handoff', 'testing', 'complete'];
  const freshState = () => ({ stage: 'intro', question: 0, order: [...H.initialOrder], branches: { schedule: '', available: '', cancel: '' }, flowSlots: Array(5).fill(null), testDone: [] });
  let state = freshState();
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && stages.includes(saved.stage)) {
      state = { ...state, ...saved };
      state.question = Math.max(0, Math.min(4, Number.isInteger(saved.question) ? saved.question : 0));
      state.order = Array.isArray(saved.order) && saved.order.length === 5 && new Set(saved.order).size === 5 && saved.order.every(id => Object.hasOwn(H.blocks, id)) ? saved.order : [...H.initialOrder];
      if (!Array.isArray(saved.flowSlots) || saved.flowSlots.length !== 5) state.flowSlots = saved.stage === 'puzzle' ? [...state.order] : Array(5).fill(null);
      state.branches = { ...freshState().branches, ...(saved.branches && typeof saved.branches === 'object' ? saved.branches : {}) };
      state.testDone = Array.isArray(saved.testDone) ? H.scenarios.filter(item => saved.testDone.includes(item.id)).map(item => item.id) : [];
    }
  } catch { storageAvailable = false; }

  const overlay = document.getElementById('overlay');
  let currentScreen = '';
  let returnScreen = '';
  let toastTimeout;
  let system;
  let testResults = {};
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const button = (text, action, type = '', extra = '') => `<button class="button ${type}" data-action="${action}" ${extra}>${text}</button>`;
  const speaker = (name, role, initials) => `<div class="speaker"><div class="portrait">${initials}</div><div><strong>${name}</strong><small>${role}</small></div></div>`;
  const game = new H.Game(document.getElementById('game'), level => transition(['dialogue', 'puzzle', 'handoff'][level]));
  H.appState = state;
  const designer = new H.Designer({
    overlay, getState: () => state, save, showModal,
    onFinish: () => transition('route3'), onNotebook: openNotebook,
  });

  function save() {
    H.appState = state;
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch { storageAvailable = false; }
    document.getElementById('save-status').textContent = storageAvailable ? 'Прогресс сохраняется в этом браузере' : 'Прогресс доступен до закрытия страницы';
    updateMission();
  }

  function toast(message) {
    const element = document.getElementById('toast');
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => element.classList.remove('visible'), 3200);
  }

  function showModal(screen, html, wide = false) {
    document.body.classList.remove('designer-open');
    if (overlay.parentElement !== document.getElementById('canvas-wrap')) document.getElementById('canvas-wrap').appendChild(overlay);
    overlay.classList.remove('design-overlay', 'dragging-block');
    currentScreen = screen;
    game.paused = true;
    game.clearInput();
    game.setPrompt('');
    overlay.hidden = false;
    overlay.innerHTML = `<section class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${html}</section>`;
    overlay.querySelector('button:not([disabled]), select, summary')?.focus({ preventScroll: true });
  }

  function resume() {
    document.body.classList.remove('designer-open');
    if (overlay.parentElement !== document.getElementById('canvas-wrap')) document.getElementById('canvas-wrap').appendChild(overlay);
    currentScreen = '';
    overlay.hidden = true;
    overlay.innerHTML = '';
    game.paused = false;
    game.clearInput();
    document.getElementById('game').focus({ preventScroll: true });
  }

  function updateMission() {
    const phase = ({ intro: 0, route1: 0, dialogue: 1, route2: 2, puzzle: 2, route3: 3, handoff: 3, testing: 3, complete: 4 })[state.stage];
    document.getElementById('quest-list').innerHTML = H.quests.map((quest, index) => `<li class="quest-item ${index < phase ? 'done' : index === phase ? 'active' : ''}"><span class="quest-number">${index < phase ? '✓' : `0${index + 1}`}</span><div><strong>${quest.title}</strong><small>${quest.text}</small></div></li>`).join('');
    const progress = ({ intro: 0, route1: 5, dialogue: 15 + state.question * 8, route2: 50, puzzle: 55, route3: 75, handoff: 80, testing: 80 + state.testDone.length * 3, complete: 100 })[state.stage];
    document.getElementById('progress-label').textContent = `${progress}%`;
    document.getElementById('progress-bar').style.width = `${progress}%`;
    document.getElementById('requirement-count').textContent = `${state.question}/4`;
    const tips = ['Хороший аналитик сначала понимает проблему, а уже потом предлагает решение.', 'Заказчик говорит о проблемах. Твоя задача — превратить их в понятные правила.', 'У каждого «а что, если…» должна быть своя ветка в алгоритме.', 'Проверяй и успешную запись, и отказ, и отмену. Все сценарии важны.', 'Ты соединил потребности больницы с понятным решением для разработчика.'];
    document.getElementById('analyst-tip').textContent = tips[phase];
    document.getElementById('hospital-status').textContent = state.stage === 'complete' ? 'Система записи: работает' : 'Система записи: сбой';
    document.getElementById('hospital-status').style.color = state.stage === 'complete' ? '#96c9ac' : '';
  }

  function setRoute(level) {
    game.setLevel(level);
    document.getElementById('scene-title').textContent = ['01 / БОЛЬНИЧНЫЙ КОРИДОР', '02 / ПУТЬ В КАБИНЕТ', '03 / ОБРАТНО В IT-ОТДЕЛ'][level];
    document.getElementById('scene-objective').textContent = ['Доберись до регистратуры →', 'Две кнопки откроют проход →', 'Программист ждёт решение →'][level];
    document.getElementById('floor-label').textContent = ['1 ЭТАЖ · РЕГИСТРАТУРА', '2 ЭТАЖ · КАБИНЕТ АНАЛИТИКА', '1 ЭТАЖ · IT-ОТДЕЛ'][level];
  }

  function transition(stage) { state.stage = stage; save(); renderStage(); }

  function renderStage() {
    const level = ['route2', 'puzzle'].includes(state.stage) ? 1 : ['route3', 'handoff', 'testing', 'complete'].includes(state.stage) ? 2 : 0;
    setRoute(level);
    renderScreen(state.stage.startsWith('route') ? '' : state.stage);
  }

  function renderScreen(screen) {
    if (!screen) return resume();
    ({ intro: renderIntro, dialogue: renderDialogue, puzzle: renderPuzzle, handoff: renderHandoff, testing: renderTesting, complete: renderComplete })[screen]?.();
  }

  function renderIntro() {
    showModal('intro', `<div class="modal-eyebrow">НОВАЯ МИССИЯ · СБОЙ РАСПИСАНИЯ</div>${speaker('Макс', 'Программист больницы', 'М')}<h2 id="modal-title">У нас тут небольшой…<br>большой баг.</h2><p class="speech">«Три пациента записаны к одному врачу на 14:00. Я исправлю код, но сначала нужно понять правила записи. Сходишь к руководителю регистратуры?»</p><p>Ты — системный аналитик. Собери требования, продумай алгоритм и помоги Максу исправить систему.</p><div class="intro-controls"><span><kbd>A</kbd><kbd>D</kbd> идти</span><span><kbd>Пробел</kbd> прыгать</span><span><kbd>E</kbd> говорить</span></div><div class="modal-actions">${button('Беру дело →', 'start')}</div><p class="small-help">Короткая демоверсия · 5–8 минут · без ограничения попыток</p>`);
  }

  function renderDialogue(feedback = null) {
    if (state.question >= 4 && !feedback) return renderRequirementsSummary();
    const questionIndex = feedback?.correct ? state.question - 1 : state.question;
    const question = H.questions[questionIndex];
    const explanation = feedback ? question.explanations[feedback.selected] : '';
    const feedbackHtml = !feedback ? '' : `
      <div class="feedback client-feedback ${feedback.correct ? '' : 'error'}" role="status">
        <strong>${feedback.correct ? 'Верно!' : 'Пока не совсем.'}</strong>
        <p>${explanation}</p>
        ${feedback.correct ? `<div class="accepted-requirement"><strong>${H.requirements[questionIndex].id} добавлено в ТЗ</strong></div>` : '<span class="retry-label">Попробуй ещё раз.</span>'}
      </div>`;
    showModal('dialogue', `<div class="client-dialogue">
      <div class="modal-eyebrow">ВСТРЕЧА С ЗАКАЗЧИКОМ · ЗАДАЧА ${questionIndex + 1} / 4</div>
      <div class="dialogue-progress">${H.questions.map((_, index) => `<span class="${index < questionIndex ? 'done' : index === questionIndex ? 'active' : ''}"></span>`).join('')}</div>
      <h2 id="modal-title">Объясни задачу программисту.</h2>
      <p class="client-instruction">Выбери ответ, который объясняет, что должна делать программа.</p>
      <div class="client-layout">
        <div class="client-brief">
          ${speaker('Елена Сергеевна', 'Руководитель регистратуры', 'Е')}
          <div class="client-section-label">ЗАКАЗЧИК ХОЧЕТ</div><h3>${question.goal}</h3>
          <p class="speech">«${question.speech}»</p>
        </div>
        <div class="client-options"><div class="question-label">${question.question}</div>
          <div class="answers">${question.options.map((option, index) => `<button class="answer ${feedback?.selected === index ? feedback.correct ? 'correct' : 'wrong' : ''}" data-action="answer" data-index="${index}" ${feedback?.correct ? 'disabled' : ''}><span>${feedback?.correct && index === question.correct ? '✓' : index + 1}</span>${option}</button>`).join('')}</div>
        </div>
      </div>
      ${feedbackHtml}
      ${feedback?.correct ? `<div class="modal-actions">${button(state.question === 4 ? 'Посмотреть ТЗ →' : 'Дальше →', 'next-question')}</div>` : ''}
    </div>`, true);
    // Keep the explanation visible when the dialog needs scrolling on a small screen.
    if (feedback) overlay.querySelector('.client-feedback')?.scrollIntoView({ block: 'nearest' });
  }

  function requirementCards() {
    return `<div class="requirements">${H.requirements.map((item, index) => `<div class="requirement${index >= state.question ? ' locked' : ''}"><code>${index < state.question ? item.id : '???'}</code><p>${index < state.question ? item.text : 'Требование ещё не собрано'}</p></div>`).join('')}</div>`;
  }

  function renderRequirementsSummary() {
    showModal('dialogue', `<div class="modal-eyebrow">ДОКУМЕНТ СОБРАН · ТЗ № 001</div><h2 id="modal-title">Теперь программист знает, что делать!</h2><p>Ты превратил пожелания заказчика в четыре правила для программы. Это и есть часть работы системного аналитика.</p>${requirementCards()}<div class="modal-actions">${button('В кабинет аналитика →', 'to-office')}</div>`);
  }

  function renderPuzzle() { designer.render(); }

  function renderHandoff() {
    showModal('handoff', `<div class="modal-eyebrow">ПЕРЕДАЧА РЕШЕНИЯ · IT-ОТДЕЛ</div>${speaker('Макс', 'Программист больницы', 'М')}<h2 id="modal-title">Вот теперь всё понятно.</h2><p class="speech">«Ты собрал требования и схему: проверяем расписание и доступность, создаём запись, отправляем подтверждение. При отмене освобождаем слот. Реализую эти правила!»</p><p>Проверим вместе, как работает исправленная система: успешная запись, конфликт, нерабочее время и отмена.</p><div class="modal-actions">${button('Запустить проверку →', 'start-testing')}</div>`);
  }

  function executeScenario(id) {
    if (id === 'anna') return system.book('Анна', 10);
    if (id === 'ivan' || id === 'retry') return system.book('Иван', 10);
    if (id === 'maria') return system.book('Мария', 20);
    if (id === 'cancel') return system.cancel('Анна', 10);
  }

  function restoreSystem() {
    system = H.createBookingSystem();
    testResults = {};
    const validDone = [];
    H.scenarios.forEach(scenario => {
      if (!state.testDone.includes(scenario.id) || !((scenario.requires || []).every(id => validDone.includes(id)))) return;
      const result = executeScenario(scenario.id);
      if (result.status === scenario.expected) { testResults[scenario.id] = result; validDone.push(scenario.id); }
    });
    state.testDone = validDone;
  }

  function renderTesting(message = '') {
    if (!system) restoreSystem();
    const done = state.testDone.length === H.scenarios.length;
    showModal('testing', `<div class="modal-eyebrow">ПРИЁМКА РЕШЕНИЯ · ${state.testDone.length} / ${H.scenarios.length} ПРОВЕРОК</div><h2 id="modal-title">Выдержит ли система проверку?</h2><p>Запускай сценарии. Система действительно хранит запись, отклоняет конфликт и освобождает время после отмены.</p><div class="scenario-list">${H.scenarios.map(scenario => {
      const passed = state.testDone.includes(scenario.id);
      const ready = (scenario.requires || []).every(id => state.testDone.includes(id));
      const statusNames = { booked: 'Запись создана', occupied: 'Конфликт отклонён', 'off-hours': 'Отказ по расписанию', cancelled: 'Слот освобождён' };
      return `<button class="scenario-button${passed ? ' passed' : ''}" data-action="scenario" data-id="${scenario.id}" ${passed || !ready ? 'disabled' : ''}><span><strong>${scenario.name}</strong><small>${scenario.description}</small></span><span class="scenario-result">${passed ? `✓ ${statusNames[testResults[scenario.id]?.status]}` : ready ? 'Запустить →' : 'После предыдущих проверок'}</span></button>`;
    }).join('')}</div><div class="terminal" role="status">${escapeHtml(message || (done ? 'Все сценарии пройдены. Ошибка больше не воспроизводится.' : '› Ожидание сценария… Врач работает с 09:00 до 18:00.'))}</div><div class="modal-actions">${done ? button('Завершить миссию →', 'finish', 'dark') : '<span class="small-help">Каждая проверка запускается отдельной кнопкой.</span>'}</div>`, true);
  }

  function renderComplete() {
    showModal('complete', `<div class="modal-eyebrow">МИССИЯ 001 · ВЫПОЛНЕНО</div><div class="completion-mark">✓</div><h2 id="modal-title">В расписании снова порядок.</h2><p class="speech">Больница работает, пациенты получают своё время, а Макс исправил именно то, что нужно.</p><p><strong>Ты попробовал работу системного аналитика:</strong> выяснил потребности заказчика, записал требования, спроектировал логику и проверил результат вместе с разработчиком.</p><div class="win-stats"><div><strong>4</strong><span>требования</span></div><div><strong>3</strong><span>ветки алгоритма</span></div><div><strong>5/5</strong><span>проверок пройдено</span></div></div><div class="modal-actions">${button('Посмотреть ТЗ', 'notebook', 'secondary')}${button('Пройти ещё раз ↻', 'replay')}</div>`);
  }

  function openNotebook() {
    returnScreen = currentScreen;
    showModal('notebook', `<div class="modal-eyebrow">БЛОКНОТ АНАЛИТИКА · ТЗ № 001</div><h2 id="modal-title">Система записи пациентов</h2><p>Собрано требований: ${state.question} из 4. ${state.question < 4 ? 'Остальные появятся после разговора с заказчиком.' : 'Используй эти правила в алгоритме и при проверке.'}</p>${requirementCards()}<div class="modal-actions">${button('Вернуться в игру', 'back')}</div>`);
  }

  function openHelp() {
    returnScreen = currentScreen;
    showModal('help', `<div class="modal-eyebrow">КАК ИГРАТЬ</div><h2 id="modal-title">Твой первый день аналитиком.</h2><p><strong>A / D или ← / →</strong> — идти. <strong>Пробел / W / ↑</strong> — прыгать. <strong>E</strong> — нажать кнопку, поговорить или открыть компьютер. Работает и с русской раскладкой.</p><p>Перепрыгивай лужи и тележки. У кнопки нажми E, чтобы открыть дверь. Во втором коридоре нужны две кнопки. За ошибки нет штрафа — пробуй снова.</p><p>В диалоге выбирай точное правило. В кабинете перемещай блоки стрелками и настраивай ветки. Затем вернись к Максу и проверь систему.</p><p>Для отдельной механики используй «Быстрый показ» под игрой. На телефоне доступны экранные кнопки.</p><div class="modal-actions">${button('Понятно, играем →', 'back')}</div>`);
  }

  function openRestart() {
    returnScreen = currentScreen;
    showModal('restart', `<div class="modal-eyebrow">НОВОЕ ПРОХОЖДЕНИЕ</div><h2 id="modal-title">Начать смену заново?</h2><p>Собранные требования и текущий прогресс будут сброшены.</p><div class="modal-actions">${button('Продолжить игру', 'back', 'secondary')}${button('Начать заново', 'replay')}</div>`);
  }

  overlay.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'start') transition('route1');
    if (action === 'answer') {
      const index = Number(target.dataset.index);
      const correct = index === H.questions[state.question].correct;
      if (correct) { state.question++; toast(`✓ ${H.requirements[state.question - 1].id} · ${H.requirements[state.question - 1].title}`); }
      save();
      renderDialogue({ correct, selected: index });
    }
    if (action === 'next-question') renderDialogue();
    if (action === 'to-office') transition('route2');
    if (action === 'start-testing') { restoreSystem(); transition('testing'); }
    if (action === 'scenario') {
      const scenario = H.scenarios.find(item => item.id === target.dataset.id);
      if (!scenario || state.testDone.includes(scenario.id) || !(scenario.requires || []).every(id => state.testDone.includes(id))) return;
      const result = executeScenario(scenario.id);
      const passed = result.status === scenario.expected;
      if (passed) { state.testDone.push(scenario.id); testResults[scenario.id] = result; }
      save();
      renderTesting(`${passed ? '✓' : '×'} ${result.message}`);
    }
    if (action === 'finish' && state.testDone.length === 5) { transition('complete'); toast('Миссия выполнена. Отличная работа, аналитик!'); }
    if (action === 'notebook') openNotebook();
    if (action === 'back') renderScreen(returnScreen);
    if (action === 'replay') { designer.resetSession(); state = freshState(); system = null; testResults = {}; save(); renderStage(); }
  });

  document.getElementById('notebook-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openNotebook(); });
  document.getElementById('help-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openHelp(); });
  document.getElementById('restart-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openRestart(); });
  document.getElementById('demo-select').addEventListener('change', event => {
    const value = event.target.value;
    if (!value) return;
    designer.resetSession();
    state = freshState(); system = null; testResults = {};
    if (value === 'platform') state.stage = 'route1';
    if (value === 'dialogue') state.stage = 'dialogue';
    if (value === 'puzzle') { state.stage = 'puzzle'; state.question = 4; }
    if (value === 'testing') { state.stage = 'testing'; state.question = 4; state.order = [...H.correctOrder]; state.branches = { schedule: 'off-hours', available: 'occupied', cancel: 'release' }; }
    save(); renderStage(); event.target.value = '';
    toast('Демонстрация механики. Прогресс начат с выбранного этапа.');
  });
  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    if (event.code === 'Escape' && ['notebook', 'help', 'restart'].includes(currentScreen)) renderScreen(returnScreen);
    if (event.code !== 'Tab') return;
    const elements = [...overlay.querySelectorAll('button:not([disabled]), select, summary')];
    if (!elements.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  save();
  renderStage();
})();
