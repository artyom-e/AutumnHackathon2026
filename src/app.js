(function () {
  'use strict';
  const H = Hospital;
  const storageKey = 'hospital-bug-mvp-v1';
  const stages = ['intro', 'briefing', 'route1', 'dialogue', 'route2', 'puzzle', 'route3', 'handoff', 'testing', 'complete'];
  const freshState = (difficulty = 'easy') => ({ stage: 'intro', difficulty: H.normalizeDifficulty(difficulty), question: 0, order: [...H.initialOrder], branches: { schedule: '', available: '', cancel: '' }, flowSlots: Array(5).fill(null), testDone: [], clientMet: false, storyProgress: { briefing: 0, client: 0, handoff: 0 }, startedAt: 0, completedAt: 0, playerName: '', demo: false });
  let state = freshState();
  let storageAvailable = true;
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved && stages.includes(saved.stage)) {
      state = { ...state, ...saved };
      state.difficulty = H.normalizeDifficulty(saved.difficulty);
      state.question = Math.max(0, Math.min(4, Number.isInteger(saved.question) ? saved.question : 0));
      state.order = Array.isArray(saved.order) && saved.order.length === 5 && new Set(saved.order).size === 5 && saved.order.every(id => Object.hasOwn(H.blocks, id)) ? saved.order : [...H.initialOrder];
      if (!Array.isArray(saved.flowSlots) || saved.flowSlots.length !== 5) state.flowSlots = saved.stage === 'puzzle' ? [...state.order] : Array(5).fill(null);
      state.branches = { ...freshState().branches, ...(saved.branches && typeof saved.branches === 'object' ? saved.branches : {}) };
      state.testDone = Array.isArray(saved.testDone) ? H.scenarios.filter(item => saved.testDone.includes(item.id)).map(item => item.id) : [];
      state.storyProgress = Object.fromEntries(Object.entries(H.dialogues).map(([key, lines]) => [key, Math.max(0, Math.min(lines.length - 1, Number.isInteger(saved.storyProgress?.[key]) ? saved.storyProgress[key] : 0))]));
      state.clientMet = saved.clientMet === true || state.question > 0;
      state.playerName = typeof saved.playerName === 'string' ? saved.playerName.slice(0, 24) : '';
      for (const key of ['startedAt', 'completedAt']) state[key] = Number.isFinite(saved[key]) && saved[key] > 0 && saved[key] <= Date.now() ? saved[key] : 0;
      state.demo = saved.demo === true;
    }
  } catch { storageAvailable = false; }
  let selectedDifficulty = state.difficulty;

  const overlay = document.getElementById('overlay');
  let currentScreen = '';
  let returnScreen = '';
  let toastTimeout;
  let system;
  let testResults = {};
  let typingTimer = null;
  let activeConversation = null;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const button = (text, action, type = '', extra = '') => `<button class="button ${type}" data-action="${action}" ${extra}>${text}</button>`;
  const people = {
    programmer: { name: 'Макс', role: 'Программист больницы', shirt: '#709198' },
    client: { name: 'Елена Сергеевна', role: 'Руководитель регистратуры', shirt: '#e7e9d2' },
    hero: { name: 'Ты', role: 'Системный аналитик', shirt: '#df9867' },
  };
  const portraits = new Map();
  function portrait(who) {
    if (!portraits.has(who)) {
      const canvas = document.createElement('canvas');
      canvas.width = 36; canvas.height = 37;
      const ctx = canvas.getContext('2d');
      const brush = { rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); } };
      H.Game.prototype.person.call(brush, 3, 1, people[who].shirt, who === 'hero' ? 1 : -1, 0, who === 'hero', false, who === 'client' ? 'client' : '', false, 1);
      portraits.set(who, canvas.toDataURL());
    }
    return `<img class="pixel-portrait" src="${portraits.get(who)}" alt="" width="72" height="74">`;
  }
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
    stopTyping();
    activeConversation = null;
    document.body.classList.remove('designer-open', 'screen-open');
    overlay.classList.remove('design-overlay', 'dragging-block', 'screen-overlay');
    if (screen === 'puzzle') document.getElementById('canvas-wrap').appendChild(overlay);
    else { document.body.appendChild(overlay); overlay.classList.add('screen-overlay'); document.body.classList.add('screen-open'); }
    currentScreen = screen;
    game.paused = true;
    game.clearInput();
    game.setPrompt('');
    overlay.hidden = false;
    const chrome = screen === 'puzzle' ? '' : '<header class="window-chrome"><span class="window-cross" aria-hidden="true">✚</span><span>БОЛЬНИЦА №8 <b>/ РАБОЧАЯ СМЕНА АНАЛИТИКА</b></span><span class="window-pixels" aria-hidden="true"><i></i><i></i><i></i></span></header>';
    overlay.innerHTML = `<section class="modal${wide ? ' wide' : ''}${screen === 'puzzle' ? '' : ' game-window'}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${chrome}${screen === 'puzzle' ? html : `<div class="window-content">${html}</div>`}</section>`;
    overlay.querySelector('button:not([disabled]), input, select, summary')?.focus({ preventScroll: true });
  }

  function resume() {
    stopTyping(); activeConversation = null;
    document.body.classList.remove('designer-open', 'screen-open');
    if (overlay.parentElement !== document.getElementById('canvas-wrap')) document.getElementById('canvas-wrap').appendChild(overlay);
    currentScreen = '';
    overlay.classList.remove('screen-overlay');
    overlay.hidden = true;
    overlay.innerHTML = '';
    game.paused = false;
    game.clearInput();
    document.getElementById('game').focus({ preventScroll: true });
  }

  function updateMission() {
    const phase = ({ intro: 0, briefing: 0, route1: 0, dialogue: 1, route2: 2, puzzle: 2, route3: 3, handoff: 3, testing: 3, complete: 4 })[state.stage];
    document.getElementById('quest-list').innerHTML = H.quests.map((quest, index) => `<li class="quest-item ${index < phase ? 'done' : index === phase ? 'active' : ''}"><span class="quest-number">${index < phase ? '✓' : `0${index + 1}`}</span><div><strong>${quest.title}</strong><small>${quest.text}</small></div></li>`).join('');
    const progress = ({ intro: 0, briefing: 0, route1: 5, dialogue: 15 + state.question * 8, route2: 50, puzzle: 55, route3: 75, handoff: 80, testing: 80 + state.testDone.length * 3, complete: 100 })[state.stage];
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
    ({ intro: renderIntro, briefing: () => renderConversation('briefing'), 'client-intro': () => renderConversation('client'), dialogue: renderDialogue, puzzle: renderPuzzle, handoff: renderHandoff, testing: renderTesting, complete: renderComplete })[screen]?.();
  }

  function renderIntro() {
    const saved = state.stage !== 'intro';
    showModal('intro', `<div class="shift-hero"><div><div class="modal-eyebrow">МИССИЯ 001 · СБОЙ РАСПИСАНИЯ</div><h2 id="modal-title">Баг в больнице</h2><p class="screen-lead">Игра о профессии системного аналитика</p></div>${portrait('hero')}<svg class="shift-ecg" viewBox="0 0 600 45" aria-hidden="true"><path d="M0 24H180l12-17 15 32 15-24 12 9h366"/></svg></div>
      <p class="screen-intro">К одному врачу на одно время записались сразу трое. В коридорах очереди, главврач требует всё исправить. Ты — аналитик: выясни, что нужно заказчику, и объясни это программисту.</p>
      <div class="shift-features"><div><span>01</span><strong>Поговори</strong><p>Собери требования у заказчика</p></div><div><span>02</span><strong>Спроектируй</strong><p>Построй схему записи и отмены</p></div><div><span>03</span><strong>Проверь</strong><p>Пройди три маршрута и пять сценариев</p></div></div>
      <fieldset class="difficulty-picker"><legend>Сложность${saved ? ' новой смены' : ''}</legend><p class="difficulty-help">Меняются только вопросы заказчика и подсказки в схеме. Маршруты и управление одинаковые.</p><div class="difficulty-options">${Object.entries(H.difficulties).map(([id, level], index) => `<button type="button" class="difficulty-option" data-action="difficulty" data-difficulty="${id}" aria-pressed="${selectedDifficulty === id}"><span class="difficulty-option-title"><span class="difficulty-bars" aria-hidden="true">${Array.from({ length: 3 }, (_, bar) => `<i class="${bar <= index ? 'lit' : ''}"></i>`).join('')}</span><strong>${level.name}</strong><span class="difficulty-check" aria-hidden="true">✓</span></span><span class="difficulty-detail"><b>Заказчик</b>${level.client}</span><span class="difficulty-detail"><b>Схема</b>${level.designer}</span></button>`).join('')}</div></fieldset>
      <div class="intro-controls"><span><kbd>A</kbd><kbd>D</kbd> идти</span><span><kbd>Пробел</kbd> прыгать</span><span><kbd>E</kbd> взаимодействовать</span></div>
      ${saved ? `<p class="save-note">Сохранённая смена: «${H.difficulties[state.difficulty].name}». «Продолжить» сохранит её сложность и прогресс; выбор выше применяется к новой смене.</p>` : ''}<div class="modal-actions">${button('Управление', 'help', 'secondary')}${saved ? button('Новая смена', 'start', 'secondary') + button('Продолжить →', 'continue', 'dark') : button('Начать смену →', 'start', 'dark')}</div><p class="small-help">Без ограничения попыток · прогресс сохраняется в этом браузере</p>`, true);
  }

  function stopTyping() { clearInterval(typingTimer); typingTimer = null; }

  function renderConversation(kind) {
    const lines = H.dialogues[kind];
    const index = state.storyProgress[kind];
    const line = lines[index];
    const titles = { briefing: 'Новая миссия: «Сбой расписания»', client: 'Знакомство с заказчиком', handoff: 'Возвращение к программисту' };
    const lastLabels = { briefing: 'К заказчику →', client: 'Собрать требования →', handoff: 'Запустить проверку →' };
    showModal(kind === 'client' ? 'client-intro' : kind, `<div class="modal-eyebrow">${kind === 'briefing' ? 'НАЧАЛО СМЕНЫ' : kind === 'client' ? 'РЕГИСТРАТУРА' : 'IT-ОТДЕЛ'} · РЕПЛИКА ${index + 1} / ${lines.length}</div><h2 id="modal-title">${titles[kind]}</h2>
      <div class="story-dialogue ${line.who === 'hero' ? 'is-me' : ''}"><div class="story-portrait">${portrait(line.who)}<strong>${people[line.who].name}</strong><small>${people[line.who].role}</small></div><div class="speech-bubble"><p id="story-text"></p></div></div>
      <div class="modal-actions"><span class="story-key">Enter — далее · нажми, чтобы раскрыть реплику</span>${button(index === lines.length - 1 ? lastLabels[kind] : 'Далее →', 'story-next', 'dark')}</div>`, true);
    const text = `«${line.text}»`;
    const element = document.getElementById('story-text');
    activeConversation = { kind, text, element };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) element.textContent = text;
    else {
      let count = 0;
      typingTimer = setInterval(() => { element.textContent = text.slice(0, ++count); if (count >= text.length) stopTyping(); }, 14);
    }
  }

  function advanceConversation() {
    if (!activeConversation) return;
    if (typingTimer) { stopTyping(); activeConversation.element.textContent = activeConversation.text; return; }
    const { kind } = activeConversation;
    if (state.storyProgress[kind] < H.dialogues[kind].length - 1) { state.storyProgress[kind]++; save(); renderConversation(kind); return; }
    if (kind === 'briefing') transition('route1');
    if (kind === 'client') { state.clientMet = true; save(); renderDialogue(); }
    if (kind === 'handoff') { restoreSystem(); transition('testing'); }
  }

  function renderDialogue(feedback = null) {
    if (!state.clientMet && state.question === 0 && !feedback) return renderConversation('client');
    if (state.question >= 4 && !feedback) return renderRequirementsSummary();
    const questionIndex = feedback?.correct ? state.question - 1 : state.question;
    const questions = H.getQuestions(state.difficulty);
    const question = questions[questionIndex];
    const explanation = feedback ? question.explanations[feedback.selected] : '';
    const feedbackHtml = !feedback ? '' : `
      <div class="feedback client-feedback ${feedback.correct ? '' : 'error'}" role="status">
        <strong>${feedback.correct ? 'Верно!' : 'Пока не совсем.'}</strong>
        <p>${explanation}</p>
        ${feedback.correct ? `<div class="accepted-requirement"><strong>Получена карточка ${H.requirements[questionIndex].id}</strong><span>${H.requirements[questionIndex].title}</span></div>` : '<span class="retry-label">Попробуй другой вариант. За ошибки нет штрафа.</span>'}
      </div>`;
    showModal('dialogue', `<div class="client-dialogue">
      <div class="modal-eyebrow">ВСТРЕЧА С ЗАКАЗЧИКОМ · ЗАДАЧА ${questionIndex + 1} / 4 <span class="difficulty-badge">${H.difficulties[state.difficulty].name}</span></div>
      <div class="dialogue-progress">${questions.map((_, index) => `<span class="${index < questionIndex ? 'done' : index === questionIndex ? 'active' : ''}"></span>`).join('')}</div>
      <h2 id="modal-title">Сбор требований: ${question.goal.toLowerCase()}</h2>
      <div class="story-dialogue client-request"><div class="story-portrait">${portrait('client')}<strong>Заказчик</strong><small>Елена Сергеевна</small></div><div class="speech-bubble"><p>«${question.speech}»</p></div></div>
      <div class="question-label">${question.question}</div>
      <div class="answers">${question.options.map((option, index) => `<button class="answer ${feedback?.selected === index ? feedback.correct ? 'correct' : 'wrong' : ''}" data-action="answer" data-index="${index}" ${feedback?.correct ? 'disabled' : ''}><span>${feedback?.correct && index === question.correct ? '✓' : 'ABC'[index]}</span>${escapeHtml(option)}</button>`).join('')}</div>
      ${feedbackHtml}
      <div class="requirement-chips" aria-label="Собранные требования">${H.requirements.slice(0, state.question).map(item => `<span>▤ ${item.id}</span>`).join('')}</div>
      ${feedback?.correct ? `<div class="modal-actions">${button(state.question === 4 ? 'Посмотреть ТЗ →' : 'Дальше →', 'next-question')}</div>` : ''}
    </div>`, true);
    // Keep the explanation visible when the dialog needs scrolling on a small screen.
    if (feedback) overlay.querySelector('.client-feedback')?.scrollIntoView({ block: 'nearest' });
  }

  function requirementCards() {
    return `<article class="tz-paper"><div class="paper-stamp ${state.question < 4 ? 'is-draft' : ''}">${state.question === 4 ? 'УТВЕРЖДЕНО' : 'В РАБОТЕ'}</div><header><span>ТЕХНИЧЕСКОЕ ЗАДАНИЕ №001</span><h3>Система записи пациентов</h3><p>Заказчик: регистратура больницы №8</p></header><h4>Функциональные требования</h4><div class="requirements">${H.requirements.map((item, index) => `<div class="requirement${index >= state.question ? ' locked' : ''}"><code>${item.id}</code><p>${index < state.question ? escapeHtml(item.text) : 'Появится после разговора с заказчиком.'}</p></div>`).join('')}</div><footer>Собрано: ${state.question}/4 · слот — время приёма у конкретного врача</footer></article>`;
  }

  function renderRequirementsSummary() {
    showModal('dialogue', `<div class="modal-eyebrow">РЕГИСТРАТУРА · ТРЕБОВАНИЯ СОБРАНЫ</div><h2 id="modal-title">У тебя есть техническое задание!</h2>${requirementCards()}<p class="analyst-note">Функциональные требования — это список того, что система должна уметь делать. Теперь на их основе можно построить схему для программиста.</p><div class="modal-actions">${button('Идти в кабинет аналитика →', 'to-office', 'dark')}</div>`, true);
  }

  function renderPuzzle() { designer.render(); }

  function renderHandoff() {
    renderConversation('handoff');
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
    showModal('testing', `<div class="modal-eyebrow">ПРОВЕРКА СИСТЕМЫ · ${state.testDone.length} / ${H.scenarios.length}</div><h2 id="modal-title">Проверим не только успешную запись.</h2><p>Анна и Иван хотят одно время, Мария — приём после работы врача. Затем отменим запись и попробуем занять освободившееся время.</p><div class="test-progress"><span style="width:${state.testDone.length / H.scenarios.length * 100}%"></span></div><div class="acceptance-table-wrap"><table class="acceptance-table"><thead><tr><th>Ситуация</th><th>Путь по схеме</th><th>Результат проверки</th></tr></thead><tbody>${H.scenarios.map(scenario => {
      const passed = state.testDone.includes(scenario.id);
      const ready = (scenario.requires || []).every(id => state.testDone.includes(id));
      const statusNames = { booked: 'Запись создана', occupied: 'Конфликт отклонён', 'off-hours': 'Отказ по расписанию', cancelled: 'Слот освобождён' };
      return `<tr class="${passed ? 'test-passed' : ''}"><td><strong>${scenario.name}</strong><small>${scenario.description}</small></td><td>${H.scenarioPaths[scenario.id]}</td><td><button class="scenario-button${passed ? ' passed' : ''}" data-action="scenario" data-id="${scenario.id}" ${passed || !ready ? 'disabled' : ''}>${passed ? `✓ ${statusNames[testResults[scenario.id]?.status]}` : ready ? 'Проверить →' : 'После предыдущих'}</button></td></tr>`;
    }).join('')}</tbody></table></div><p class="analyst-note">Отказ при занятом времени — правильный результат. Аналитик проверяет и успешную запись, и понятные отказы.</p><div class="terminal" role="status">${escapeHtml(message || (done ? 'Все пять сценариев пройдены. Ошибка больше не воспроизводится.' : '› Ожидание проверки. Врач работает с 09:00 до 18:00.'))}</div><div class="modal-actions">${done ? button('Завершить миссию →', 'finish', 'dark') : button('Запустить все проверки', 'run-tests', 'dark')}</div>`, true);
  }

  function renderComplete() {
    const seconds = state.startedAt && state.completedAt >= state.startedAt ? Math.floor((state.completedAt - state.startedAt) / 1000) : null;
    showModal('complete', `<div class="modal-eyebrow">МИССИЯ 001 · ВЫПОЛНЕНО${state.demo ? ' · БЫСТРЫЙ ПОКАЗ' : ''}</div><h2 id="modal-title">Миссия выполнена!</h2><div class="story-dialogue victory-thanks"><div class="story-portrait">${portrait('programmer')}<strong>Макс</strong><small>Программист</small></div><div class="speech-bubble"><p>«Спасибо! Без правильно собранных требований я мог бы исправить не ту проблему».</p></div></div>
      <p>Больница снова работает, а пациенты записываются без конфликтов. Ты попробовал себя в роли системного аналитика.</p>
      <section class="analyst-certificate"><div class="certificate-seal" aria-hidden="true">✚</div><h3>Сертификат первой смены</h3><label for="certificate-name">Подтверждает, что</label><input id="certificate-name" class="certificate-name" maxlength="24" autocomplete="given-name" placeholder="Введи своё имя" value="${escapeHtml(state.playerName)}"><p><strong id="certificate-holder">${escapeHtml(state.playerName.trim() || 'Игрок')}</strong> собрал требования, построил алгоритм и помог команде исправить систему записи пациентов.</p><div class="certificate-stats">4 требования · схема записи и отмены · 5/5 проверок${seconds === null ? '' : ` · ${Math.floor(seconds / 60)} мин ${seconds % 60} с`}</div></section>
      <h3 class="skills-title">Что делает аналитик — и что сделал ты</h3><div class="skills-table">${H.analystSkills.map(([skill, result]) => `<div><strong>${skill}</strong><span>${result}</span></div>`).join('')}</div><p class="analyst-note">Сегодня ты превращал пожелания заказчика в понятные требования и схему — и проверял результат вместе с разработчиком.</p><div class="modal-actions">${button('Посмотреть ТЗ', 'notebook', 'secondary')}${button('Пройти ещё раз ↻', 'replay', 'dark')}</div>`, true);
  }

  function openNotebook() {
    returnScreen = currentScreen;
    showModal('notebook', `<div class="modal-eyebrow">ДОКУМЕНТЫ АНАЛИТИКА</div><h2 id="modal-title">Твоё техническое задание</h2><p>${state.question < 4 ? 'Новые карточки появятся после разговора с заказчиком.' : 'Используй эти правила при проектировании и проверке системы.'}</p>${requirementCards()}<div class="modal-actions">${button('Вернуться к работе →', 'back', 'dark')}</div>`, true);
  }

  function openHelp() {
    returnScreen = currentScreen;
    showModal('help', `<div class="modal-eyebrow">ПАМЯТКА НОВОГО СОТРУДНИКА</div><h2 id="modal-title">Твой первый день аналитиком</h2><div class="help-controls"><div><kbd>A / D</kbd><span>Идти · или стрелки ← / →</span></div><div><kbd>Пробел</kbd><span>Прыгать · или W / ↑</span></div><div><kbd>W / S</kbd><span>Лезть по лестнице вверх / вниз · или ↑ / ↓</span></div><div><kbd>E</kbd><span>Нажать кнопку, поговорить, открыть компьютер</span></div></div><p>Перепрыгивай лужи и провалы. Лифт поднимает и спускает обратно. Во втором коридоре проход откроют две кнопки. За ошибки нет штрафа — пробуй снова.</p><div class="shift-features"><div><strong>Заказчик</strong><p>Выбирай правило, по которому должна работать программа.</p></div><div><strong>Схема</strong><p>Перетаскивай блоки. Или выбери блок, затем нажми на место в схеме.</p></div><div><strong>Проверка</strong><p>Вернись к Максу и проверь пять ситуаций с пациентами.</p></div></div><p class="small-help">На телефоне доступны экранные кнопки. В разговоре Enter продолжает реплику. «Быстрый показ» под игрой открывает отдельную механику.</p><div class="modal-actions">${button('Понятно, играем →', 'back', 'dark')}</div>`, true);
  }

  function openRestart() {
    returnScreen = currentScreen;
    showModal('restart', `<div class="modal-eyebrow">НОВОЕ ПРОХОЖДЕНИЕ</div><h2 id="modal-title">Начать смену заново?</h2><p>Собранные требования и текущий прогресс будут сброшены.</p><div class="modal-actions">${button('Продолжить игру', 'back', 'secondary')}${button('Начать заново', 'replay')}</div>`);
  }

  overlay.addEventListener('click', event => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    const action = target.dataset.action;
    if (action === 'difficulty' && currentScreen === 'intro') {
      selectedDifficulty = H.normalizeDifficulty(target.dataset.difficulty);
      if (state.stage === 'intro') { state.difficulty = selectedDifficulty; save(); }
      overlay.querySelectorAll('[data-action="difficulty"]').forEach(option => option.setAttribute('aria-pressed', option.dataset.difficulty === selectedDifficulty));
    }
    if (action === 'start') { designer.resetSession(); state = freshState(selectedDifficulty); state.startedAt = Date.now(); system = null; testResults = {}; transition('briefing'); }
    if (action === 'continue') renderStage();
    if (action === 'story-next') advanceConversation();
    if (action === 'answer') {
      const question = H.getQuestions(state.difficulty)[state.question];
      if (state.stage !== 'dialogue' || currentScreen !== 'dialogue' || !question) return;
      const index = Number(target.dataset.index);
      if (!Number.isInteger(index) || index < 0 || index > 2) return;
      const correct = index === question.correct;
      if (correct) { state.question++; toast(`✓ ${H.requirements[state.question - 1].id} · ${H.requirements[state.question - 1].title}`); }
      save();
      renderDialogue({ correct, selected: index });
    }
    if (action === 'next-question') renderDialogue();
    if (action === 'to-office') transition('route2');
    if (action === 'run-tests' && state.stage === 'testing') {
      if (!system) restoreSystem();
      const messages = [];
      for (const scenario of H.scenarios) {
        if (state.testDone.includes(scenario.id) || !(scenario.requires || []).every(id => state.testDone.includes(id))) continue;
        const result = executeScenario(scenario.id);
        const passed = result.status === scenario.expected;
        if (passed) { state.testDone.push(scenario.id); testResults[scenario.id] = result; }
        messages.push(`${passed ? '✓' : '×'} ${result.message}`);
      }
      save(); renderTesting(messages.join('\n'));
    }
    if (action === 'scenario') {
      const scenario = H.scenarios.find(item => item.id === target.dataset.id);
      if (!scenario || state.testDone.includes(scenario.id) || !(scenario.requires || []).every(id => state.testDone.includes(id))) return;
      const result = executeScenario(scenario.id);
      const passed = result.status === scenario.expected;
      if (passed) { state.testDone.push(scenario.id); testResults[scenario.id] = result; }
      save();
      renderTesting(`${passed ? '✓' : '×'} ${result.message}`);
    }
    if (action === 'finish' && state.testDone.length === H.scenarios.length) { state.completedAt = Date.now(); transition('complete'); toast('Миссия выполнена. Отличная работа, аналитик!'); }
    if (action === 'notebook') openNotebook();
    if (action === 'help') openHelp();
    if (action === 'back') renderScreen(returnScreen);
    if (action === 'replay') { designer.resetSession(); state = freshState(state.difficulty); selectedDifficulty = state.difficulty; system = null; testResults = {}; save(); renderStage(); }
  });
  overlay.addEventListener('input', event => {
    if (event.target.id !== 'certificate-name') return;
    state.playerName = event.target.value.slice(0, 24);
    document.getElementById('certificate-holder').textContent = state.playerName.trim() || 'Игрок';
    save();
  });

  document.getElementById('notebook-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openNotebook(); });
  document.getElementById('help-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openHelp(); });
  document.getElementById('restart-button').addEventListener('click', () => { if (!['notebook', 'help', 'restart'].includes(currentScreen)) openRestart(); });
  document.getElementById('demo-select').addEventListener('change', event => {
    const value = event.target.value;
    if (!value) return;
    designer.resetSession();
    state = freshState(currentScreen === 'intro' ? selectedDifficulty : state.difficulty); selectedDifficulty = state.difficulty; state.demo = true; state.startedAt = Date.now(); system = null; testResults = {};
    if (value === 'platform') state.stage = 'route1';
    if (value === 'dialogue') state.stage = 'dialogue';
    if (value === 'puzzle') { state.stage = 'puzzle'; state.question = 4; }
    if (value === 'testing') { state.stage = 'testing'; state.question = 4; state.order = [...H.correctOrder]; state.branches = { schedule: 'off-hours', available: 'occupied', cancel: 'release' }; }
    save(); renderStage(); event.target.value = '';
    toast('Демонстрация механики. Прогресс начат с выбранного этапа.');
  });
  document.addEventListener('keydown', event => {
    if (overlay.hidden) return;
    if (event.code === 'Enter' && activeConversation && !event.repeat && !/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) { event.preventDefault(); advanceConversation(); return; }
    if (event.code === 'Escape' && ['notebook', 'help', 'restart'].includes(currentScreen)) renderScreen(returnScreen);
    if (event.code !== 'Tab') return;
    const elements = [...overlay.querySelectorAll('button:not([disabled]), input, select, summary')];
    if (!elements.length) return;
    const first = elements[0], last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  save();
  setRoute(['route2', 'puzzle'].includes(state.stage) ? 1 : ['route3', 'handoff', 'testing', 'complete'].includes(state.stage) ? 2 : 0);
  renderIntro();
})();
