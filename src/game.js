window.Hospital = window.Hospital || {};

Hospital.Game = class {
  constructor(canvas, onArrival) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onArrival = onArrival;
    this.keys = new Set();
    this.paused = true;
    this.time = 0;
    this.lastTime = 0;
    this.camera = 0;
    this.noticeTimer = 0;
    this.prompt = '';
    this.fixedRemainder = 0;
    this.setLevel(0);
    this.bindControls();
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.resize();
    requestAnimationFrame(time => this.frame(time));
  }

  resize() {
    const bounds = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(320, Math.round(540 * bounds.width / Math.max(bounds.height, 1)));
    this.canvas.height = 540;
    this.ctx.imageSmoothingEnabled = false;
  }

  setLevel(index) {
    this.level = index;
    this.worldWidth = index === 0 ? 1720 : index === 1 ? 1450 : 1240;
    this.goal = this.worldWidth - 155;
    this.player = { x: 100, y: 405, w: 28, h: 54, vx: 0, vy: 0, grounded: false, facing: 1 };
    this.checkpoint = 100;
    this.camera = 0;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.invulnerable = 0;
    this.switches = index === 1 ? [{ x: 340, on: false }, { x: 800, on: false }] : [{ x: index === 0 ? 1040 : 680, on: false }];
    this.gateX = index === 0 ? 1180 : index === 1 ? 1040 : 890;
    this.puddles = index === 0 ? [{ x: 410, w: 92 }, { x: 870, w: 72 }] : index === 1 ? [{ x: 540, w: 85 }] : [{ x: 390, w: 85 }];
    this.carts = index === 0 ? [{ base: 670, x: 670, y: 420, w: 88, h: 46, move: 34 }] : [{ base: index === 1 ? 670 : 530, x: index === 1 ? 670 : 530, y: 420, w: 80, h: 46, move: 26 }];
    this.open = false;
    this.fixedRemainder = 0;
    this.clearInput();
    this.setPrompt('');
    this.noticeTimer = 0;
    document.getElementById('scene-notice').classList.remove('visible');
  }

  clearInput() { this.keys.clear(); this.jumpBuffer = 0; }

  bindControls() {
    window.addEventListener('keydown', event => {
      if (this.paused || /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
      const code = event.code;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyW', 'KeyA', 'KeyD', 'KeyE'].includes(code)) event.preventDefault();
      this.keys.add(code);
      if (!event.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(code)) this.jumpBuffer = .14;
      if (!event.repeat && code === 'KeyE') this.interact();
    });
    window.addEventListener('keyup', event => this.keys.delete(event.code));
    window.addEventListener('blur', () => this.clearInput());
    document.addEventListener('visibilitychange', () => { this.clearInput(); this.lastTime = 0; });
    this.canvas.addEventListener('pointerdown', () => this.canvas.focus({ preventScroll: true }));
    document.querySelectorAll('[data-control]').forEach(button => {
      const control = button.dataset.control;
      const code = { left: 'KeyA', right: 'KeyD', jump: 'Space' }[control];
      button.addEventListener('pointerdown', event => {
        event.preventDefault();
        if (this.paused) return;
        button.setPointerCapture(event.pointerId);
        if (control === 'interact') this.interact();
        else { this.keys.add(code); if (control === 'jump') this.jumpBuffer = .14; }
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, () => this.keys.delete(code)));
    });
  }

  interact() {
    if (this.paused) return;
    const center = this.player.x + this.player.w / 2;
    const nearby = this.switches.find(item => Math.abs(item.x - center) < 66 && !item.on);
    if (nearby) {
      nearby.on = true;
      this.open = this.switches.every(item => item.on);
      this.checkpoint = Math.max(100, nearby.x - 45);
      this.notice(this.open ? 'Дверь открыта. Можно идти дальше!' : 'Одна кнопка включена. Найди вторую.');
      return;
    }
    if (Math.abs(center - this.goal) < 85) this.onArrival(this.level);
  }

  setPrompt(value) {
    if (this.prompt === value) return;
    this.prompt = value;
    const element = document.getElementById('interaction-prompt');
    element.hidden = !value;
    element.querySelector('span').textContent = value;
  }

  notice(text) {
    const element = document.getElementById('scene-notice');
    element.textContent = text;
    element.classList.add('visible');
    this.noticeTimer = 3;
  }

  respawn() {
    const p = this.player;
    p.x = this.checkpoint;
    p.y = 380;
    p.vy = 0;
    p.vx = 0;
    this.invulnerable = 1;
    this.notice('Скользко! Перепрыгни лужу с разбега. Попытки не ограничены.');
  }

  update(dt) {
    const p = this.player;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = p.grounded ? .1 : Math.max(0, this.coyote - dt);
    let horizontal = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) horizontal--;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) horizontal++;
    p.vx = horizontal * 235;
    if (horizontal) p.facing = horizontal;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      p.vy = -505;
      p.grounded = false;
      this.jumpBuffer = 0;
      this.coyote = 0;
    }
    const solids = [];
    this.carts.forEach(cart => {
      const oldX = cart.x;
      cart.x = cart.base + Math.sin(this.time * .75) * cart.move;
      if (p.grounded && Math.abs(p.y + p.h - cart.y) < 3 && p.x + p.w > oldX && p.x < oldX + cart.w) p.x += cart.x - oldX;
      solids.push(cart);
    });
    if (!this.open) solids.push({ x: this.gateX, y: 155, w: 25, h: 311 });
    p.x += p.vx * dt;
    for (const solid of solids) {
      if (this.overlap(p, solid)) {
        if (p.vx > 0) p.x = solid.x - p.w;
        if (p.vx < 0) p.x = solid.x + solid.w;
      }
    }
    p.x = Math.max(20, Math.min(this.worldWidth - p.w - 20, p.x));
    const previousBottom = p.y + p.h;
    p.vy = Math.min(800, p.vy + 1450 * dt);
    p.y += p.vy * dt;
    p.grounded = false;
    for (const solid of solids) {
      if (this.overlap(p, solid) && previousBottom <= solid.y + 4 && p.vy >= 0) {
        p.y = solid.y - p.h;
        p.vy = 0;
        p.grounded = true;
      }
    }
    if (p.y + p.h >= 466) { p.y = 466 - p.h; p.vy = 0; p.grounded = true; }
    if (this.invulnerable <= 0 && p.y + p.h >= 463 && this.puddles.some(item => p.x + p.w - 5 > item.x && p.x + 5 < item.x + item.w)) this.respawn();
    const center = p.x + p.w / 2;
    const nearby = this.switches.find(item => Math.abs(item.x - center) < 66 && !item.on);
    let prompt = nearby ? 'Нажать кнопку' : Math.abs(center - this.goal) < 85 ? ['Поговорить с заказчиком', 'Открыть рабочий компьютер', 'Передать решение программисту'][this.level] : '';
    if (!prompt && !this.open && Math.abs(center - this.gateX) < 105) prompt = 'Сначала найди кнопку двери';
    this.setPrompt(prompt);
  }

  overlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  frame(timestamp) {
    const dt = this.lastTime ? Math.min((timestamp - this.lastTime) / 1000, .05) : 0;
    this.lastTime = timestamp;
    this.time += dt;
    if (!this.paused && !document.hidden) {
      this.fixedRemainder += dt;
      while (this.fixedRemainder >= 1 / 120) { this.update(1 / 120); this.fixedRemainder -= 1 / 120; }
      if (this.noticeTimer > 0) {
        this.noticeTimer -= dt;
        if (this.noticeTimer <= 0) document.getElementById('scene-notice').classList.remove('visible');
      }
    }
    const cameraTarget = Math.max(0, Math.min(this.worldWidth - this.canvas.width, this.player.x - this.canvas.width * .34));
    this.camera += (cameraTarget - this.camera) * Math.min(1, dt * 8);
    this.draw();
    requestAnimationFrame(time => this.frame(time));
  }

  rect(x, y, w, h, color) { this.ctx.fillStyle = color; this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  text(text, x, y, size = 10, color = '#526b6a', align = 'left') {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px "Segoe UI", sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, Math.round(x), Math.round(y));
  }

  draw() {
    const ctx = this.ctx;
    const width = this.canvas.width;
    this.rect(0, 0, width, 540, '#d9dfcc');
    this.rect(0, 0, width, 50, '#b2c7be');
    this.rect(0, 50, width, 5, '#a0b7af');
    this.rect(0, 290, width, 176, '#8eafa7');
    this.rect(0, 284, width, 7, '#6f958c');
    this.rect(0, 358, width, 5, '#789d94');
    this.rect(0, 457, width, 9, '#527a73');
    ctx.save();
    ctx.translate(-Math.round(this.camera * .2), 0);
    for (let x = 60; x < this.worldWidth + 500; x += 300) {
      this.rect(x, 12, 130, 7, '#8fa99f');
      this.rect(x + 3, 19, 124, 7, '#e9e9ce');
      this.rect(x + 9, 26, 112, 3, '#d1d8bd');
    }
    ctx.restore();
    ctx.save();
    ctx.translate(-Math.round(this.camera), 0);
    for (let x = 40; x < this.worldWidth; x += 340) this.window(x, 125);
    for (let x = 0; x < this.worldWidth; x += 96) {
      this.rect(x, 466, 95, 74, '#b6c4b6');
      this.rect(x, 466, 95, 2, '#d1dac9');
      this.rect(x, 502, 95, 1, '#9daf9e');
      this.rect(x + 47, 466, 1, 36, '#9daf9e');
      this.rect(x, 503, 1, 37, '#9daf9e');
    }
    this.rect(0, 466, this.worldWidth, 3, '#769485');
    this.door(230, 'СЛУЖЕБНЫЙ', '102');
    this.bench(330, 414);
    this.person(365, 381, '#9686a1', 1, 0, false, true);
    this.person(412, 381, '#788c9d', -1, 0, false, true);
    this.plant(70, 416);
    this.plant(this.goal - 145, 416);
    this.poster(560, 165);
    this.clock(770, 160);
    this.rect(855, 133, 179, 58, '#526d68');
    this.rect(859, 137, 171, 50, '#d8dec9');
    this.text('ЗАПИСЬ К ВРАЧУ', 945, 154, 10, '#56776b', 'center');
    this.text(Hospital.appState?.stage === 'complete' ? 'СИСТЕМА РАБОТАЕТ' : '14:00   ×   3 ПАЦИЕНТА', 945, 175, 10, Hospital.appState?.stage === 'complete' ? '#487760' : '#b06954', 'center');
    this.puddles.forEach(puddle => {
      this.rect(puddle.x + 8, 461, puddle.w - 16, 8, '#78aaa5');
      this.rect(puddle.x, 465, puddle.w, 5, '#6b9e9c');
      this.rect(puddle.x + 16, 463, 22, 2, '#bbd5c5');
      this.rect(puddle.x + 47, 467, 17, 2, '#a5c8b8');
      this.wetSign(puddle.x - 30, 435);
    });
    this.carts.forEach(cart => this.cart(cart));
    this.switches.forEach((item, index) => {
      this.rect(item.x - 12, 348, 24, 34, '#597b73');
      this.rect(item.x - 8, 352, 16, 23, '#c2ceba');
      this.rect(item.x - 5, 357, 10, 11, item.on ? '#8fb98b' : '#d18565');
      this.text(this.switches.length > 1 ? `КНОПКА ${index + 1}` : 'ДВЕРЬ', item.x, 338, 8, '#526f65', 'center');
      if (!item.on) {
        const bob = Math.sin(this.time * 3) * 3;
        this.text('↓', item.x, 315 + bob, 20, '#a66e4d', 'center');
      }
    });
    this.rect(this.gateX - 10, 157, 45, 8, '#66887f');
    this.rect(this.gateX - 10, 165, 7, 301, '#66887f');
    this.rect(this.gateX + 29, 165, 7, 301, '#66887f');
    if (!this.open) {
      this.rect(this.gateX, 166, 25, 300, '#7f9e96');
      for (let y = 175; y < 460; y += 25) this.rect(this.gateX + 2, y, 21, 2, '#a7bfb0');
      this.rect(this.gateX + 7, 325, 11, 35, '#5c7e76');
      this.rect(this.gateX + 10, 330, 5, 6, '#e19774');
    } else this.rect(this.gateX, 166, 25, 23, '#8da69b');
    this.text(this.open ? 'ПРОХОД ОТКРЫТ' : 'АВТОМАТИЧЕСКАЯ ДВЕРЬ', this.gateX + 12, 146, 8, '#57776c', 'center');
    this.door(this.goal - 26, ['РЕГИСТРАТУРА', 'АНАЛИТИКА', 'IT-ОТДЕЛ'][this.level], ['101', '204', '102'][this.level], true);
    if (this.level === 1) this.desk(this.goal - 70, 401);
    else this.person(this.goal - 48, 400, this.level === 0 ? '#e7e9d2' : '#709198', -1, 0);
    const markerY = 275 + Math.sin(this.time * 2.7) * 4;
    this.rect(this.goal + 19, markerY - 17, 22, 25, '#e7a376');
    this.text('!', this.goal + 30, markerY + 1, 18, '#4b5c4c', 'center');
    this.text(['ЗАКАЗЧИК', 'ТВОЁ РАБОЧЕЕ МЕСТО', 'ПРОГРАММИСТ'][this.level], this.goal + 30, 252, 9, '#3b6b5d', 'center');
    const p = this.player;
    if (this.invulnerable <= 0 || Math.floor(this.time * 12) % 2) this.person(p.x, p.y, '#df9867', p.facing, p.grounded && Math.abs(p.vx) > 0 ? this.time * 13 : 0, true);
    if (p.x < 260 && !this.paused) {
      this.text('ТЫ', p.x + 14, p.y - 15, 8, '#456b61', 'center');
      this.text('→', p.x + 68, p.y + 20, 22, '#ab7655', 'center');
    }
    ctx.restore();
    this.rect(0, 527, width, 13, '#8ea797');
  }

  window(x, y) {
    this.rect(x - 5, y - 5, 124, 132, '#88a69a');
    this.rect(x, y, 114, 121, '#bad5c6');
    this.rect(x + 6, y + 6, 102, 110, '#c8dec9');
    this.rect(x + 10, y + 70, 26, 46, '#a8c3ae');
    this.rect(x + 32, y + 53, 30, 63, '#aac6b0');
    this.rect(x + 70, y + 72, 30, 44, '#a3bea8');
    this.rect(x + 53, y + 1, 7, 120, '#e8e8d5');
    this.rect(x, y + 61, 114, 6, '#e5e6d1');
    this.rect(x - 9, y + 122, 132, 7, '#e5e5cf');
    this.rect(x - 4, y + 129, 124, 4, '#839e90');
    this.rect(x + 10, y + 7, 13, 51, '#dae8d357');
  }

  door(x, label, number, target = false) {
    this.rect(x - 6, 294, 108, 172, '#6c8b7c');
    this.rect(x, 300, 96, 166, target ? '#849e8c' : '#a9af91');
    this.rect(x + 7, 307, 82, 152, target ? '#a5b79e' : '#bdbea1');
    this.rect(x + 17, 321, 62, 51, '#bdd1b9');
    this.rect(x + 20, 324, 56, 45, '#cfe0c4');
    this.rect(x + 24, 329, 8, 35, '#e2e8ce');
    this.rect(x + 78, 390, 5, 17, '#617e6a');
    this.rect(x + 4, 271, 88, 18, '#e1e2cb');
    this.text(label, x + 48, 283, 8, '#536c5c', 'center');
    this.text(number, x + 48, 414, 12, '#688370', 'center');
    this.rect(x - 3, 464, 102, 3, '#577866');
  }

  person(x, y, shirt, facing = 1, walk = 0, hero = false, seated = false) {
    const r = (dx, dy, w, h, color) => this.rect(x + dx, y + dy, w, h, color);
    const step = walk ? Math.sin(walk) * 4 : 0;
    r(-4, 53, 36, 4, '#426b652a');
    r(7, 1, 18, 4, hero ? '#3e4e4c' : '#706d60');
    r(4, 5, 22, 12, hero ? '#3e4e4c' : '#706d60');
    r(7, 9, 18, 15, '#d9b28d');
    r(facing > 0 ? 18 : 8, 12, 3, 3, '#3c514d');
    r(10, 23, 12, 4, '#c49e7c');
    r(4, 26, 23, 18, shirt);
    r(0, 29, 5, 15, shirt);
    r(27, 29, 5, 15, shirt);
    r(0, 42, 5, 6, '#d8b08c');
    r(27, 42, 5, 6, '#d8b08c');
    r(5, 44, 9, seated ? 7 : 9 + step, '#4e6261');
    r(17, 44, 9, seated ? 7 : 9 - step, '#4e6261');
    r(3, 51 + (seated ? 0 : step), 11, 4, '#344c4e');
    r(17, 51 - (seated ? 0 : step), 12, 4, '#344c4e');
    if (hero) { r(17, 28, 6, 10, '#ecd6b0'); r(19, 30, 2, 4, '#718b79'); r(4, 25, 3, 17, '#b47c56'); }
    else if (shirt === '#e7e9d2') { r(14, 27, 2, 16, '#a6bca8'); r(19, 29, 5, 5, '#82a795'); }
  }

  bench(x, y) {
    this.rect(x, y, 152, 20, '#547d78');
    this.rect(x + 4, y + 3, 144, 12, '#6c9b90');
    this.rect(x - 3, y + 24, 158, 10, '#4d7872');
    this.rect(x + 10, y + 34, 5, 18, '#6d7c6c');
    this.rect(x + 134, y + 34, 5, 18, '#6d7c6c');
    for (let i = 0; i < 3; i++) this.rect(x + 50 * i, y + 2, 2, 17, '#4e7a71');
  }

  plant(x, y) {
    this.rect(x + 11, y + 18, 28, 31, '#b18c68');
    this.rect(x + 7, y + 13, 36, 8, '#c7a27a');
    this.rect(x + 23, y - 25, 5, 41, '#678565');
    [[3, -20, 22, 10], [23, -34, 20, 12], [8, -42, 17, 13], [26, -13, 22, 11], [1, -4, 24, 10]].forEach(v => this.rect(x + v[0], y + v[1], v[2], v[3], '#789e74'));
  }

  cart(cart) {
    const { x, y, w } = cart;
    this.rect(x - 2, y + 2, w + 4, 7, '#d2d8c2');
    this.rect(x + 4, y + 9, w - 8, 22, '#8caaa0');
    this.rect(x + 8, y + 12, w - 16, 5, '#aec5b3');
    this.rect(x + w / 2 - 6, y + 16, 12, 3, '#648e82');
    this.rect(x + 7, y + 31, 4, 11, '#617f76');
    this.rect(x + w - 11, y + 31, 4, 11, '#617f76');
    this.rect(x + 4, y + 40, 10, 7, '#4f716a');
    this.rect(x + w - 14, y + 40, 10, 7, '#4f716a');
    this.rect(x + 12, y - 11, 16, 13, '#eee6cf');
    this.rect(x + 17, y - 7, 6, 3, '#b17d66');
    this.rect(x + 19, y - 9, 2, 7, '#b17d66');
    this.rect(x + w - 23, y - 6, 13, 8, '#b4c9b0');
  }

  wetSign(x, y) {
    this.rect(x + 8, y, 12, 4, '#c39759');
    this.rect(x + 5, y + 4, 18, 20, '#d1ad67');
    this.rect(x + 2, y + 24, 5, 7, '#b38d51');
    this.rect(x + 21, y + 24, 5, 7, '#b38d51');
    this.text('!', x + 14, y + 19, 13, '#7b744c', 'center');
  }

  poster(x, y) {
    this.rect(x - 3, y - 3, 77, 95, '#99ae94');
    this.rect(x, y, 71, 89, '#e9e4c9');
    this.rect(x + 28, y + 13, 16, 39, '#95b2a0');
    this.rect(x + 16, y + 25, 40, 15, '#95b2a0');
    this.rect(x + 13, y + 65, 45, 3, '#bdc8ac');
    this.rect(x + 20, y + 73, 31, 3, '#bdc8ac');
  }

  clock(x, y) {
    const ctx = this.ctx;
    ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fillStyle = '#75958b'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.fillStyle = '#e1e2c9'; ctx.fill();
    this.rect(x - 1, y - 12, 2, 13, '#668376');
    this.rect(x, y - 1, 10, 2, '#668376');
    this.rect(x - 1, y - 1, 3, 3, '#ad8460');
  }

  desk(x, y) {
    this.rect(x, y + 20, 110, 8, '#c8b18b');
    this.rect(x + 5, y + 28, 7, 36, '#7e8f79');
    this.rect(x + 97, y + 28, 7, 36, '#7e8f79');
    this.rect(x + 25, y - 25, 57, 38, '#526f69');
    this.rect(x + 29, y - 21, 49, 29, '#92b9a3');
    this.rect(x + 34, y - 14, 25, 2, '#d0ddbc');
    this.rect(x + 34, y - 7, 35, 2, '#bad3b0');
    this.rect(x + 50, y + 13, 7, 7, '#617d6d');
    this.rect(x + 39, y + 18, 30, 3, '#617d6d');
  }
};
