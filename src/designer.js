window.Hospital = window.Hospital || {};

(function (H) {
  'use strict';

  const cards = {
    input: { label: 'Получить данные пациента', kind: 'data', icon: 'file' },
    schedule: { label: 'Проверить расписание врача', kind: 'check', icon: 'calendar' },
    available: { label: 'Проверить свободное время', kind: 'condition', icon: 'clock' },
    book: { label: 'Создать запись', kind: 'data', icon: 'plus' },
    notify: { label: 'Отправить подтверждение', kind: 'data', icon: 'send' },
    'off-hours': { label: 'Сообщить: врач не работает', kind: 'error', icon: 'alert' },
    occupied: { label: 'Сообщить: время занято', kind: 'error', icon: 'alert' },
    release: { label: 'Освободить время', kind: 'check', icon: 'undo' },
  };
  const paths = {
    file: '<path d="M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18 M7 3v4 M17 3v4 M7 14h2 M13 14h2 M7 18h2 M13 18h2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    plus: '<path d="M12 4v16 M4 12h16"/>',
    send: '<path d="m3 10 18-7-7 18-3-8-8-3z M11 13 21 3"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 6v7 M12 17h.01"/>',
    undo: '<path d="m8 3-5 5 5 5 M3 8h10a7 7 0 1 1-6 11"/>',
    play: '<path d="m7 4 14 8-14 8z"/>',
    stop: '<rect x="5" y="5" width="14" height="14" rx="1"/>',
    cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
  const known = id => Object.hasOwn(cards, id);
  const emptySlots = () => Array(5).fill(null);

  H.validateDiagram = function (slots, branches) {
    const missing = slots.findIndex(id => !id);
    if (missing !== -1) return { ok: false, node: `slot-${missing}`, message: 'Здесь пока пусто. Перенеси сюда подходящий блок слева.' };
    const invalid = slots.findIndex(id => !Object.hasOwn(H.blocks, id));
    if (invalid !== -1) return { ok: false, node: `slot-${invalid}`, message: 'Этот блок нужен на другой ветке. На основном пути собери действия от получения данных до подтверждения.' };
    const duplicate = slots.findIndex((id, i) => slots.indexOf(id) !== i);
    if (duplicate !== -1) return { ok: false, node: `slot-${duplicate}`, message: 'Это действие уже есть в схеме. На основном пути нужны пять разных блоков.' };
    const result = H.validateAlgorithm(slots, branches);
    if (result.ok) return result;
    const node = result.index !== undefined ? `slot-${result.index}` : branches.schedule !== 'off-hours' ? 'branch-schedule' : branches.available !== 'occupied' ? 'branch-available' : 'branch-cancel';
    return { ...result, node };
  };

  H.Designer = class {
    constructor({ overlay, getState, save, showModal, onFinish, onNotebook }) {
      Object.assign(this, { overlay, getState, save, showModal, onFinish, onNotebook });
      this.selected = null;
      this.history = [];
      this.validated = false;
      this.feedback = '';
      this.errorNode = '';
      this.bind();
    }

    state() {
      const state = this.getState();
      if (!Array.isArray(state.flowSlots) || state.flowSlots.length !== 5) {
        state.flowSlots = [...(state.order || emptySlots())];
      }
      state.flowSlots = state.flowSlots.map(id => known(id) ? id : null);
      return state;
    }

    snapshot() {
      const state = this.state();
      return { slots: [...state.flowSlots], branches: { ...state.branches } };
    }

    remember() {
      this.history.push(this.snapshot());
      if (this.history.length > 25) this.history.shift();
    }

    changed() {
      this.validated = false;
      this.feedback = '';
      this.errorNode = '';
      this.state().order = [...this.state().flowSlots];
      this.save();
      this.render();
    }

    resetSession() {
      this.selected = null;
      this.history = [];
      this.validated = false;
      this.feedback = '';
      this.errorNode = '';
      this.scrollPositions = null;
    }

    getSlot(key) {
      const state = this.state();
      return /^\d$/.test(key) ? state.flowSlots[Number(key)] : state.branches[key];
    }

    setSlot(key, id) {
      const state = this.state();
      if (/^\d$/.test(key)) state.flowSlots[Number(key)] = id;
      else if (['schedule', 'available', 'cancel'].includes(key)) state.branches[key] = id || '';
    }

    place(key, id, source = null) {
      if (!known(id) || !['0', '1', '2', '3', '4', 'schedule', 'available', 'cancel'].includes(key) || key === source) return;
      this.remember();
      const old = this.getSlot(key);
      this.setSlot(key, id);
      if (source !== null) this.setSlot(source, old || null);
      this.selected = null;
      this.changed();
      this.overlay.querySelector(`[data-slot="${key}"] .node-target`)?.focus({ preventScroll: true });
    }

    node(key, nodeId, style, placeholder, shape = '') {
      const id = this.getSlot(key);
      const card = cards[id];
      const title = card ? card.label : placeholder;
      return `<div class="flow-node ${shape} ${card ? `filled kind-${card.kind}` : 'empty'} ${this.errorNode === nodeId ? 'node-error' : ''}" style="${style}" data-slot="${key}" data-node="${nodeId}" ${card ? `draggable="true" data-card="${id}" data-source="${key}"` : ''}>
        <button class="node-target" data-design="place" data-destination="${key}" aria-label="${card ? `${title}. Заменить блок` : `Поставить блок: ${placeholder}`}"><span class="node-icon">${icon(card?.icon || (shape ? 'clock' : 'plus'))}</span><span>${title}</span></button>
        ${card ? `<button class="node-remove" data-design="remove" data-destination="${key}" aria-label="Убрать: ${title}">×</button>` : ''}
      </div>`;
    }

    render() {
      const state = this.state();
      if (state.stage !== 'puzzle') return;
      const scrollSelectors = ['.design-body', '.flow-scroll', '.palette-items', '.design-palette'];
      if (this.overlay.classList.contains('design-overlay')) this.scrollPositions = scrollSelectors.map(selector => {
        const element = this.overlay.querySelector(selector);
        return { selector, top: element?.scrollTop || 0, left: element?.scrollLeft || 0 };
      });
      const complete = this.validated;
      const filled = state.flowSlots.filter(Boolean).length + ['schedule', 'available', 'cancel'].filter(key => known(state.branches[key])).length;
      const palette = Object.entries(cards).map(([id, card]) => `<button class="palette-card kind-${card.kind}${this.selected === id ? ' selected' : ''}" data-design="select" data-card="${id}" draggable="true" aria-pressed="${this.selected === id}"><span>${icon(card.icon)}</span>${card.label}</button>`).join('');
      const wire = (from, to, d, kind = 'yes') => `<path class="flow-wire wire-${kind}" data-from="${from}" data-to="${to}" d="${d}" marker-end="url(#arrow-${kind})"/>`;
      this.showModal('puzzle', `
        <header class="design-header"><div class="design-brand">${icon('cross')}<div><strong>БОЛЬНИЦА №8</strong><span>СИСТЕМА ЗАПИСИ ПАЦИЕНТОВ</span></div></div><div class="design-tabs"><span class="active">${icon('file')} Проектирование</span></div><span class="design-user">Привет, Аналитик! <b>А</b></span></header>
        <div class="design-body">
          <aside class="design-palette"><h3>${icon('file')} Блоки действий</h3><div class="palette-items">${palette}</div><p class="palette-help">Перетащи блок на схему.<br>Или выбери его и нажми на нужное место.</p></aside>
          <section class="design-center" aria-label="Поле схемы"><div class="design-document"><strong id="modal-title">Схема записи пациента</strong><span>ТЗ №001 · ${filled}/8 блоков</span></div><div class="design-instruction"><span>${this.selected ? `Выбран блок «${cards[this.selected].label}». Нажми на место в схеме.` : 'Собери ветки записи и отмены. При отмене освободи время для другого пациента.'}</span><small class="mobile-pan-hint">Схему можно листать влево и вправо ↔</small></div>
            <div class="design-feedback ${this.errorNode ? 'is-error' : 'is-success'}" role="status" ${this.feedback ? '' : 'hidden'}>${this.feedback}</div><div class="flow-scroll"><div class="flow-canvas">
              <svg class="flow-wires" viewBox="0 0 1000 900" preserveAspectRatio="none" aria-hidden="true"><defs>${['yes', 'no', 'neutral'].map(kind => `<marker id="arrow-${kind}" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1 6 4 1 7" fill="none" stroke="${kind === 'no' ? '#b76c61' : '#5e8882'}" stroke-width="1.5"/></marker>`).join('')}</defs>
              ${wire('start', 'slot-0', 'M500 63 V90', 'neutral')}${wire('slot-0', 'operation', 'M500 153 V180', 'neutral')}
              ${wire('operation', 'branch-cancel', 'M645 225 H750')}${wire('branch-cancel', 'end-cancel', 'M865 261 V306')}
              ${wire('operation', 'slot-1', 'M500 270 V306', 'neutral')}${wire('slot-1', 'decision', 'M500 369 V396', 'neutral')}
              ${wire('decision', 'slot-2', 'M355 441 H255 V549')}${wire('decision', 'branch-schedule', 'M645 441 H865 V540', 'no')}
              ${wire('slot-2', 'slot-3', 'M130 594 H85 V660 H170 V684')}${wire('slot-2', 'branch-available', 'M380 594 H520 V684', 'no')}
              ${wire('slot-3', 'slot-4', 'M170 738 V765')}${wire('slot-4', 'end-success', 'M170 819 V846')}
              ${wire('branch-schedule', 'end-schedule', 'M865 603 V648', 'no')}${wire('branch-available', 'end-available', 'M520 747 V792', 'no')}
              </svg>
              <div class="flow-terminal start" data-node="start" style="left:39%;top:2%;width:22%;height:5%">${icon('play')} Начало</div>
              ${this.node('0', 'slot-0', 'left:35.5%;top:10%;width:29%;height:7%', 'Данные пациента')}
              <div class="flow-decision" data-node="operation" style="left:35.5%;top:20%;width:29%;height:10%"><span>Пациент отменяет<br>запись?</span></div>
              <span class="wire-label yes" style="left:68%;top:22%">Да</span><span class="wire-label" style="left:51%;top:31%">Нет · новая запись</span>
              ${this.node('cancel', 'branch-cancel', 'left:75%;top:21%;width:23%;height:8%', 'Что сделать со временем?')}
              <div class="flow-terminal" data-node="end-cancel" style="left:77%;top:34%;width:19%;height:5%">${icon('stop')} Конец</div>
              ${this.node('1', 'slot-1', 'left:35.5%;top:34%;width:29%;height:7%', 'Первая проверка')}
              <div class="flow-decision" data-node="decision" style="left:35.5%;top:44%;width:29%;height:10%"><span>Врач работает<br>в это время?</span></div>
              <span class="wire-label yes" style="left:28%;top:46%">Да</span><span class="wire-label no" style="left:70%;top:46%">Нет</span>
              ${this.node('2', 'slot-2', 'left:13%;top:61%;width:25%;height:10%', 'Свободно ли время?', 'diamond')}
              <span class="wire-label yes" style="left:12%;top:72%">Да</span><span class="wire-label no" style="left:41%;top:65%">Нет</span>
              ${this.node('schedule', 'branch-schedule', 'left:75%;top:60%;width:23%;height:7%', 'Если врач не работает')}
              ${this.node('3', 'slot-3', 'left:5%;top:76%;width:24%;height:6%', 'Действие при успехе')}
              ${this.node('available', 'branch-available', 'left:40%;top:76%;width:24%;height:7%', 'Если время занято')}
              ${this.node('4', 'slot-4', 'left:5%;top:85%;width:24%;height:6%', 'Сообщение пациенту')}
              <div class="flow-terminal" data-node="end-success" style="left:5%;top:94%;width:24%;height:4%">${icon('stop')} Конец</div>
              <div class="flow-terminal" data-node="end-schedule" style="left:77%;top:72%;width:19%;height:5%">${icon('stop')} Конец</div>
              <div class="flow-terminal" data-node="end-available" style="left:43%;top:88%;width:18%;height:5%">${icon('stop')} Конец</div>
            </div></div>
          </section>

        </div>
        <footer class="design-footer"><button class="design-button" data-design="notebook">← Техническое задание</button><span class="design-footer-note" role="status">Пациентов проверим после передачи программисту</span><div><button class="design-button" data-design="undo" ${!this.history.length ? 'disabled' : ''}>↶ Отменить</button><button class="design-button" data-design="reset">↻ Сбросить</button><button class="design-button primary" data-design="${complete ? 'finish' : 'verify'}">${complete ? 'Передать программисту →' : 'Проверить решение'}</button></div></footer>
      `, true);
      this.overlay.classList.add('design-overlay');
      this.overlay.querySelector('.modal').classList.add('design-workspace');
      document.body.appendChild(this.overlay);
      document.body.classList.add('designer-open');
      (this.scrollPositions || []).forEach(({ selector, top, left }) => {
        const element = this.overlay.querySelector(selector);
        if (element) { element.scrollTop = top; element.scrollLeft = left; }
      });
      this.overlay.querySelector(this.selected ? `.palette-card[data-card="${this.selected}"]` : 'button:not([disabled])')?.focus({ preventScroll: true });
    }

    validate() {
      const state = this.state();
      const result = H.validateDiagram(state.flowSlots, state.branches);
      this.errorNode = result.node || '';
      this.validated = result.ok;
      this.feedback = result.ok ? 'Схема готова! Передай её программисту. Проверим работу системы на последнем этапе.' : result.message;
      this.render();
      if (result.node) this.overlay.querySelector(`[data-node="${result.node}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return result.ok;
    }

    bind() {
      this.overlay.addEventListener('click', event => {
        const button = event.target.closest('[data-design]');
        if (!button || button.disabled || this.state().stage !== 'puzzle') return;
        const action = button.dataset.design;
        if (action === 'select') { this.selected = this.selected === button.dataset.card ? null : button.dataset.card; this.render(); }
        if (action === 'place') {
          if (this.selected) this.place(button.dataset.destination, this.selected);
          else { this.overlay.querySelector('.design-footer-note').textContent = 'Сначала выбери блок в списке слева.'; this.overlay.querySelector('.palette-card')?.focus({ preventScroll: true }); }
        }
        if (action === 'remove') { this.remember(); this.setSlot(button.dataset.destination, null); this.changed(); }
        if (action === 'undo' && this.history.length) { const old = this.history.pop(); this.state().flowSlots = old.slots; this.state().branches = old.branches; this.changed(); }
        if (action === 'reset') { this.remember(); this.state().flowSlots = emptySlots(); this.state().branches = { schedule: '', available: '', cancel: '' }; this.selected = null; this.changed(); }
        if (action === 'verify') this.validate();
        if (action === 'notebook') this.onNotebook();
        if (action === 'finish' && this.validated && H.validateDiagram(this.state().flowSlots, this.state().branches).ok) this.onFinish();

      });
      this.overlay.addEventListener('dragstart', event => {
        const card = event.target.closest('[draggable="true"][data-card]');
        if (!card) return event.preventDefault();
        event.dataTransfer.setData('application/x-hospital-block', JSON.stringify({ id: card.dataset.card, source: card.dataset.source ?? null }));
        event.dataTransfer.setData('text/plain', card.dataset.card);
        event.dataTransfer.effectAllowed = 'copyMove';
        this.overlay.classList.add('dragging-block');
      });
      this.overlay.addEventListener('dragover', event => {
        const target = event.target.closest('[data-slot]');
        if (!target) return;
        event.preventDefault();
        target.classList.add('drop-hover');
      });
      this.overlay.addEventListener('dragleave', event => event.target.closest('[data-slot]')?.classList.remove('drop-hover'));
      this.overlay.addEventListener('dragend', () => { this.overlay.classList.remove('dragging-block'); this.overlay.querySelectorAll('.drop-hover').forEach(node => node.classList.remove('drop-hover')); });
      this.overlay.addEventListener('drop', event => {
        const target = event.target.closest('[data-slot]');
        if (!target) return;
        event.preventDefault();
        try {
          const payload = JSON.parse(event.dataTransfer.getData('application/x-hospital-block'));
          const source = payload.source === null || ['0', '1', '2', '3', '4', 'schedule', 'available', 'cancel'].includes(payload.source) ? payload.source : null;
          this.place(target.dataset.slot, payload.id, source);
        } catch { /* Ignore unrelated files and text dropped onto the board. */ }
        this.overlay.classList.remove('dragging-block');
      });
    }
  };
})(Hospital);
