(function () {
  'use strict';
  const H = Hospital;
  const storageKey = 'hospital-bug-mvp-v1';
  const stages = ['intro', 'route1', 'dialogue', 'route2', 'puzzle', 'route3', 'handoff', 'testing', 'complete'];
  const freshState = () => ({ stage: 'intro', question: 0, order: [...H.initialOrder], branches: { schedule: '', available: '', cancel: '' }, testDone: [] });
  let state = freshState();
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && stages.includes(saved.stage)) {
      state = { ...state, ...saved };
      state.question = Math.max(0, Math.min(4, Number.isInteger(saved.question) ? saved.question : 0));
      state.order = Array.isArray(saved.order) && saved.order.length === 5 && new Set(saved.order).size === 5 && saved.order.every(id => Object.hasOwn(H.blocks, id)) ? saved.order : [...H.initialOrder];
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
    currentScreen = screen;
    game.paused = true;
    game.clearInput();
    game.setPrompt('');
    overlay.hidden = false;
    overlay.innerHTML = `<section class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${html}</section>`;
    overlay.querySelector('button:not([disabled]), select')?.focus({ preventScroll: true });
  }

  function resume() {
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
    showModal('dialogue', `<div class="modal-eyebrow">СБОР ТРЕБОВАНИЙ · ВОПРОС ${questionIndex + 1} / 4</div><div class="dialogue-progress">${H.questions.map((_, index) => `<span class="${index < questionIndex ? 'done' : index === questionIndex ? 'active' : ''}"></span>`).join('')}</div>${speaker('Елена Сергеевна', 'Руководитель регистратуры · твой заказчик', 'Е')}<h2 id="modal-title">Понять. Уточнить. Записать.</h2><p class="speech">«${question.speech}»</p><div class="question-label">${question.question}</div><div class="answers">${question.options.map((option, index) => `<button class="answer ${feedback?.selected === index ? feedback.correct ? 'correct' : 'wrong' : ''}" data-action="answer" data-index="${index}" ${feedback?.correct ? 'disabled' : ''}><span>${feedback?.correct && index === question.correct ? '✓' : index + 1}</span>${option}</button>`).join('')}</div>${feedback ? `<div class="feedback ${feedback.correct ? '' : 'error'}">${feedback.correct ? `<strong>${H.requirements[questionIndex].id} добавлено в ТЗ.</strong> ${H.requirements[questionIndex].text}` : question.hint}</div>` : ''}${feedback?.correct ? `<div class="modal-actions">${button(state.question === 4 ? 'Посмотреть ТЗ →' : 'Следующий вопрос →', 'next-question')}</div>` : ''}`);
  }

  function requirementCards() {
    return `<div class="requirements">${H.requirements.map((item, index) => `<div class="requirement${index >= state.question ? ' locked' : ''}"><code>${index < state.question ? item.id : '???'}</code><p>${index < state.question ? item.text : 'Требование ещё не собрано'}</p></div>`).join('')}</div>`;
  }

  function renderRequirementsSummary() {
    showModal('dialogue', `<div class="modal-eyebrow">ДОКУМЕНТ СОБРАН · ТЗ № 001</div><h2 id="modal-title">Теперь проблема стала задачей.</h2><p>Четыре жалобы превратились в четыре правила системы. С ними можно проектировать решение.</p>${requirementCards()}<div class="modal-actions">${button('В кабинет аналитика →', 'to-office')}</div>`);
  }

  function renderPuzzle(feedback = null) {
    const options = (selected, items) => `<option value="">Выбери действие…</option>${items.map(([value, name]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${name}</option>`).join('')}`;
    showModal('puzzle', `<div class="modal-eyebrow">ПРОЕКТИРОВАНИЕ · ТВОЙ РАБОЧИЙ КОМПЬЮТЕР</div><h2 id="modal-title">Собери логику записи.</h2><p>Стрелками расставь действия по порядку. Для отказов и отмены выбери отдельные ветки — пригодятся правила из ТЗ.</p><div class="puzzle-layout"><div><div class="puzzle-subtitle">ОСНОВНОЙ ПУТЬ · ПРОВЕРКИ ПРОЙДЕНЫ ↓</div><div class="algorithm-list">${state.order.map((id, index) => `<div class="algorithm-block"><span class="block-number">${index + 1}</span><span class="block-name">${H.blocks[id].name}<span class="block-tag">${H.blocks[id].tag}</span></span><div class="block-arrows"><button data-action="move" data-index="${index}" data-direction="-1" aria-label="Переместить ${H.blocks[id].name} выше" ${index === 0 ? 'disabled' : ''}>↑</button><button data-action="move" data-index="${index}" data-direction="1" aria-label="Переместить ${H.blocks[id].name} ниже" ${index === state.order.length - 1 ? 'disabled' : ''}>↓</button></div></div>`).join('')}</div></div><div><div class="puzzle-subtitle">АЛЬТЕРНАТИВНЫЕ ВЕТКИ · А ЕСЛИ НЕТ?</div><div class="branch-box"><div class="branch-row"><label for="branch-schedule">FR-02 · Врач работает? → Нет</label><select id="branch-schedule" data-branch="schedule">${options(state.branches.schedule, [['book', 'Всё равно создать запись'], ['off-hours', 'Отказать: врач не работает'], ['occupied', 'Сообщить: слот занят']])}</select></div><div class="branch-row"><label for="branch-available">FR-01 · Слот свободен? → Нет</label><select id="branch-available" data-branch="available">${options(state.branches.available, [['occupied', 'Отказать: время занято'], ['book', 'Создать ещё одну запись'], ['off-hours', 'Сообщить: врач не работает']])}</select></div><div class="branch-row"><label for="branch-cancel">FR-03 · Пациент отменяет запись</label><select id="branch-cancel" data-branch="cancel">${options(state.branches.cancel, [['keep', 'Оставить слот занятым'], ['release', 'Отменить и освободить слот'], ['all', 'Удалить все записи врача']])}</select></div></div><p class="small-help">При отказе основной путь останавливается. Сообщение об ошибке — отдельная ветка.</p></div></div>${feedback ? `<div class="feedback${feedback.ok ? '' : ' error'}">${feedback.message}</div>` : ''}<div class="modal-actions">${feedback?.ok ? button('Передать решение Максу →', 'to-developer', 'dark') : button('Проверить алгоритм', 'check-algorithm')}</div>`, true);
  }

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
    if (action === 'move') {
      const index = Number(target.dataset.index);
      const destination = index + Number(target.dataset.direction);
      if (destination < 0 || destination >= state.order.length) return;
      [state.order[index], state.order[destination]] = [state.order[destination], state.order[index]];
      save();
      renderPuzzle();
      overlay.querySelectorAll('.algorithm-block')[destination].querySelector(`button[data-direction="${target.dataset.direction}"]:not([disabled])`)?.focus({ preventScroll: true });
    }
    if (action === 'check-algorithm') renderPuzzle(H.validateAlgorithm(state.order, state.branches));
    if (action === 'to-developer' && H.validateAlgorithm(state.order, state.branches).ok) transition('route3');
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
    if (action === 'replay') { state = freshState(); system = null; testResults = {}; save(); renderStage(); }
  });

  overlay.addEventListener('change', event => {
    const branch = event.target.dataset.branch;
    if (branch) {
      state.branches[branch] = event.target.value;
      save();
      const feedback = overlay.querySelector('.feedback');
      if (feedback) { feedback.remove(); overlay.querySelector('.modal-actions').innerHTML = button('Проверить алгоритм', 'check-algorithm'); }
    }
  });
  document.getElementById('notebook-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openNotebook(); });
  document.getElementById('help-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openHelp(); });
  document.getElementById('restart-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openRestart(); });
  document.getElementById('demo-select').addEventListener('change', event => {
    const value = event.target.value;
    if (!value) return;
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
    const elements = [...overlay.querySelectorAll('button:not([disabled]), select')];
    if (!elements.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  save();
  renderStage();
})();
