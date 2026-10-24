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
    this.worldWidth = index === 0 ? 3000 : index === 1 ? 3200 : 3400;
    this.goal = this.worldWidth - 155;
    this.player = { x: 100, y: index === 2 ? 196 : 405, w: 28, h: 54, vx: 0, vy: 0, grounded: false, facing: 1, climbing: false, climbPhase: 0 };
    this.checkpoint = 100;
    this.checkpointY = index === 2 ? 196 : 380;
    this.camera = 0;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.invulnerable = 0;
    this.switches = index === 1 ? [{ x: 775, on: false }, { x: 2350, on: false }] : [{ x: index === 0 ? 1390 : 1150, on: false }];
    this.gateX = index === 0 ? 1510 : index === 1 ? 2620 : 1760;
    this.puddles = index === 0 ? [{ x: 850, w: 472 }] : index === 1 ? [{ x: 920, w: 290 }] : [{ x: 850, w: 180 }];
    this.carts = index === 0 ? [{ base: 1110, x: 1110, y: 420, w: 88, h: 46, move: 28 }] : [{ base: index === 1 ? 2020 : 950, x: index === 1 ? 2020 : 950, y: 420, w: 80, h: 46, move: 26 }];
    this.receptionMap = index === 0 ? {
      elapsed: 0,
      clientFloor: 180,
      floors: [{ x: 0, y: 466, w: 1680, h: 74 }, { x: 2130, y: 466, w: 870, h: 74 }],
      platforms: [
        { x: 430, y: 442, w: 100, h: 12, oneWay: true, type: 'step' },
        { x: 570, y: 394, w: 110, h: 12, oneWay: true, type: 'step' },
        { x: 788, y: 363, w: 182, h: 26, oneWay: false, type: 'medical-block' },
        { x: 1010, y: 385, w: 110, h: 12, oneWay: true, type: 'step' },
        { x: 1310, y: 422, w: 90, h: 12, oneWay: true, type: 'step' },
        { x: 1640, y: 400, w: 540, h: 14, oneWay: true, type: 'bridge' },
        { x: 1590, y: 180, w: 200, h: 16, oneWay: true, type: 'gallery' },
        { x: 1895, y: 180, w: 1055, h: 16, oneWay: true, type: 'gallery' },
      ],
      lift: { x: 1790, y: 400, w: 105, h: 13, oneWay: true },
    } : null;
    this.diagnosticMap = index === 1 ? {
      elapsed: 0,
      platforms: [
        { x: 620, y: 418, w: 110, h: 14, oneWay: true, type: 'step' },
        { x: 800, y: 360, w: 105, h: 14, oneWay: true, type: 'step' },
        { x: 970, y: 302, w: 90, h: 14, oneWay: true, type: 'step' },
        { x: 1100, y: 238, w: 100, h: 14, oneWay: true, type: 'step' },
        { x: 1870, y: 398, w: 130, h: 14, oneWay: true, type: 'step' },
        { x: 2080, y: 332, w: 120, h: 14, oneWay: true, type: 'step' },
        { x: 0, y: 172, w: 1420, h: 16, oneWay: true, type: 'gallery' },
        { x: 1540, y: 172, w: 1660, h: 16, oneWay: true, type: 'gallery' },
      ],
      ladders: [{ x: 986, y: 172, w: 24, h: 294 }, { x: 2230, y: 172, w: 24, h: 294 }],
      lift: { x: 1420, y: 400, w: 120, h: 14, oneWay: true },
    } : null;
    this.technicalMap = index === 2 ? {
      elapsed: 0,
      floors: [{ x: 0, y: 466, w: 1500, h: 74 }, { x: 2860, y: 466, w: 540, h: 74 }],
      platforms: [
        { x: 0, y: 250, w: 360, h: 14, oneWay: true, type: 'start' },
        { x: 360, y: 282, w: 100, h: 14, oneWay: true, type: 'step' },
        { x: 450, y: 320, w: 100, h: 14, oneWay: true, type: 'step' },
        { x: 540, y: 358, w: 100, h: 14, oneWay: true, type: 'step' },
        { x: 630, y: 396, w: 100, h: 14, oneWay: true, type: 'step' },
        { x: 720, y: 434, w: 100, h: 14, oneWay: true, type: 'step' },
        { x: 0, y: 150, w: 1460, h: 16, oneWay: true, type: 'gallery' },
        { x: 1390, y: 400, w: 220, h: 14, oneWay: true, type: 'bridge' },
        { x: 1580, y: 230, w: 920, h: 14, oneWay: true, type: 'bridge' },
        { x: 2620, y: 286, w: 270, h: 14, oneWay: true, type: 'bridge' },
        { x: 2790, y: 340, w: 100, h: 14, oneWay: true, type: 'step' },
        { x: 2860, y: 394, w: 90, h: 14, oneWay: true, type: 'step' },
      ],
      ladders: [{ x: 1280, y: 150, w: 26, h: 316 }],
      lift: { x: 1460, y: 400, w: 120, h: 14, oneWay: true, top: 150, bottom: 400 },
    } : null;
    this.open = false;
    this.fixedRemainder = 0;
    this.clearInput();
    this.setPrompt('');
    this.noticeTimer = 0;
    document.getElementById('scene-notice').classList.remove('visible');
    const locationStamp = document.querySelector('.location-stamp');
    if (locationStamp) locationStamp.hidden = true;
  }

  clearInput() { this.keys.clear(); this.jumpBuffer = 0; }

  bindControls() {
    window.addEventListener('keydown', event => {
      if (this.paused || /INPUT|SELECT|TEXTAREA|BUTTON/.test(event.target.tagName)) return;
      const code = event.code;
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'Space', 'KeyW', 'KeyA', 'KeyD', 'KeyE'].includes(code)) event.preventDefault();
      if (this.level > 0 && ['ArrowDown', 'KeyS'].includes(code)) event.preventDefault();
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
    if (this.level === 0 && Math.abs(center - this.goal) < 85 && Math.abs(this.player.y + this.player.h - this.receptionMap.clientFloor) > 40) {
      this.notice('Заказчик на втором этаже. Поднимись на лифте.');
      return;
    }
    if (this.level > 0 && Math.abs(center - this.goal) < 85 && (!this.open || Math.abs(this.player.y + this.player.h - 466) > 60)) return;
    const nearby = this.switches.find(item => Math.abs(item.x - center) < 66 && !item.on && Math.abs(this.player.y + this.player.h - 466) < 90);
    if (nearby) {
      nearby.on = true;
      this.open = this.switches.every(item => item.on);
      this.checkpoint = Math.max(100, nearby.x - 45);
      this.checkpointY = 380;
      this.notice(this.open ? 'Дверь открыта. Можно идти дальше!' : 'Одна кнопка включена. Найди вторую.');
      this.updateInteractionPrompt();
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

  updateInteractionPrompt() {
    const p = this.player;
    const center = p.x + p.w / 2;
    const nearby = this.switches.some(item => !item.on && Math.abs(item.x - center) < 66 && Math.abs(p.y + p.h - 466) < 90);
    const targetFloor = this.level === 0 ? this.receptionMap.clientFloor : 466;
    const atTarget = Math.abs(center - this.goal) < 85 && Math.abs(p.y + p.h - targetFloor) <= (this.level === 0 ? 40 : 60) && this.open;
    const action = ['Поговорить с заказчиком', 'Открыть рабочий компьютер', 'Передать решение программисту'][this.level];
    this.setPrompt(nearby ? 'Нажать кнопку двери' : atTarget ? action : '');
  }

  notice(text) {
    if (this.level < 2) return;
    const element = document.getElementById('scene-notice');
    element.textContent = text;
    element.classList.add('visible');
    this.noticeTimer = 3;
  }

  respawn() {
    const p = this.player;
    p.x = this.checkpoint;
    p.y = this.checkpointY;
    p.climbing = false;
    p.vy = 0;
    p.vx = 0;
    this.invulnerable = 1;
    this.setPrompt('');
    this.notice('Скользко! Перепрыгни лужу с разбега. Попытки не ограничены.');
  }

  update(dt) {
    if (this.level === 0) return this.updateReceptionLevel(dt);
    if (this.level === 1) return this.updateDiagnosticLevel(dt);
    if (this.level === 2) return this.updateDiagnosticLevel(dt, this.technicalMap);
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
  pixelLine(x1, y1, x2, y2, color, width = 1) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1))));
    for (let i = 0; i <= steps; i++) this.rect(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps, width, width, color);
  }

  monitorActivity(x, y, w, h) {
    const phase = this.time + x * .017 + y * .023;
    const scan = (phase % 4) / 4;
    this.rect(x + 2, y + scan * (h - 1), w - 4, 1, '#e0edc424');
    if (phase % 1.8 < .9) this.rect(x + w - 6, y + h - 4, 3, 1, '#d2dfb5');
  }

  windowBird(x, y, w, h) {
    if (x + w < this.camera || x > this.camera + this.canvas.width) return;
    // A seeded chance per time interval avoids frame-rate-dependent random flicker.
    const random = seed => { const value = Math.sin(seed * 127.1) * 43758.5453; return value - Math.floor(value); };
    const seed = x * .37 + y * .73 + this.level * 97;
    const time = this.time + random(seed + 2) * 18;
    const cycle = Math.floor(time / 18);
    if (random(seed + cycle * 13.7) >= .16) return;
    const elapsed = time % 18 - (3 + random(seed + cycle * 7 + 18) * 10);
    const duration = 2.2;
    if (elapsed < 0 || elapsed > duration) return;
    const progress = elapsed / duration;
    const right = random(seed + cycle + 41) > .5;
    const bx = x - 10 + (w + 20) * (right ? progress : 1 - progress);
    const by = y + h * (.25 + random(seed + 7) * .25) + Math.sin(elapsed * 2.4) * 2;
    const wing = Math.round(Math.sin(elapsed * 17) * 2);
    const c = this.ctx;
    c.save(); c.beginPath(); c.rect(x + 8, y + 8, w - 16, h - 16); c.clip();
    this.rect(bx, by, 4, 2, '#718777');
    this.rect(bx + (right ? 4 : -1), by, 1, 1, '#718777');
    this.rect(bx - 2, by - wing, 3, 1, '#81927b');
    this.rect(bx + 3, by - wing, 3, 1, '#81927b');
    this.rect(bx - 4, by - wing * 2, 2, 1, '#81927b');
    this.rect(bx + 6, by - wing * 2, 2, 1, '#81927b');
    c.restore();
  }

  text(text, x, y, size = 10, color = '#526b6a', align = 'left') {
    this.ctx.fillStyle = color;
    this.ctx.font = `${size}px "Segoe UI", sans-serif`;
    this.ctx.textAlign = align;
    this.ctx.fillText(text, Math.round(x), Math.round(y));
  }

  draw() {
    if (this.level === 0) return this.drawReceptionLevel();
    if (this.level === 1) return this.drawDiagnosticLevel();
    if (this.level === 2) return this.drawTechnicalLevel();
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
    this.drawPlayer();
    if (p.x < 260 && !this.paused) {
      this.text('ТЫ', p.x + 14, p.y - 15, 8, '#456b61', 'center');
      this.text('→', p.x + 68, p.y + 20, 22, '#ab7655', 'center');
    }
    ctx.restore();
    this.rect(0, 527, width, 13, '#8ea797');
  }

  updateReceptionLevel(dt) {
    const p = this.player;
    const map = this.receptionMap;
    map.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = p.grounded ? .1 : Math.max(0, this.coyote - dt);
    const direction = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    p.vx = direction * 235;
    if (direction) p.facing = direction;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      p.vy = -505;
      p.grounded = false;
      this.jumpBuffer = this.coyote = 0;
    }
    const solids = [...map.floors, ...map.platforms];
    this.carts.forEach(cart => {
      const oldX = cart.x;
      cart.x = cart.base + Math.sin(this.time * .75) * cart.move;
      if (p.grounded && Math.abs(p.y + p.h - cart.y) < 3 && p.x + p.w > oldX && p.x < oldX + cart.w) p.x += cart.x - oldX;
      solids.push(cart);
    });
    const lift = map.lift;
    const oldY = lift.y;
    // Pause at both landings so players can board for either direction.
    const phase = map.elapsed % 10;
    const travel = phase < 1 ? 0 : phase < 5 ? (phase - 1) / 4 : phase < 6 ? 1 : (10 - phase) / 4;
    lift.y = 400 - (1 - Math.cos(travel * Math.PI)) * 110;
    if (p.grounded && Math.abs(p.y + p.h - oldY) < 3 && p.x + p.w > lift.x && p.x < lift.x + lift.w) p.y += lift.y - oldY;
    solids.push(lift);
    if (!this.open) solids.push({ x: this.gateX, y: 45, w: 52, h: 421 });
    p.x += p.vx * dt;
    for (const solid of solids) {
      if (!solid.oneWay && this.overlap(p, solid)) {
        if (p.vx > 0) p.x = solid.x - p.w;
        if (p.vx < 0) p.x = solid.x + solid.w;
      }
    }
    p.x = Math.max(20, Math.min(this.worldWidth - p.w - 20, p.x));
    const previousTop = p.y;
    const previousBottom = p.y + p.h;
    p.vy = Math.min(800, p.vy + 1450 * dt);
    p.y += p.vy * dt;
    p.grounded = false;
    for (const solid of solids) {
      if (!this.overlap(p, solid)) continue;
      if (previousBottom <= solid.y + 4 && p.vy >= 0) {
        p.y = solid.y - p.h;
        p.vy = 0;
        p.grounded = true;
      } else if (!solid.oneWay && previousTop >= solid.y + solid.h - 4 && p.vy < 0) {
        p.y = solid.y + solid.h;
        p.vy = 0;
      }
    }
    if (p.y > 620) {
      this.respawn();
      this.notice('Через шахту ведёт мостик. Подпрыгни, чтобы попасть на него.');
    }
    if (this.invulnerable <= 0 && p.y + p.h >= 463 && this.puddles.some(item => p.x + p.w - 5 > item.x && p.x + 5 < item.x + item.w)) this.respawn();
    this.updateInteractionPrompt();
  }

  drawReceptionLevel() {
    const c = this.ctx;
    const width = this.canvas.width;
    this.rect(0, 0, width, 540, '#102f32');
    c.save();
    c.translate(-Math.round(this.camera), 0);

    // Three architectural zones, rather than a repeated corridor texture.
    this.receptionRoom(0, 57, 760, 409);
    this.receptionRoom(760, 174, 735, 292);
    this.receptionRoom(760, 28, 735, 140, true);
    this.receptionRoom(1930, 180, 1070, 286);
    this.receptionRoom(1590, 28, 1360, 146, true);

    this.receptionWindow(55, 91, 82, 80);
    this.receptionWindow(178, 91, 82, 80);
    [850, 1015, 1180].forEach(x => this.receptionWindow(x, 217, 82, 127));
    [810, 990, 1170, 1350].forEach(x => this.receptionWindow(x, 45, 88, 78));
    [1990, 2190, 2390, 2590].forEach(x => this.receptionWindow(x, 222, 76, 115));
    [1700, 1910, 2120, 2330, 2540].forEach(x => this.receptionWindow(x, 43, 92, 76));

    [290, 580, 805, 1100, 1330, 2010, 2270, 2540, 2810].forEach((x, i) => this.receptionLamp(x, i < 2 ? 174 : 195));
    this.receptionQueue(55, 204);
    this.clock(636, 201);
    this.receptionNotices(30, 330);
    this.bench(30, 414);
    this.person(48, 381, '#a18e91', 1, 0, false, true);
    this.person(143, 381, '#7e9f9b', -1, 0, false, true);
    this.person(335, 374, '#e7e9d2', -1, 0, false, false, 'nurse');
    this.receptionDesk(275, 407, 155);
    this.receptionPlant(701, 416);
    this.receptionWaterCooler(220, 384);
    this.receptionRadiator(465, 340, 103);
    this.receptionMedicalCabinet(644, 281);
    this.receptionBin(732, 433);

    [860, 1025, 1190].forEach(x => this.receptionRadiator(x, 350, 70));
    this.receptionMedicalCabinet(1344, 282);
    this.receptionLine(784, 201, 1475, 201, '#5e8b7c', 3);
    this.receptionLine(784, 205, 1475, 205, '#b9c9a5');
    this.receptionBed(1020, 386);
    this.receptionWheelchair(1344, 407);
    this.receptionIV(980, 352);
    this.receptionIV(1190, 352);

    // The shaft and the open space under the bridge are actual level geometry.
    this.receptionShaft(1742, 28, 184, 438);
    this.receptionShelf(2630, 63, 100, 110);
    this.receptionDesk(2480, 122, 120);
    this.receptionPlant(2430, 126);
    this.receptionPlant(1650, 126);
    this.receptionPlant(1300, 120);
    this.receptionNotices(2190, 83);
    this.receptionBin(2350, 147);
    this.receptionMap.platforms.filter(platform => platform.type === 'gallery').forEach(platform => this.receptionRailing(platform.x, platform.y, platform.w));

    this.receptionMap.floors.forEach(floor => this.receptionFoundation(floor));
    this.receptionMap.platforms.forEach(platform => this.receptionPlatform(platform));
    this.receptionPlatform(this.receptionMap.lift, true);
    this.receptionRailing(1640, 400, 540);

    this.puddles.forEach(puddle => {
      this.rect(puddle.x, 463, puddle.w, 7, '#4c9293');
      this.rect(puddle.x + 7, 460, puddle.w - 14, 5, '#80b7ac');
      for (let dx = 17; dx < puddle.w - 30; dx += 67) {
        const ripple = Math.round(Math.sin(this.time * 1.6 + dx) * 3);
        this.rect(puddle.x + dx + ripple, 462, 23, 2, '#bed4bc');
        this.rect(puddle.x + dx + 12, 466, 32, 1, '#6aa79f');
      }
      this.wetSign(puddle.x - 27, 435);
      this.wetSign(puddle.x + puddle.w + 10, 435);
    });
    this.carts.forEach(cart => this.cart(cart));
    this.receptionGate();

    this.receptionBench(2245, 414);
    this.receptionRadiator(2170, 350, 80);
    this.receptionPlant(2420, 416);
    this.receptionNotices(2500, 302);
    this.receptionWaterCooler(2670, 384);
    this.bankATM(this.goal - 102, 466);
    this.receptionPlant(2870, 416);
    this.receptionBin(2615, 433);
    this.clock(2350, 272);
    const clientFloor = this.receptionMap.clientFloor;
    this.receptionDoor(this.goal - 28, clientFloor, true);
    this.person(this.goal - 82, clientFloor - 54, '#e7e9d2', -1, 0, false, false, 'client');
    const bob = Math.sin(this.time * 2.7) * 3;
    const bubbleY = clientFloor - 117 + bob;
    this.rect(this.goal - 80, bubbleY, 29, 20, '#e4a16d');
    this.rect(this.goal - 77, bubbleY + 19, 6, 5, '#e4a16d');
    [0, 1, 2].forEach(i => this.rect(this.goal - 75 + i * 7, bubbleY + 9, 4, 4, '#365753'));

    this.drawPlayer();
    c.restore();
  }

  updateDiagnosticLevel(dt, map = this.diagnosticMap) {
    const p = this.player;
    map.elapsed += dt;
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = p.grounded ? .1 : Math.max(0, this.coyote - dt);
    const direction = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    const solids = [...(map.floors || []), ...map.platforms];
    this.carts.forEach(cart => {
      const oldX = cart.x;
      cart.x = cart.base + Math.sin(this.time * .75) * cart.move;
      if (p.grounded && Math.abs(p.y + p.h - cart.y) < 3 && p.x + p.w > oldX && p.x < oldX + cart.w) p.x += cart.x - oldX;
      solids.push(cart);
    });
    const lift = map.lift;
    const oldY = lift.y;
    const phase = map.elapsed % 10;
    const travel = phase < 1 ? 0 : phase < 5 ? (phase - 1) / 4 : phase < 6 ? 1 : (10 - phase) / 4;
    const liftBottom = lift.bottom ?? 400;
    const liftTop = lift.top ?? 172;
    lift.y = liftBottom - (1 - Math.cos(travel * Math.PI)) * (liftBottom - liftTop) / 2;
    if (p.grounded && Math.abs(p.y + p.h - oldY) < 3 && p.x + p.w > lift.x && p.x < lift.x + lift.w) p.y += lift.y - oldY;
    solids.push(lift);
    if (!this.open) solids.push({ x: this.gateX, y: 0, w: 46, h: map.floors ? 540 : 466 });

    const ladder = map.ladders.find(item => Math.abs(p.x + p.w / 2 - item.x - item.w / 2) < 22 && p.y + p.h >= item.y - 2 && p.y < item.y + item.h);
    const up = this.keys.has('KeyW') || this.keys.has('ArrowUp') || this.keys.has('Space');
    const down = this.keys.has('KeyS') || this.keys.has('ArrowDown');
    if (!direction && ladder && (up || down || p.climbing)) {
      p.climbing = true;
      p.x = ladder.x + (ladder.w - p.w) / 2;
      p.vx = 0;
      p.vy = (Number(down) - Number(up)) * 155;
      const previousY = p.y;
      p.y = Math.max(ladder.y - p.h, Math.min(ladder.y + ladder.h - p.h, p.y + p.vy * dt));
      p.climbPhase += (p.y - previousY) / 9;
      p.grounded = p.y + p.h === ladder.y || p.y + p.h === ladder.y + ladder.h;
      if (p.grounded) { p.climbing = false; p.vy = 0; }
      this.jumpBuffer = this.coyote = 0;
      this.updateInteractionPrompt();
      return;
    }
    if (p.climbing) { p.climbing = false; this.coyote = .1; }
    p.vx = direction * 235;
    if (direction) p.facing = direction;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      p.vy = -505;
      p.grounded = false;
      this.jumpBuffer = this.coyote = 0;
    }
    p.x += p.vx * dt;
    for (const solid of solids) {
      if (!solid.oneWay && this.overlap(p, solid)) {
        if (p.vx > 0) p.x = solid.x - p.w;
        if (p.vx < 0) p.x = solid.x + solid.w;
      }
    }
    p.x = Math.max(20, Math.min(this.worldWidth - p.w - 20, p.x));
    const previousTop = p.y;
    const previousBottom = p.y + p.h;
    p.vy = Math.min(800, p.vy + 1450 * dt);
    p.y += p.vy * dt;
    p.grounded = false;
    for (const solid of solids) {
      if (!this.overlap(p, solid)) continue;
      if (previousBottom <= solid.y + 4 && p.vy >= 0) {
        p.y = solid.y - p.h;
        p.vy = 0;
        p.grounded = true;
      } else if (!solid.oneWay && previousTop >= solid.y + solid.h - 4 && p.vy < 0) {
        p.y = solid.y + solid.h;
        p.vy = 0;
      }
    }
    if (!map.floors && p.y + p.h >= 466) { p.y = 466 - p.h; p.vy = 0; p.grounded = true; }
    if (p.y > 620) {
      this.respawn();
      this.notice('Не долетел! Вернулся к безопасному месту. Попробуй прыгнуть ближе к краю.');
    }
    if (this.invulnerable <= 0 && p.y + p.h >= 463 && this.puddles.some(item => p.x + p.w - 5 > item.x && p.x + 5 < item.x + item.w)) this.respawn();
    this.updateInteractionPrompt();
  }

  drawDiagnosticLevel() {
    const c = this.ctx;
    this.rect(0, 0, this.canvas.width, 540, '#153737');
    c.save();
    c.translate(-Math.round(this.camera), 0);

    this.receptionRoom(0, 0, 3200, 166, true);
    [50, 230, 410, 590, 1790, 1970, 2150, 2330, 2510, 2700, 2880, 3060].forEach(x => this.receptionWindow(x, 35, 82, 84));
    [790, 915, 1040, 1165].forEach(x => this.diagnosticCabinet(x, 25, 108, 136));
    this.receptionRoom(0, 222, 650, 244);
    this.rect(650, 188, 600, 278, '#426f64');
    this.rect(658, 198, 584, 268, '#557e6d');
    this.receptionRoom(1750, 222, 850, 244);
    this.rect(1764, 237, 822, 206, '#41685e');
    this.receptionRoom(2680, 222, 520, 244);
    this.rect(2694, 237, 492, 203, '#c3a482');
    this.rect(2694, 349, 492, 88, '#a5b29a');

    // Upper circulation and lower rooms share the same structural beams.
    this.rect(0, 190, 1250, 27, '#183e3d');
    this.rect(1750, 190, 1450, 27, '#183e3d');
    this.rect(0, 217, 1250, 5, '#729c85');
    this.rect(1750, 217, 1450, 5, '#729c85');
    [28, 540, 1765, 2060, 2360, 2770, 3000].forEach(x => this.receptionLamp(x, 242));

    // A staffed nursing station at the entrance.
    this.receptionWindow(44, 267, 77, 90);
    this.receptionShelf(330, 278, 80, 105);
    this.receptionMedicalCabinet(450, 283);
    this.receptionNotices(160, 294);
    this.receptionPlant(565, 416);
    this.receptionWaterCooler(505, 384);
    this.person(278, 367, '#c8d6b7', -1, 0, false, false, 'nurse');
    this.receptionDesk(230, 401, 170);
    this.receptionBed(65, 386);
    this.receptionBin(427, 433);
    this.clock(555, 294);

    // Exposed service pipes, relay cabinets and platforms over the wet floor.
    this.diagnosticPipes(675, 205, 207, 215);
    this.diagnosticPipes(1035, 195, 180, 228);
    [690, 835, 1080].forEach((x, i) => this.diagnosticCabinet(x, 368 - i * 12, 92, 98 + i * 12));
    this.receptionShelf(806, 275, 70, 83);
    this.diagnosticVent(1100, 270, 112, 43);
    this.receptionDoor(1155, 466, this.switches[0].on);
    this.rect(1190, 341, 13, 7, this.switches[0].on ? '#9ac08f' : '#cc926b');

    // A real lift connects both floors through an opening in the gallery.
    this.receptionShaft(1250, 0, 500, 466);
    this.rect(1300, 186, 400, 8, '#d1d8b3');
    this.rect(1300, 194, 400, 7, '#39685e');
    this.rect(1309, 206, 382, 248, '#96b4a0');
    this.rect(1320, 214, 360, 238, '#aac5ad');
    this.rect(1497, 214, 6, 238, '#5b8a78');
    this.receptionLine(1328, 438, 1478, 220, '#d8dfbb', 4);
    this.receptionLine(1514, 438, 1665, 220, '#d8dfbb', 4);
    this.rect(1461, 152, 78, 21, '#4c786b');
    this.rect(1468, 158, 12, 8, '#d2a178');
    this.rect(1486, 158, 12, 8, '#a2bda1');
    this.rect(1504, 158, 12, 8, '#a2bda1');

    // Diagnostic workstations and instruments fill the darker technical room.
    this.diagnosticConsole(1800, 333, 190);
    this.diagnosticConsole(2050, 359, 150);
    this.diagnosticCabinet(2440, 290, 119, 176);
    this.diagnosticVent(2210, 262, 139, 39);
    this.diagnosticPipes(2490, 229, 84, 124);
    this.receptionMedicalCabinet(2310, 268);
    this.receptionBed(1810, 386);
    this.receptionIV(1980, 343);
    this.receptionBin(2390, 433);

    // Warm light, books and a computer identify the analyst's destination.
    this.receptionShelf(2720, 277, 130, 176);
    this.receptionNotices(2890, 289);
    this.receptionPlant(2850, 416);
    this.receptionDesk(this.goal - 110, 407, 140);
    this.receptionDoor(3105, 466, true);
    this.rect(2990, 451, 9, 15, '#41675b');
    this.rect(2969, 433, 38, 8, '#789883');
    this.rect(2975, 409, 30, 26, '#789883');

    this.receptionFoundation({ x: 0, y: 466, w: this.worldWidth, h: 74 });
    this.diagnosticMap.platforms.forEach(platform => this.receptionPlatform(platform));
    this.receptionPlatform(this.diagnosticMap.lift, true);
    this.diagnosticMap.platforms.filter(platform => platform.type === 'gallery').forEach(platform => this.receptionRailing(platform.x, platform.y, platform.w));
    this.bankATM(this.goal - 36, 172);
    this.diagnosticMap.ladders.forEach(ladder => this.diagnosticLadder(ladder));
    this.puddles.forEach(puddle => {
      this.rect(puddle.x, 463, puddle.w, 7, '#4c9293');
      this.rect(puddle.x + 7, 460, puddle.w - 14, 5, '#80b7ac');
      for (let dx = 17; dx < puddle.w - 30; dx += 67) this.rect(puddle.x + dx, 462, 23, 2, '#bed4bc');
      this.wetSign(puddle.x - 29, 435);
      this.wetSign(puddle.x + puddle.w + 11, 435);
    });
    this.carts.forEach(cart => this.cart(cart));
    this.diagnosticGate();

    const markerY = 357 + Math.sin(this.time * 2.7) * 3;
    this.rect(this.goal - 15, markerY, 31, 25, '#e4a16d');
    this.rect(this.goal - 10, markerY + 5, 21, 12, '#365753');
    this.rect(this.goal - 7, markerY + 7, 15, 7, '#b8cdb0');
    this.rect(this.goal - 2, markerY + 17, 5, 4, '#365753');
    this.drawPlayer();
    c.restore();
  }

  diagnosticCabinet(x, y, w, h) {
    this.rect(x, y, w, h, '#3c665c');
    this.rect(x + 3, y + 3, w - 6, h - 6, '#93aa8e');
    this.rect(x + 7, y + 7, w - 14, h - 14, '#79987f');
    for (let dy = 8; dy < h - 20; dy += 32) {
      this.rect(x + 8, y + dy, w - 16, 25, '#9eb397');
      this.rect(x + 13, y + dy + 5, 17, 9, '#c4ceb0');
      this.rect(x + w - 28, y + dy + 12, 13, 3, '#587b66');
      this.rect(x + 10, y + dy + 23, w - 20, 2, '#6d8f77');
    }
    this.rect(x + 5, y + h - 5, w - 10, 5, '#456e5d');
  }

  diagnosticPipes(x, y, w, h) {
    [0, 1, 2, 3].forEach(i => {
      const dx = i * 13;
      const bend = y + h - i * 17;
      this.receptionLine(x + dx, y, x + dx, bend, '#2b554d', 8);
      this.receptionLine(x + dx + 1, y, x + dx + 1, bend, '#8ba991', 3);
      this.receptionLine(x + dx, bend, x + w, bend, '#2b554d', 8);
      this.receptionLine(x + dx, bend - 1, x + w, bend - 1, '#8ba991', 3);
      this.rect(x + dx - 5, y + 38, 11, 5, '#afbea0');
    });
  }

  diagnosticVent(x, y, w, h) {
    this.rect(x, y, w, h, '#2a524c');
    this.rect(x + 3, y + 3, w - 6, h - 6, '#9db195');
    for (let dy = 8; dy < h - 5; dy += 6) this.rect(x + 8, y + dy, w - 16, 3, '#567d69');
  }

  diagnosticConsole(x, y, w) {
    this.rect(x - 4, y + 60, w + 8, 8, '#bbcca8');
    this.rect(x, y + 68, w, 40, '#789981');
    this.rect(x + 5, y + 74, w - 10, 27, '#426c5d');
    for (let dx = 10; dx < w - 20; dx += 56) {
      this.rect(x + dx, y, 48, 53, '#284f49');
      this.rect(x + dx + 4, y + 4, 40, 35, '#a1b797');
      this.rect(x + dx + 8, y + 8, 32, 27, '#648c77');
      this.rect(x + dx + 12, y + 21, 8, 3, '#c7d5ae');
      this.rect(x + dx + 19, y + 14, 3, 10, '#c7d5ae');
      this.rect(x + dx + 21, y + 24, 10, 3, '#c7d5ae');
      this.monitorActivity(x + dx + 8, y + 8, 32, 27);
      this.rect(x + dx + 8, y + 43, 8, 4, '#d4a478');
      this.rect(x + dx + 22, y + 43, 8, 4, '#a1bc91');
    }
    this.rect(x + 14, y + 54, w - 28, 4, '#4b7663');
  }

  diagnosticLadder({ x, y, w, h }) {
    this.rect(x - 2, y, 4, h, '#456e60');
    this.rect(x + 1, y, 3, h, '#dce1ba');
    this.rect(x + w - 2, y, 4, h, '#456e60');
    this.rect(x + w - 3, y, 3, h, '#dce1ba');
    for (let dy = 9; dy < h; dy += 16) {
      this.rect(x + 4, y + dy + 2, w - 7, 3, '#456e60');
      this.rect(x + 4, y + dy, w - 7, 3, '#dce1ba');
    }
  }

  diagnosticGate() {
    const x = this.gateX;
    this.rect(x - 16, 0, 16, 466, '#284f47');
    this.rect(x + 46, 0, 16, 466, '#284f47');
    this.rect(x - 12, 0, 4, 466, '#91af92');
    this.rect(x + 50, 0, 4, 466, '#91af92');
    this.rect(x, 0, 46, 9, '#adbea0');
    if (!this.open) {
      this.rect(x, 9, 46, 457, '#769d88');
      for (let dy = 14; dy < 466; dy += 19) {
        this.rect(x + 2, dy, 42, 3, '#b3c6a6');
        this.rect(x + 2, dy + 3, 42, 2, '#527e69');
      }
    } else this.rect(x, 9, 46, 17, '#8aaa8e');
    this.switches.forEach((item, i) => {
      const wireY = 202 + i * 9;
      const color = item.on ? '#b3c48c' : '#b08b64';
      this.receptionLine(item.x, 354, item.x, wireY, color, 2);
      this.receptionLine(item.x, wireY, x + 22, wireY, color, 2);
      this.rect(item.x - 15, 350, 30, 35, '#315f50');
      this.rect(item.x - 11, 354, 22, 27, '#bfd0ac');
      this.rect(item.x - 6, 360, 12, 13, item.on ? '#8cbd8a' : '#d48e66');
      this.rect(x + 9 + i * 17, 231, 10, 8, item.on ? '#a5c68e' : '#d0966d');
    });
  }

  drawTechnicalLevel() {
    const c = this.ctx;
    this.rect(0, 0, this.canvas.width, 540, '#0c2529');
    c.save();
    c.translate(-Math.round(this.camera), 0);

    this.rect(0, 0, this.worldWidth, 466, '#123235');
    for (let x = 15; x < this.worldWidth; x += 140) {
      this.rect(x, 15, 126, 440, '#173b3b');
      this.rect(x + 4, 19, 118, 432, '#193e3d');
      this.rect(x + 11, 27, 2, 415, '#224b45');
      this.rect(x + 112, 27, 2, 415, '#102c30');
      [60, 182, 310].forEach(y => this.rect(x + 19, y, 85, 3, '#204944'));
    }
    this.rect(0, 12, 2860, 10, '#0c292d');
    this.rect(0, 23, 2860, 3, '#426b5e');
    this.technicalCableBundle(40, 58, 640, 1410, 36);
    this.technicalCableBundle(1770, 375, 2450, 2875, 236);
    this.technicalCableBundle(1030, 420, 1350, 1770, 205);

    [50, 285, 530, 850, 1110].forEach((x, i) => {
      this.technicalRack(x, 35, 68, 88);
      if (i % 2 === 0) this.diagnosticVent(x + 74, 45, 94, 39);
    });
    [70, 445, 865, 1180, 1660, 2100, 2420].forEach((x, i) => this.technicalLamp(x, i < 4 ? 153 : 250));

    // The start landing descends into the server room on physical stair treads.
    this.rect(20, 291, 370, 161, '#113034');
    this.rect(35, 303, 72, 149, '#244b46');
    this.rect(42, 310, 58, 135, '#31594e');
    this.diagnosticVent(48, 322, 46, 67);
    this.rect(127, 330, 94, 122, '#1b3f3e');
    this.rect(135, 340, 78, 101, '#31584e');
    this.receptionLine(346, 254, 816, 448, '#102c2e', 22);
    this.receptionLine(346, 254, 816, 448, '#466d5b', 3);
    this.receptionLine(344, 224, 817, 417, '#6c8d71', 3);
    [360, 450, 540, 630, 720].forEach((x, i) => this.receptionLine(x + 8, 231 + i * 38, x + 8, 282 + i * 38, '#4e7963', 3));

    this.rect(742, 267, 644, 195, '#102b2f');
    this.rect(758, 276, 615, 4, '#4b7361');
    [775, 885, 995, 1105].forEach(x => this.technicalRack(x, 284, 94, 176));
    this.technicalConsole(1200, 362, 120);
    this.technicalHazard(807, 454, 260);
    this.puddles.forEach(puddle => {
      this.rect(puddle.x, 463, puddle.w, 7, '#397a7b');
      this.rect(puddle.x + 5, 461, puddle.w - 10, 4, '#619a90');
      for (let dx = 14; dx < puddle.w - 30; dx += 49) this.rect(puddle.x + dx, 463, 21, 2, '#a5c5a6');
    });

    // An open shaft, lift and suspended walkways lead across the machinery hall.
    this.rect(1417, 0, 206, 466, '#0b252a');
    this.rect(1432, 0, 8, 466, '#416d5e');
    this.rect(1441, 0, 3, 466, '#72937a');
    this.rect(1597, 0, 8, 466, '#416d5e');
    this.rect(1606, 0, 3, 466, '#72937a');
    this.receptionLine(1471, 0, 1471, 466, '#567f68', 2);
    this.receptionLine(1568, 0, 1568, 466, '#567f68', 2);
    [65, 192, 325, 449].forEach(y => {
      this.rect(1432, y, 173, 7, '#264e48');
      this.rect(1432, y, 173, 2, '#668c72');
    });
    this.technicalMachine(1670, 346, 140, 114);
    this.technicalMachine(1880, 322, 175, 138);
    this.technicalMachine(2120, 350, 145, 110);
    this.technicalMachine(2380, 333, 145, 127);
    this.technicalRack(2570, 333, 90, 127);
    this.technicalRack(2700, 353, 85, 107);
    this.technicalCableBundle(1900, 369, 2200, 2775, 330);
    [1960, 2130, 2300, 2470, 2650].forEach(x => {
      this.rect(x, 79, 62, 89, '#0d292d');
      this.rect(x + 5, 84, 52, 79, '#35594e');
      this.rect(x + 11, 91, 39, 27, '#577a61');
      this.rect(x + 16, 97, 27, 15, '#789574');
      this.rect(x + 13, 130, 12, 4, '#a99b6d');
      this.rect(x + 31, 130, 12, 4, '#7d9c73');
      this.rect(x + 13, 143, 30, 3, '#60836b');
    });

    // A bright, inhabited office is visible beyond the last suspended platform.
    this.receptionRoom(2860, 250, 540, 216);
    this.rect(2875, 265, 510, 173, '#d5c89f');
    this.rect(2875, 383, 510, 55, '#a2b493');
    this.receptionShelf(2900, 312, 91, 143);
    this.receptionNotices(3025, 291);
    this.poster(3265, 273);
    this.receptionLamp(3095, 264);
    this.person(this.goal - 65, 386, '#709198', -1, 0);
    this.receptionDesk(this.goal - 125, 407, 150);
    this.receptionDoor(3300, 466, true);
    this.receptionPlant(3015, 416);
    this.receptionBin(3380, 433);

    this.technicalMap.floors.forEach(floor => this.technicalFoundation(floor));
    this.technicalMap.platforms.forEach(platform => this.technicalPlatform(platform));
    this.technicalMap.platforms.filter(platform => platform.type === 'bridge' || platform.type === 'gallery').forEach(platform => this.technicalRailing(platform.x, platform.y, platform.w));
    this.technicalMap.ladders.forEach(ladder => this.diagnosticLadder(ladder));
    this.technicalPlatform(this.technicalMap.lift);
    const lift = this.technicalMap.lift;
    this.rect(lift.x + 3, lift.y - 49, 4, 49, '#70967a');
    this.rect(lift.x + lift.w - 7, lift.y - 49, 4, 49, '#70967a');
    this.technicalHazard(lift.x + 7, lift.y - 5, lift.w - 14);
    this.technicalGate();
    this.carts.forEach(cart => this.cart(cart));

    const bubbleY = 323 + Math.sin(this.time * 2.7) * 3;
    this.rect(this.goal - 64, bubbleY, 29, 20, '#dfa16c');
    this.rect(this.goal - 61, bubbleY + 19, 6, 5, '#dfa16c');
    [0, 1, 2].forEach(i => this.rect(this.goal - 59 + i * 7, bubbleY + 9, 4, 4, '#365753'));
    this.drawPlayer();
    c.restore();
  }

  technicalPlatform({ x, y, w }) {
    this.rect(x - 2, y, w + 4, 4, '#a9c49c');
    this.rect(x, y + 4, w, 10, '#477b6d');
    this.rect(x + 5, y + 6, w - 10, 2, '#688e73');
    this.rect(x, y + 12, w, 4, '#0e2b2e');
  }

  technicalFoundation({ x, y, w, h }) {
    this.rect(x, y, w, h, '#3d7167');
    this.rect(x, y, w, 5, '#a1bc98');
    this.rect(x, y + 5, w, 4, '#1c4843');
    for (let dx = 0; dx < w; dx += 34) {
      this.rect(x + dx, y + 10, 2, h - 10, '#28574f');
      this.rect(x + dx + 3, y + 10, 1, h - 10, '#608974');
    }
  }

  technicalRailing(x, y, w) {
    this.rect(x, y - 31, w, 3, '#658a70');
    this.rect(x, y - 28, w, 2, '#8daa87');
    for (let dx = 0; dx <= w; dx += 52) this.rect(x + dx, y - 26, 3, 26, '#4e7660');
  }

  technicalLamp(x, y) {
    this.rect(x, y, 115, 6, '#284f48');
    this.rect(x + 8, y + 3, 99, 4, '#c2d2a7');
    const c = this.ctx;
    c.fillStyle = '#b9d5a70c';
    c.beginPath(); c.moveTo(x + 12, y + 7); c.lineTo(x + 103, y + 7); c.lineTo(x + 179, Math.min(466, y + 230)); c.lineTo(x - 60, Math.min(466, y + 230)); c.closePath(); c.fill();
  }

  technicalHazard(x, y, w) {
    this.rect(x, y, w, 7, '#183b39');
    for (let dx = 0; dx < w - 5; dx += 14) {
      this.rect(x + dx, y, 7, 3, '#c0ad6c');
      this.rect(x + dx + 3, y + 3, 7, 4, '#c0ad6c');
    }
  }

  technicalRack(x, y, w, h) {
    this.rect(x, y, w, h, '#0b252a');
    this.rect(x + 4, y + 4, w - 8, h - 8, '#31564f');
    this.rect(x + 9, y + 9, w - 18, h - 18, '#193d3c');
    for (let dy = 15; dy < h - 14; dy += 24) {
      this.rect(x + 14, y + dy, w - 28, 18, '#3f6658');
      this.rect(x + 19, y + dy + 4, w - 46, 2, '#759071');
      this.rect(x + 19, y + dy + 10, w - 46, 2, '#597e65');
      this.rect(x + w - 25, y + dy + 6, 5, 4, Math.sin(this.time * 1.7 + x + dy) > 0 ? '#b2c48b' : '#64876a');
    }
    this.rect(x + 4, y + h - 5, w - 8, 5, '#507460');
  }

  technicalConsole(x, y, w) {
    this.rect(x, y + 44, w, 9, '#728f73');
    this.rect(x + 6, y + 53, 7, 45, '#355b4c');
    this.rect(x + w - 13, y + 53, 7, 45, '#355b4c');
    this.rect(x + 17, y, w - 34, 37, '#0d2b2f');
    this.rect(x + 22, y + 5, w - 44, 26, '#678b74');
    this.rect(x + 28, y + 11, w - 56, 3, '#bacba2');
    this.rect(x + 28, y + 20, w - 68, 3, '#9eb996');
    this.monitorActivity(x + 22, y + 5, w - 44, 26);
    this.rect(x + w / 2 - 4, y + 37, 8, 7, '#4d765f');
  }

  technicalCableBundle(x, y, bendX, endX, endY) {
    const c = this.ctx;
    ['#9d7752', '#547e66', '#b29361', '#769276', '#46746a'].forEach((color, i) => {
      const offset = i * 7;
      c.beginPath(); c.moveTo(x, y + offset); c.lineTo(bendX + offset, y + offset); c.lineTo(bendX + offset, endY + offset); c.lineTo(endX, endY + offset);
      c.strokeStyle = '#0d292c'; c.lineWidth = 6; c.stroke();
      c.strokeStyle = color; c.lineWidth = 2; c.stroke();
    });
  }

  technicalMachine(x, y, w, h) {
    this.rect(x + 5, y + 13, w - 10, h - 13, '#0d292c');
    this.rect(x + 12, y + 6, w - 24, h - 13, '#446d5a');
    this.rect(x + 21, y + 13, w - 42, h - 25, '#2c554c');
    this.rect(x + 27, y + 20, w - 54, h - 39, '#5f8064');
    const c = this.ctx;
    c.beginPath(); c.arc(x + w / 2, y + h / 2, Math.min(w, h) * .23, 0, Math.PI * 2); c.fillStyle = '#1b403c'; c.fill();
    c.beginPath(); c.arc(x + w / 2, y + h / 2, Math.min(w, h) * .14, 0, Math.PI * 2); c.fillStyle = '#769276'; c.fill();
    const angle = this.time * .8 + x * .013;
    const radius = Math.min(w, h) * .11;
    for (let i = 0; i < 4; i++) {
      const blade = angle + i * Math.PI / 2;
      this.pixelLine(x + w / 2 - 1, y + h / 2 - 1, x + w / 2 + Math.cos(blade) * radius - 1, y + h / 2 + Math.sin(blade) * radius - 1, '#3b6353', 3);
    }
    this.rect(x + w / 2 - 2, y + h / 2 - 2, 5, 5, '#91a180');
    this.rect(x, y + h - 7, w, 7, '#4c7360');
    this.rect(x + 8, y - 7, 18, 20, '#527b62');
    this.rect(x + w - 26, y - 7, 18, 20, '#527b62');
  }

  technicalGate() {
    const x = this.gateX;
    this.rect(x - 11, 0, 10, 466, '#315c50');
    this.rect(x + 46, 0, 10, 466, '#315c50');
    this.rect(x - 8, 0, 3, 466, '#75977b');
    this.rect(x + 50, 0, 3, 466, '#75977b');
    if (!this.open) {
      this.rect(x, 0, 46, 540, '#345e53');
      for (let y = 11; y < 540; y += 20) {
        this.rect(x + 3, y, 40, 3, '#698c72');
        this.rect(x + 3, y + 3, 40, 2, '#23493f');
      }
    } else this.rect(x, 0, 46, 20, '#4d7963');
    const button = this.switches[0];
    const color = button.on ? '#afc58a' : '#be8e5d';
    this.receptionLine(button.x, 352, button.x, 194, color, 2);
    this.receptionLine(button.x, 194, x + 22, 194, color, 2);
    this.rect(button.x - 15, 350, 30, 35, '#214e44');
    this.rect(button.x - 11, 354, 22, 27, '#9fb492');
    this.rect(button.x - 6, 360, 12, 13, button.on ? '#a5c68e' : '#d0966d');
    this.rect(x + 13, 202, 20, 8, button.on ? '#a5c68e' : '#d0966d');
  }

  receptionRoom(x, y, w, h, upper = false) {
    const floorY = y + h;
    this.rect(x, y, w, h, '#e9e5c9');
    this.rect(x + 6, y + 6, w - 12, h - 12, '#e4e0c2');
    this.rect(x + 8, floorY - 113, w - 16, 108, '#88b09c');
    this.rect(x + 8, floorY - 116, w - 16, 5, '#416f65');
    this.rect(x + 8, floorY - 109, w - 16, 3, '#c6d2b2');
    for (let dx = 15; dx < w - 8; dx += 38) {
      this.rect(x + dx, floorY - 103, 2, 84, '#6b9885');
      this.rect(x + dx + 2, floorY - 103, 1, 82, '#b6cbb1');
    }
    this.rect(x + 7, floorY - 21, w - 14, 21, '#d7d8b9');
    if (!upper) {
      for (let dx = 0; dx < w; dx += 54) {
        this.rect(x + dx, floorY - 39, 1, 39, '#9bae97');
        this.receptionLine(x + dx, floorY - 39, x + dx - 29, floorY, '#a5b69b');
      }
      this.rect(x, floorY - 22, w, 1, '#abb99c');
    }
    this.rect(x, y, w, 12, '#2b504d');
    this.rect(x + 4, y + 12, w - 8, 3, '#92b39e');
    this.rect(x, y, 14, h, '#2a4b49');
    this.rect(x + w - 14, y, 14, h, '#284c49');
    this.rect(x, floorY - 6, w, 6, '#487b6d');
    this.rect(x + 17, y + 18, w - 34, 2, '#c6caaa');
    for (let dx = 35; dx < w - 25; dx += 97) this.rect(x + dx, y + 27, 1, Math.max(0, h - 155), '#c9cbb020');
  }

  receptionFoundation({ x, y, w, h }) {
    this.rect(x, y, w, h, '#588f80');
    this.rect(x, y, w, 5, '#b7d2b2');
    this.rect(x, y + 5, w, 4, '#315b56');
    for (let dx = 0; dx < w; dx += 34) {
      this.rect(x + dx, y + 10, 2, h - 10, '#376f65');
      this.rect(x + dx + 3, y + 10, 1, h - 10, '#72a08a');
    }
    this.rect(x, y + h - 6, w, 6, '#315e58');
  }

  receptionPlatform(platform, lift = false) {
    const { x, y, w, h, type } = platform;
    if (type === 'medical-block') {
      this.rect(x, y, w, h, '#3e6b64');
      this.rect(x + 2, y + 2, w - 4, 4, '#d2ddbc');
      this.rect(x + 3, y + 7, w - 6, h - 10, '#729e8a');
      this.rect(x + 8, y + 9, w - 16, 2, '#95b69a');
      [12, w - 16].forEach(dx => this.rect(x + dx, y + 16, 4, 4, '#c6d5b3'));
      for (let dx = 60; dx < w - 50; dx += 10) this.rect(x + dx, y + 13, 4, 7, '#49776c');
      return;
    }
    this.rect(x - 2, y, w + 4, 4, '#c5d8b3');
    this.rect(x, y + 4, w, 9, lift ? '#638f83' : '#4b8579');
    this.rect(x, y + 11, w, 3, '#234d4b');
    this.rect(x + 5, y + 5, w - 10, 2, '#8fb69b');
    if (lift) {
      this.rect(x + 7, y - 14, w - 14, 14, '#5c8d7a');
      this.rect(x + 7, y - 14, w - 14, 3, '#d7d4a8');
      this.rect(x + 8, y + 14, 7, 8, '#264d4c');
      this.rect(x + w - 15, y + 14, 7, 8, '#264d4c');
    }
  }

  receptionRailing(x, y, w) {
    this.rect(x, y - 32, w, 3, '#426e64');
    this.rect(x, y - 29, w, 2, '#a5c3a5');
    for (let dx = 0; dx <= w; dx += 48) {
      this.rect(x + dx, y - 29, 3, 29, '#5f8b76');
      this.rect(x + dx + 3, y - 29, 1, 29, '#a4bca0');
    }
  }

  receptionWindow(x, y, w, h) {
    this.rect(x - 5, y - 5, w + 10, h + 12, '#77947d');
    this.rect(x - 2, y - 2, w + 4, h + 6, '#f2eccc');
    this.rect(x + 4, y + 4, w - 8, h - 8, '#d4d9b5');
    this.rect(x + 8, y + 8, w - 16, h - 16, '#f5ebbd');
    this.windowBird(x, y, w, h);
    this.rect(x + Math.floor(w / 2) - 2, y, 5, h, '#c8c9a5');
    this.rect(x, y + Math.floor(h / 2), w, 5, '#c8c9a5');
    this.rect(x - 7, y + h + 3, w + 14, 5, '#b6c4a2');
    this.rect(x + 12, y + 11, 5, h / 2 - 17, '#fff5d6');
    const c = this.ctx;
    c.fillStyle = '#f6edc130';
    c.beginPath(); c.moveTo(x + 3, y + h + 8); c.lineTo(x + w - 3, y + h + 8); c.lineTo(x + w + 40, 460); c.lineTo(x - 25, 460); c.closePath(); c.fill();
  }

  receptionLamp(x, y) {
    this.rect(x + 47, y - 12, 3, 12, '#58766a');
    this.rect(x, y, 100, 8, '#4c736a');
    this.rect(x + 3, y + 3, 94, 5, '#c5d7b5');
    this.rect(x + 8, y + 8, 84, 3, '#f2eccc');
    this.rect(x + 13, y + 11, 74, 2, '#b9cdae');
  }

  receptionLine(x1, y1, x2, y2, color, width = 1) {
    const c = this.ctx;
    c.strokeStyle = color; c.lineWidth = width;
    c.beginPath(); c.moveTo(Math.round(x1) + .5, Math.round(y1) + .5); c.lineTo(Math.round(x2) + .5, Math.round(y2) + .5); c.stroke();
  }

  receptionQueue(x, y) {
    this.rect(x - 4, y - 4, 207, 108, '#638f7f');
    this.rect(x, y, 199, 100, '#173a3b');
    this.rect(x + 10, y + 9, 9, 7, '#e3a373');
    this.rect(x + 25, y + 10, 157, 4, '#688978');
    this.rect(x + 8, y + 24, 183, 1, '#688978');
    [0, 1, 2].forEach(i => {
      const color = i ? '#d3a67d' : '#b8c9a7';
      this.rect(x + 14, y + 36 + i * 19, 8, 8, color);
      this.rect(x + 31, y + 38 + i * 19, 84 - i * 13, 4, '#688978');
      this.rect(x + 145, y + 36 + i * 19, 37, 7, color);
    });
  }

  receptionNotices(x, y) {
    [0, 1, 2].forEach(i => {
      this.rect(x + i * 34, y, 27, 42, '#a6b99e');
      this.rect(x + i * 34 + 2, y + 2, 23, 38, '#e9e4bf');
      this.rect(x + i * 34 + 6, y + 10, 15, 2, '#829c7c');
      this.rect(x + i * 34 + 6, y + 18, 15, 2, '#b2b99a');
      this.rect(x + i * 34 + 6, y + 25, 12, 2, '#b2b99a');
    });
  }

  receptionRadiator(x, y, w) {
    this.rect(x, y + 3, w, 29, '#5c8775');
    for (let dx = 3; dx < w - 3; dx += 9) {
      this.rect(x + dx, y, 7, 30, '#bdcbaa');
      this.rect(x + dx + 1, y + 3, 2, 24, '#d6dbb7');
    }
    this.rect(x - 5, y + 7, 5, 4, '#6b927e');
    this.rect(x + w, y + 20, 6, 4, '#6b927e');
  }

  receptionMedicalCabinet(x, y) {
    this.rect(x, y, 54, 66, '#4b7869');
    this.rect(x + 3, y + 3, 48, 58, '#d4dabc');
    this.rect(x + 7, y + 7, 40, 45, '#b7c9ac');
    this.rect(x + 23, y + 16, 8, 25, '#709a85');
    this.rect(x + 15, y + 24, 24, 8, '#709a85');
    this.rect(x + 43, y + 41, 3, 8, '#557e69');
    this.rect(x + 4, y + 62, 46, 4, '#7a9b80');
  }

  bankATM(x, floorY) {
    const y = floorY - 118;
    const c = this.ctx;
    // A restrained warm glow separates the green-and-yellow kiosk from the ward.
    c.save();
    const glow = c.createRadialGradient(x + 34, y + 56, 18, x + 34, y + 56, 85);
    glow.addColorStop(0, '#f1d76b19'); glow.addColorStop(1, '#f1d76b00');
    c.fillStyle = glow; c.fillRect(x - 51, y - 29, 170, 170);
    c.restore();
    const r = (dx, dy, w, h, color) => this.rect(x + dx, y + dy, w, h, color);

    r(-5, 115, 81, 5, '#183d3530');
    r(5, 0, 59, 118, '#294b33');
    r(0, 6, 68, 107, '#294b33');
    r(3, 7, 62, 104, '#73982e');
    r(7, 3, 54, 111, '#ddc44f');
    r(5, 11, 4, 96, '#a8bd47');
    r(60, 11, 4, 96, '#527628');
    r(9, 5, 49, 3, '#f0dc7a');

    // Bank header, recessed touch screen and the stepped green screen surround.
    r(10, 10, 48, 52, '#557f2a');
    r(13, 11, 5, 5, '#e0ce64');
    r(14, 12, 1, 3, '#73982e');
    r(16, 13, 1, 3, '#73982e');
    this.text('БАНК', x + 29, y + 16, 5.5, '#eedd8a', 'center');
    this.text('ЦЕНТР-ИНВЕСТ', x + 34, y + 24, 5.7, '#f1dc78', 'center');
    r(12, 28, 44, 32, '#234b3d');
    r(14, 30, 40, 28, '#b9d8c0');
    r(16, 32, 36, 5, '#e0e9cf');
    r(18, 33, 3, 3, '#6b9d57');
    r(23, 34, 21, 1, '#92b28e');
    [0, 1, 2].forEach(row => [0, 1].forEach(col => {
      r(17 + col * 18, 40 + row * 5, 15, 3, '#759f74');
      r(19 + col * 18, 41 + row * 5, 9, 1, '#d8e6c7');
    }));
    this.monitorActivity(x + 14, y + 30, 40, 28);

    r(13, 62, 41, 4, '#557f2a');
    r(18, 66, 32, 18, '#608c30');
    r(24, 68, 20, 12, '#335c31');
    r(26, 70, 15, 8, '#c0bf87');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) r(28 + col * 4, 71 + row * 2, 2, 1, '#697b58');
    r(6, 68, 10, 16, '#a89a3d');
    r(8, 70, 7, 5, '#d68c4c');
    r(8, 76, 7, 6, '#a75832');
    r(53, 68, 8, 3, '#365232');

    r(12, 90, 20, 9, '#a8b544');
    r(15, 93, 14, 2, '#53742e');
    r(37, 86, 21, 18, '#669333');
    r(40, 89, 15, 11, '#496b2c');
    r(42, 93, 11, 2, '#203d2c');
    r(43, 91, 8, 1, '#e5bd62');
    r(14, 106, 40, 5, '#e4e3af');
    r(18, 108, 31, 1, '#82945c');
    r(9, 112, 50, 4, '#628b32');
    r(13, 116, 42, 2, '#385e30');
  }

  receptionBin(x, y) {
    this.rect(x, y, 25, 4, '#416f63');
    this.rect(x + 2, y + 4, 21, 27, '#88a98d');
    this.rect(x + 6, y + 7, 3, 21, '#b4c9a8');
    this.rect(x + 4, y + 29, 17, 3, '#537c68');
  }

  receptionDesk(x, y, w) {
    this.rect(x - 4, y, w + 8, 8, '#d4cc9e');
    this.rect(x, y + 8, w, 51, '#b9c9a7');
    this.rect(x + 6, y + 14, w - 12, 37, '#92b597');
    this.rect(x, y + 55, w, 4, '#557f6a');
    this.rect(x + w - 53, y - 29, 42, 28, '#3e635c');
    this.rect(x + w - 50, y - 26, 36, 19, '#8eaf95');
    this.monitorActivity(x + w - 50, y - 26, 36, 19);
    this.rect(x + w - 36, y - 4, 8, 5, '#385d56');
    [10, 21, 32].forEach((dx, i) => this.rect(x + dx, y - 21 + i * 2, 8, 21 - i * 2, ['#a4bca2', '#d2c6a0', '#86a99d'][i]));
  }

  receptionBench(x, y) {
    this.bench(x, y);
    this.person(x + 24, y - 33, '#849b96', 1, 0, false, true);
  }

  receptionWaterCooler(x, y) {
    this.rect(x + 6, y - 14, 20, 25, '#9dbfba');
    this.rect(x + 8, y - 18, 16, 5, '#688f89');
    this.rect(x, y + 11, 32, 70, '#ccd5b8');
    this.rect(x + 5, y + 19, 22, 21, '#648f82');
    this.rect(x + 9, y + 23, 4, 5, '#b9876c');
    this.rect(x + 20, y + 23, 4, 5, '#9dc1bf');
    this.rect(x + 6, y + 51, 20, 23, '#acbfa4');
  }

  receptionBed(x, y) {
    this.rect(x - 3, y + 25, 101, 7, '#42746b');
    this.rect(x, y + 17, 95, 8, '#c4d5b3');
    this.rect(x + 7, y + 13, 31, 7, '#e7e6c5');
    this.rect(x + 7, y + 32, 4, 37, '#6e9b86');
    this.rect(x + 81, y + 32, 4, 37, '#6e9b86');
    this.rect(x + 2, y + 68, 14, 8, '#345d56');
    this.rect(x + 76, y + 68, 14, 8, '#345d56');
    this.rect(x - 6, y + 2, 4, 30, '#6f9a86');
  }

  receptionIV(x, y) {
    this.rect(x + 14, y, 3, 98, '#6d9782');
    this.rect(x + 3, y + 8, 28, 3, '#749e88');
    this.rect(x + 1, y + 10, 12, 26, '#d7dfbd');
    this.rect(x + 4, y + 26, 6, 8, '#99b9a4');
    this.rect(x + 7, y + 36, 1, 37, '#b7cbaa');
    const drop = (this.time + x * .019) % 2.6;
    if (drop < 1.7) this.rect(x + 7, y + 38 + drop / 1.7 * 31, 1, 3, '#749f8d');
    this.rect(x + 4, y + 96, 25, 3, '#547f6e');
  }

  receptionWheelchair(x, y) {
    const c = this.ctx;
    c.strokeStyle = '#587e6c'; c.lineWidth = 3;
    c.beginPath(); c.arc(x + 17, y + 40, 19, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(x + 17, y + 40, 13, 0, Math.PI * 2); c.stroke();
    this.rect(x + 21, y, 4, 35, '#426d61');
    this.rect(x + 24, y + 25, 25, 5, '#84a58b');
    this.receptionLine(x + 41, y + 28, x + 51, y + 52, '#587e6c', 3);
    this.rect(x + 47, y + 50, 10, 7, '#3d685e');
  }

  receptionShelf(x, y, w, h) {
    this.rect(x, y, w, h, '#8c8062');
    this.rect(x + 5, y + 5, w - 10, h - 10, '#5f7058');
    [22, 57, 90].forEach(dy => {
      for (let dx = 10; dx < w - 15; dx += 11) this.rect(x + dx, y + dy - 13, 7, 23, (dx % 3) ? '#a99d7c' : '#8aa992');
      this.rect(x + 4, y + dy + 10, w - 8, 4, '#9e9977');
    });
  }

  receptionPlant(x, y) {
    this.plant(x, y);
    this.rect(x + 13, y + 30, 24, 2, '#9b8a60');
  }

  receptionShaft(x, y, w, h) {
    this.rect(x - 9, y, w + 18, h, '#1c3d3d');
    this.rect(x, y, w, h, '#709e91');
    this.rect(x + 12, y, w - 24, h, '#a1bfa8');
    for (let dx = 17; dx < w - 12; dx += 40) {
      this.rect(x + dx, y, 6, h, '#426f65');
      this.rect(x + dx + 6, y, 2, h, '#c5d4b2');
    }
    this.rect(x + 30, y, 15, h, '#d1ddbb55');
    this.rect(x + 93, y, 22, h, '#d1ddbb44');
    for (let dy = 60; dy < h; dy += 115) this.rect(x, y + dy, w, 5, '#557f71');
    this.receptionLine(x + 5, y + h - 15, x + w - 5, y + 15, '#bcd1ae', 2);
    this.rect(x - 3, y + h - 7, w + 6, 7, '#3f6c62');
  }

  receptionGate() {
    const x = this.gateX;
    this.rect(x - 24, 28, 100, 438, '#234a47');
    this.rect(x - 18, 32, 5, 427, '#82aa94');
    this.rect(x + 61, 32, 5, 427, '#82aa94');
    this.rect(x + 13, 338, 25, 7, this.open ? '#8cbd8a' : '#d48e66');
    if (!this.open) {
      this.rect(x - 5, 359, 65, 107, '#91b5a0');
      this.rect(x, 364, 54, 97, '#c7d5b4');
      this.rect(x + 5, 371, 18, 52, '#325c56');
      this.rect(x + 31, 371, 18, 52, '#325c56');
      this.rect(x + 26, 364, 3, 97, '#557b66');
      this.rect(x + 12, 433, 8, 3, '#d4e1bd');
      this.rect(x + 35, 433, 8, 3, '#d4e1bd');
    } else {
      this.rect(x - 8, 359, 5, 107, '#9bbba2');
      this.rect(x + 59, 359, 5, 107, '#9bbba2');
    }
    this.switches.forEach(item => {
      this.rect(item.x, 326, x - item.x, 2, '#c69f71');
      this.rect(item.x, 326, 2, 28, '#c69f71');
      this.rect(item.x - 13, 352, 27, 31, '#3e6c5f');
      this.rect(item.x - 9, 356, 19, 23, '#c3cfac');
      this.rect(item.x - 5, 360, 11, 12, item.on ? '#8cbd8a' : '#d48e66');
    });
  }

  receptionDoor(x, floorY, target = false) {
    this.rect(x - 6, floorY - 109, 79, 109, '#3e6b61');
    this.rect(x, floorY - 104, 67, 104, target ? '#b2cab0' : '#96b8a1');
    this.rect(x + 5, floorY - 99, 57, 94, '#d4dcba');
    this.rect(x + 10, floorY - 92, 18, 54, '#547e71');
    this.rect(x + 38, floorY - 92, 18, 54, '#547e71');
    this.rect(x + 32, floorY - 103, 3, 98, '#7d9b7b');
    this.rect(x + 19, floorY - 27, 8, 3, '#65866d');
    this.rect(x + 40, floorY - 27, 8, 3, '#65866d');
  }

  window(x, y) {
    this.rect(x - 5, y - 5, 124, 132, '#88a69a');
    this.rect(x, y, 114, 121, '#bad5c6');
    this.rect(x + 6, y + 6, 102, 110, '#c8dec9');
    this.rect(x + 10, y + 70, 26, 46, '#a8c3ae');
    this.rect(x + 32, y + 53, 30, 63, '#aac6b0');
    this.rect(x + 70, y + 72, 30, 44, '#a3bea8');
    this.windowBird(x, y, 114, 121);
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

  drawPlayer() {
    if (this.invulnerable > 0 && Math.floor(this.time * 12) % 2 === 0) return;
    const p = this.player;
    const motion = p.climbing ? p.climbPhase : p.grounded && Math.abs(p.vx) > 0 ? this.time * 13 : 0;
    // Cache the current pixel pose, then draw a one-pixel warm outline behind it.
    if (!this.heroVisual) {
      const sprite = document.createElement('canvas'); sprite.width = 64; sprite.height = 100;
      const silhouette = document.createElement('canvas'); silhouette.width = 64; silhouette.height = 100;
      this.heroVisual = { sprite, silhouette, pose: '' };
    }
    const visual = this.heroVisual;
    const pose = `${p.facing}/${p.climbing}/${Math.round(Math.sin(motion) * 2)}`;
    if (visual.pose !== pose) {
      const spriteContext = visual.sprite.getContext('2d');
      spriteContext.clearRect(0, 0, 64, 100);
      const brush = { rect: (x, y, w, h, color) => { spriteContext.fillStyle = color; spriteContext.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); } };
      this.person.call(brush, 18, 32, '#df9867', p.facing, motion, true, false, '', p.climbing);
      const mask = visual.silhouette.getContext('2d');
      mask.clearRect(0, 0, 64, 100);
      mask.globalCompositeOperation = 'source-over'; mask.fillStyle = '#f4d29c'; mask.fillRect(0, 0, 64, 100);
      mask.globalCompositeOperation = 'destination-in'; mask.drawImage(visual.sprite, 0, 0);
      mask.globalCompositeOperation = 'source-over';
      visual.pose = pose;
    }
    const c = this.ctx;
    const x = Math.round(p.x - 18), y = Math.round(p.y - 32);
    c.save();
    const glow = c.createRadialGradient(p.x + 14, p.y + 12, 8, p.x + 14, p.y + 12, 52);
    glow.addColorStop(0, '#ffcf8a16'); glow.addColorStop(1, '#ffcf8a00');
    c.fillStyle = glow; c.fillRect(p.x - 38, p.y - 40, 104, 104);
    c.globalAlpha = .65;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) c.drawImage(visual.silhouette, x + dx, y + dy);
    c.globalAlpha = 1; c.drawImage(visual.sprite, x, y);
    c.restore();
  }

  person(x, y, shirt, facing = 1, walk = 0, hero = false, seated = false, role = '', climbing = false, scale = 1.5) {
    // One pixel grid and outline palette keep every character in the same style.
    const outline = '#111c25';
    const nurse = role === 'nurse';
    const client = role === 'client';
    const medical = nurse || client || shirt === '#e7e9d2';
    const programmer = !hero && shirt === '#709198';
    const skin = seated && shirt === '#7e9f9b' ? '#dba17c' : '#ffc39b';
    const skinLight = skin === '#dba17c' ? '#ebba91' : '#ffd3ac';
    const skinShade = skin === '#dba17c' ? '#bb7d60' : '#e99a73';
    const hair = programmer ? '#493b36' : seated && shirt === '#7e9f9b' ? '#6e6b63' : '#674236';
    const hairLight = programmer ? '#655047' : seated && shirt === '#7e9f9b' ? '#969084' : '#855847';
    const coat = hero ? scale > 1 ? '#d9632e' : '#c35428' : medical ? nurse ? '#dce2c7' : '#eee7cd' : shirt;
    const coatShade = hero ? scale > 1 ? '#a34727' : '#933e24' : medical ? '#9aaf9d' : programmer ? '#496a71' : '#586e70';
    const coatLight = hero ? scale > 1 ? '#f58a49' : '#df7137' : medical ? '#f6efd8' : programmer ? '#91afb0' : '#b6b9aa';
    const pants = hero ? scale > 1 ? '#645043' : '#584437' : medical ? '#5c7168' : '#465156';
    const pantsShade = hero ? '#3f302b' : '#303d42';
    const stride = walk && !seated ? Math.round(Math.sin(walk) * 2) : 0;
    const armSwing = stride ? Math.sign(stride) : 0;
    // Portraits use a drawing brush without a clock, so they remain static.
    const idle = !hero && !walk && !climbing && Number.isFinite(this.time);
    const idleSeed = x * .13 + y * .07;
    const breath = idle ? Math.sin(this.time * 1.65 + idleSeed) * .45 : 0;
    const handDrift = idle ? Math.sin(this.time * .85 + idleSeed) * .45 : 0;
    const blink = idle && (this.time + idleSeed) % (4.6 + Math.abs(Math.sin(idleSeed)) * 2) < .13;
    // Gameplay uses 1.5x artwork; interface portraits request the original 1x size.
    // Scale around the feet and round every edge to keep the pixel art sharp.
    const footY = seated ? 84 : 54;
    const pixel = (dx, dy, w, h, color) => {
      const left = Math.round(x + 14 + (dx - 14) * scale);
      const top = Math.round(y + footY + (dy - footY) * scale);
      const right = Math.round(x + 14 + (dx + w - 14) * scale);
      const bottom = Math.round(y + footY + (dy + h - footY) * scale);
      this.rect(left, top, right - left, bottom - top, color);
    };
    const r = (dx, dy, w, h, color) => {
      if (idle) {
        if (dy < 34) dy += breath;
        else if (dy >= 36 && (dx < 5 || dx >= 25)) dy += handDrift;
      }
      const left = Math.round(dx * .75);
      const right = Math.round((dx + w) * .75);
      pixel(4 + (facing < 0 && !climbing ? 21 - right : left), (seated ? 24 : 0) + dy, Math.max(1, right - left), h, color);
    };
    if (!climbing) pixel(1, seated ? 82 : 53, 28, 3, '#102d3026');

    if (climbing) {
      const reach = Math.round(Math.sin(walk) * 2);
      const leftLift = Math.max(0, reach);
      const rightLift = Math.max(0, -reach);

      // Bent legs and raised hands alternate as the player moves along the rungs.
      r(6, 35, 21, 6, outline);
      r(8, 36, 17, 4, pants);
      r(5 - leftLift, 39 - leftLift, 10, 12, outline);
      r(7 - leftLift, 39 - leftLift, 6, 10, pants);
      r(8 - leftLift, 43 - leftLift, 3, 6, pantsShade);
      r(18 + rightLift, 39 - rightLift, 10, 12, outline);
      r(20 + rightLift, 39 - rightLift, 6, 10, pants);
      r(23 + rightLift, 43 - rightLift, 2, 6, pantsShade);
      r(4 - leftLift, 49 - leftLift, 12, 5, outline);
      r(6 - leftLift, 50 - leftLift, 8, 2, '#765440');
      r(18 + rightLift, 49 - rightLift, 12, 5, outline);
      r(20 + rightLift, 50 - rightLift, 8, 2, '#765440');

      r(2, 16 + reach, 7, 15, outline);
      r(4, 18 + reach, 4, 11, coatLight);
      r(2, 12 + reach, 6, 7, outline);
      r(3, 13 + reach, 4, 5, skin);
      r(3, 13 + reach, 3, 2, skinLight);
      r(24, 16 - reach, 7, 15, outline);
      r(25, 18 - reach, 4, 11, coatShade);
      r(25, 12 - reach, 6, 7, outline);
      r(26, 13 - reach, 4, 5, skin);
      r(27, 14 - reach, 2, 3, skinShade);

      // Jacket seams and a full head of hair make the back view unambiguous.
      r(7, 18, 18, 5, outline);
      r(5, 22, 23, 15, outline);
      r(7, 22, 19, 13, coat);
      r(8, 23, 3, 10, coatLight);
      r(23, 24, 2, 10, coatShade);
      r(7, 33, 19, 2, coatShade);
      r(11, 26, 11, 1, coatShade);
      r(16, 29, 1, 4, coatLight);
      r(11, 19, 11, 3, '#f3e6bd');
      r(7, 1, 18, 2, outline);
      r(5, 3, 23, 5, outline);
      r(4, 7, 25, 8, outline);
      r(6, 14, 21, 4, outline);
      r(10, 17, 13, 3, outline);
      r(8, 2, 16, 2, hairLight);
      r(6, 4, 21, 9, hair);
      r(5, 8, 3, 6, hairLight);
      r(8, 13, 17, 3, hair);
      r(11, 16, 11, 2, hair);
      r(14, 18, 7, 1, skinShade);
      return;
    }

    // Dark edged trousers, bent knees for sitting, and alternating walking feet.
    if (seated) {
      r(5, 34, 23, 8, outline);
      r(7, 35, 19, 5, pants);
      r(9, 40, 9, 14, outline);
      r(10, 41, 6, 12, pantsShade);
      r(8, 53, 12, 5, outline);
      r(10, 54, 8, 2, '#665044');
      r(17, 39, 11, 8, outline);
      r(18, 40, 8, 5, pants);
      r(21, 44, 7, 13, outline);
      r(22, 45, 4, 11, pants);
      r(21, 56, 12, 4, outline);
      r(23, 57, 8, 2, '#765c49');
    } else {
      const leftLift = Math.max(0, stride);
      const rightLift = Math.max(0, -stride);
      r(5, 34, 22, 6, outline);
      r(7, 36, 18, 4, pants);
      r(6 + stride, 39, 9, 13 - leftLift, outline);
      r(8 + stride, 39, 6, 12 - leftLift, pants);
      r(8 + stride, 44, 2, 6 - leftLift, pantsShade);
      r(17 - stride, 39, 10, 13 - rightLift, outline);
      r(19 - stride, 39, 6, 12 - rightLift, pants);
      r(23 - stride, 44, 2, 6 - rightLift, pantsShade);
      r(5 + stride, 50 - leftLift, 11, 4, outline);
      r(7 + stride, 51 - leftLift, 7, 2, '#765440');
      r(18 - stride, 50 - rightLift, 12, 4, outline);
      r(20 - stride, 51 - rightLift, 8, 2, '#765440');
    }

    // Sleeves and hands sit behind the jacket, with a small opposite arm swing.
    r(2, 23 + armSwing, 6, 15, outline);
    r(0, 28 + armSwing, 7, 13, outline);
    r(2, 26 + armSwing, 4, 12, coatShade);
    r(1, 36 + armSwing, 6, 8, outline);
    r(2, 38 + armSwing, 4, 5, skin);
    r(2, 38 + armSwing, 3, 2, skinLight);
    r(24, 23 - armSwing, 6, 17, outline);
    r(25, 26 - armSwing, 4, 12, coat);
    r(25, 37 - armSwing, 6, 7, outline);
    r(26, 38 - armSwing, 3, 5, skin);
    r(27, 40 - armSwing, 2, 2, skinShade);
    r(7, 18, 16, 3, outline);
    r(4, 21, 23, 5, outline);
    r(5, 25, 22, 12, outline);
    r(8, 20, 14, 3, coat);
    r(6, 23, 19, 12, coat);
    r(7, 24, 3, 10, coatLight);
    r(6, 33, 19, 2, coatShade);
    r(18, 26, 2, 9, coatShade);
    r(9, 30, 2, 3, coatShade);
    r(11, 29, 2, 2, coatShade);
    r(22, 30, 2, 3, coatShade);

    // Stepped cream lapels reproduce the reference hero's shirt and orange V.
    if (hero || client || medical) {
      r(10, 19, 4, 3, '#f3e6bd');
      r(12, 21, 5, 3, '#f3e6bd');
      r(14, 24, 4, 3, '#e1d3ad');
      r(19, 20, 4, 3, '#f3e6bd');
      r(18, 23, 4, 3, '#f3e6bd');
      r(17, 26, 3, 4, '#f3e6bd');
      r(16, 24, 2, 3, outline);
      if (medical) {
        r(18, 29, 1, 6, '#839c8e');
        r(21, 24, 3, 4, '#709b8b');
        r(21, 25, 3, 1, '#e8e8ce');
      }
    } else {
      r(13, 19, 7, 5, '#d7d5bd');
      r(15, 20, 3, 3, '#a5b6a8');
      r(19, 26, 5, 2, coatShade);
    }

    // Three quarter face, two vertical eyes, chestnut fringe and hard pixel edges.
    r(7, 1, 18, 2, outline);
    r(5, 3, 23, 5, outline);
    r(4, 7, 25, 7, outline);
    r(6, 13, 22, 3, outline);
    r(9, 16, 17, 2, outline);
    r(13, 17, 11, 3, outline);
    r(10, 6, 17, 7, skin);
    r(8, 12, 19, 3, skin);
    r(11, 15, 14, 2, skin);
    r(14, 17, 9, 2, skinShade);
    r(15, 17, 7, 2, skin);
    r(8, 10, 4, 4, skinLight);
    r(11, 7, 15, 2, skinLight);
    r(9, 14, 3, 2, skinShade);
    r(23, 12, 2, 1, '#f39e75');
    r(8, 0, 17, 1, outline);
    r(6, 1, 21, 3, outline);
    r(4, 4, 24, 3, outline);
    r(3, 7, 7, 7, outline);
    r(5, 13, 3, 3, outline);
    r(8, 1, 17, 1, hairLight);
    r(6, 2, 21, 3, hair);
    r(5, 5, 22, 1, hair);
    r(4, 6, 6, 7, hair);
    r(6, 7, 5, 4, hair);
    r(9, 6, 3, 2, hair);
    r(10, 8, 2, 2, outline);
    r(5, 11, 2, 3, hairLight);
    r(14, 9, 3, 1, hair);
    r(23, 9, 3, 1, hair);
    r(14, blink ? 11 : 10, 2, blink ? 1 : 3, outline);
    r(23, blink ? 11 : 10, 2, blink ? 1 : 3, outline);
    if (client) {
      r(1, 7, 4, 7, outline);
      r(2, 8, 3, 5, hair);
      r(5, 3, 3, 3, hairLight);
    }
    if (nurse) {
      r(7, 0, 17, 4, outline);
      r(8, 0, 15, 3, '#f4ecd1');
      r(14, 0, 3, 3, '#749b87');
      r(13, 1, 5, 1, '#749b87');
    }
    if (programmer) {
      r(12, 9, 7, 5, outline);
      r(21, 9, 7, 5, outline);
      r(13, 10, 5, 3, '#b5c9b6');
      r(22, 10, 5, 3, '#b5c9b6');
      r(18, 10, 3, 1, outline);
      r(15, blink ? 11 : 10, 1, blink ? 1 : 3, outline);
      r(24, blink ? 11 : 10, 1, blink ? 1 : 3, outline);
    }
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
    const sway = Math.sin(this.time * .85 + x * .031) * 1.6 + Math.sin(this.time * 1.4 + x * .013) * .4;
    this.rect(x + 11, y + 18, 28, 31, '#b18c68');
    this.rect(x + 7, y + 13, 36, 8, '#c7a27a');
    for (let i = 0; i < 4; i++) this.rect(x + 23 + sway * (1 - i / 4), y - 25 + i * 10, 5, 11, '#678565');
    [[3, -20, 22, 10], [23, -34, 20, 12], [8, -42, 17, 13], [26, -13, 22, 11], [1, -4, 24, 10]].forEach(([dx, dy, w, h]) => this.rect(x + dx + sway * (.45 - dy / 60), y + dy, w, h, '#789e74'));
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
    if (this.level < 2) {
      this.rect(x + 9, y + 12, 10, 3, '#7b744c');
      this.rect(x + 12, y + 9, 3, 12, '#7b744c');
    } else this.text('!', x + 14, y + 19, 13, '#7b744c', 'center');
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
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      this.rect(x + Math.sin(angle) * 15, y - Math.cos(angle) * 15, 1, 1, '#8d9e88');
    }
    const seconds = Math.floor(this.time);
    const hand = (angle, length, color, width) => this.pixelLine(x, y, x + Math.sin(angle) * length, y - Math.cos(angle) * length, color, width);
    hand(Math.PI / 2 + this.time / 43200 * Math.PI * 2, 9, '#668376', 2);
    hand(this.time / 3600 * Math.PI * 2, 12, '#668376', 1);
    hand(seconds / 60 * Math.PI * 2, 14, '#b18260', 1);
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
