/*
 * Конструктор запроса на расчёт окна и балкона.
 * Схема рисуется как эскиз замерщика: размеры в миллиметрах и условные
 * обозначения открывания (вершина треугольника смотрит на петли).
 * Цен на сайте нет: параметры уходят заказчику, он присылает расчёт.
 */
(() => {
  const root = document.getElementById('calc');
  if (!root) return;

  const svg = document.getElementById('calc-svg');
  const sashBox = document.getElementById('calc-sashes');
  const hint = document.getElementById('calc-hint');
  const summaryEl = document.getElementById('calc-summary');
  const form = document.getElementById('calc-form');
  const NS = 'http://www.w3.org/2000/svg';
  const SIDE_DEPTH = 0.8; // глубина боковой стороны балкона на схеме, м

  const TYPES = {
    single:  { name: 'Одностворчатое окно', w: [500, 1000, 700],   h: [600, 1600, 1200], sashes: ['tilt'] },
    double:  { name: 'Двустворчатое окно',  w: [900, 1800, 1300],  h: [600, 1800, 1400], sashes: ['fixed', 'tilt'] },
    triple:  { name: 'Трёхстворчатое окно', w: [1500, 2700, 2000], h: [600, 1800, 1400], sashes: ['fixed', 'tilt', 'fixed'] },
    balcony: { name: 'Балконный блок',      w: [1500, 2400, 2000], h: [1900, 2300, 2150], sashes: ['tilt', 'fixed'], door: true },
  };
  const SASH_NAMES = { fixed: 'глухая', turn: 'поворотная', tilt: 'поворотно-откидная' };
  const CYCLE = { fixed: 'turn', turn: 'tilt', tilt: 'fixed' };
  const DOOR_CYCLE = { turn: 'tilt', tilt: 'turn' };
  const EXTRA_NAMES = {
    sill: 'подоконник', ebb: 'отлив', slopes: 'откосы', net: 'москитная сетка',
    insulation: 'утепление пола и стен', finish: 'отделка под ключ', roof: 'крыша',
  };
  const SHAPE_NAMES = { straight: 'прямой', corner: 'Г-образный', u: 'П-образный' };

  const state = {
    mode: 'window',
    type: 'double',
    w: 1300,
    h: 1400,
    sashes: ['fixed', 'tilt'],
    glass: 2,
    wextras: new Set(['sill']),
    shape: 'straight',
    len: 3,
    glazing: 'warm',
    bextras: new Set(),
  };

  let animateSash = -1;

  /* ---------- helpers ---------- */
  const el = (tag, attrs = {}, parent) => {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  };
  const setFill = (input) => {
    const p = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--fill', p + '%');
  };

  function doorWidth() {
    return Math.round(Math.min(900, Math.max(700, state.w * 0.38)) / 10) * 10;
  }

  const len = () => state.len.toFixed(1).replace('.', ',');

  /* ---------- описание запроса ---------- */
  function describe() {
    if (state.mode === 'window') {
      const t = TYPES[state.type];
      const details = [
        state.sashes.map((k) => SASH_NAMES[k]).join(' + '),
        state.glass === 2 ? 'двухкамерный стеклопакет' : 'однокамерный стеклопакет',
        ...[...state.wextras].map((k) => EXTRA_NAMES[k]),
      ];
      return { title: `${t.name}, ${state.w} × ${state.h} мм`, details };
    }
    const details = [
      state.glazing === 'warm' ? 'тёплое остекление, ПВХ' : 'холодное остекление, алюминий',
      ...[...state.bextras].map((k) => EXTRA_NAMES[k]),
    ];
    return { title: `Балкон ${SHAPE_NAMES[state.shape]}, ${len()} м по фасаду`, details };
  }

  function updateSummary() {
    const d = describe();
    summaryEl.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = d.title;
    const span = document.createElement('span');
    const text = d.details.join(', ');
    span.textContent = text.charAt(0).toUpperCase() + text.slice(1);
    summaryEl.append(b, span);
  }

  /* ---------- схема окна ---------- */
  function drawDim(g, x1, y1, x2, y2, label, vertical) {
    const t = 7;
    el('line', { x1, y1, x2, y2, class: 's-dim' }, g);
    if (vertical) {
      el('line', { x1: x1 - t, y1, x2: x1 + t, y2: y1, class: 's-dim' }, g);
      el('line', { x1: x2 - t, y1: y2, x2: x2 + t, y2, class: 's-dim' }, g);
      const cx = x1 - 12, cy = (y1 + y2) / 2;
      const txt = el('text', { x: cx, y: cy, class: 's-dim-text', 'text-anchor': 'middle', transform: `rotate(-90 ${cx} ${cy})` }, g);
      txt.textContent = label;
    } else {
      el('line', { x1, y1: y1 - t, x2: x1, y2: y1 + t, class: 's-dim' }, g);
      el('line', { x1: x2, y1: y2 - t, x2, y2: y2 + t, class: 's-dim' }, g);
      const txt = el('text', { x: (x1 + x2) / 2, y: y1 + 24, class: 's-dim-text', 'text-anchor': 'middle' }, g);
      txt.textContent = label;
    }
  }

  function drawSash(g, i, kind, x, y, w, h, s, hinge) {
    const grp = el('g', { class: 's-sash', 'data-i': i }, g);
    if (kind === 'fixed') {
      const inset = 30 * s;
      el('rect', { x: x + inset, y: y + inset, width: w - inset * 2, height: h - inset * 2, class: 's-glass' }, grp);
      return grp;
    }
    const prof = 62 * s;
    el('rect', { x: x + 2, y: y + 2, width: w - 4, height: h - 4, rx: 1.5, class: 's-sash-rect' }, grp);
    const gx = x + prof, gy = y + prof, gw = w - prof * 2, gh = h - prof * 2;
    el('rect', { x: gx, y: gy, width: gw, height: gh, class: 's-glass' }, grp);

    // поворот: линии от угла со стороны ручки к середине стороны петель
    const hx = hinge === 'right' ? gx + gw : gx;
    const fx = hinge === 'right' ? gx : gx + gw;
    const turn = el('path', { d: `M${fx} ${gy} L${hx} ${gy + gh / 2} L${fx} ${gy + gh}`, class: 's-open', 'data-i': i }, grp);
    turn.dataset.draw = '1';
    if (kind === 'tilt') {
      el('path', { d: `M${gx} ${gy} L${gx + gw / 2} ${gy + gh} L${gx + gw} ${gy}`, class: 's-open s-open--tilt', 'data-i': i }, grp);
    }
    // ручка
    const hw = 5, hh = Math.max(16, 120 * s);
    const handleX = hinge === 'right' ? x + prof / 2 - hw / 2 : x + w - prof / 2 - hw / 2;
    el('rect', { x: handleX, y: y + h / 2 - hh / 2, width: hw, height: hh, rx: 2.5, class: 's-handle' }, grp);
    return grp;
  }

  function drawWindow() {
    const t = TYPES[state.type];
    svg.innerHTML = '';
    const VW = 640, VH = 520, padL = 70, padB = 64, padT = 18, padR = 24;
    const availW = VW - padL - padR, availH = VH - padT - padB;
    const s = Math.min(availW / state.w, availH / state.h);
    const W = state.w * s, H = state.h * s;
    const x0 = padL + (availW - W) / 2, y0 = padT + (availH - H) / 2;
    const g = el('g', {}, svg);
    const frame = 62 * s;

    if (t.door) {
      const dw = doorWidth() * s;
      const wh = (state.h - 750) * s;
      // дверь
      el('rect', { x: x0, y: y0, width: dw, height: H, class: 's-frame' }, g);
      drawSash(g, 0, state.sashes[0], x0 + frame, y0 + frame, dw - frame * 2, H - frame * 2, s, 'left');
      // окно
      const wx = x0 + dw, ww = W - dw;
      el('rect', { x: wx, y: y0, width: ww, height: wh, class: 's-frame' }, g);
      drawSash(g, 1, state.sashes[1], wx + frame, y0 + frame, ww - frame * 2, wh - frame * 2, s, 'right');
      const lbl = el('text', { x: wx + ww / 2, y: y0 + wh + 26, class: 's-label', 'text-anchor': 'middle' }, g);
      lbl.textContent = `окно ${state.h - 750} мм`;
    } else {
      el('rect', { x: x0, y: y0, width: W, height: H, rx: 2, class: 's-frame' }, g);
      el('rect', { x: x0 + frame, y: y0 + frame, width: W - frame * 2, height: H - frame * 2, class: 's-inner' }, g);
      const n = t.sashes.length;
      const cellW = (W - frame * 2) / n;
      for (let i = 0; i < n; i++) {
        const hinge = n > 1 && i === n - 1 ? 'right' : 'left';
        drawSash(g, i, state.sashes[i], x0 + frame + cellW * i, y0 + frame, cellW, H - frame * 2, s, hinge);
        if (i > 0) {
          const mx = x0 + frame + cellW * i;
          el('line', { x1: mx, y1: y0 + frame, x2: mx, y2: y0 + H - frame, class: 's-inner' }, g);
        }
      }
    }

    drawDim(g, x0, y0 + H + 22, x0 + W, y0 + H + 22, `${state.w}`, false);
    drawDim(g, x0 - 22, y0, x0 - 22, y0 + H, `${state.h}`, true);

    svg.setAttribute('aria-label', `${t.name}, ${state.w} на ${state.h} мм. Створки: ${state.sashes.map((k) => SASH_NAMES[k]).join(', ')}`);
    svg.querySelectorAll('.s-sash').forEach((grp) => {
      grp.addEventListener('click', () => cycleSash(+grp.dataset.i));
    });

    if (animateSash >= 0 && window.gsap) {
      svg.querySelectorAll(`.s-open[data-i="${animateSash}"]`).forEach((p) => {
        if (p.dataset.draw) {
          const len = p.getTotalLength();
          gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.7, ease: 'power2.out', clearProps: 'strokeDasharray,strokeDashoffset' });
        } else {
          gsap.from(p, { opacity: 0, duration: 0.6, delay: 0.3 });
        }
      });
      animateSash = -1;
    }
  }

  function renderSashButtons() {
    const t = TYPES[state.type];
    sashBox.innerHTML = '';
    state.sashes.forEach((kind, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sash-btn';
      const title = t.door ? (i === 0 ? 'Дверь' : 'Окно') : `Створка ${i + 1}`;
      b.innerHTML = `${title}: <b>${SASH_NAMES[kind]}</b><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/></svg>`;
      b.setAttribute('aria-label', `${title}: ${SASH_NAMES[kind]}. Нажмите, чтобы сменить тип открывания`);
      b.addEventListener('click', () => cycleSash(i));
      sashBox.appendChild(b);
    });
  }

  function cycleSash(i) {
    const t = TYPES[state.type];
    const cur = state.sashes[i];
    state.sashes[i] = t.door && i === 0 ? DOOR_CYCLE[cur] : CYCLE[cur];
    animateSash = i;
    drawWindow();
    renderSashButtons();
    const btn = sashBox.children[i];
    if (btn && document.activeElement && document.activeElement.classList.contains('sash-btn')) btn.focus();
    updateSummary();
  }

  /* ---------- схема балкона ---------- */
  function drawBalcony() {
    svg.innerHTML = '';
    const VW = 640, VH = 520;
    const sides = { straight: 0, corner: 1, u: 2 }[state.shape];
    const glazH = 1.5, parH = 1.0, depth = SIDE_DEPTH;
    const k = 0.55; // глубина в косоугольной проекции
    const projW = state.len + (sides ? depth * k : 0) * (sides === 2 ? 2 : 1);
    const s = Math.min(500 / projW, 360 / (glazH + parH + depth * k * 0.6));
    const L = state.len * s, GH = glazH * s, PH = parH * s;
    const dx = depth * k * s, dy = depth * k * 0.6 * s;
    const totalW = L + (sides ? dx : 0) * (sides === 2 ? 2 : 1);
    const leftExtra = sides ? dx : 0;
    const x0 = (VW - totalW) / 2 + leftExtra;
    const y0 = 36 + dy + (VH - 36 - dy - GH - PH - 70) / 2;
    const g = el('g', {}, svg);


    const section = (gx, gy, gw, gh, idx) => {
      el('rect', { x: gx, y: gy, width: gw, height: gh, class: 's-glazing' }, g);
      const inset = 7;
      if (state.glazing === 'cold') {
        if (idx % 2 === 0) {
          const cy = gy + gh / 2;
          el('path', { d: `M${gx + gw * 0.3} ${cy} H${gx + gw * 0.7} M${gx + gw * 0.62} ${cy - 5} L${gx + gw * 0.7} ${cy} L${gx + gw * 0.62} ${cy + 5}`, class: 's-slide' }, g);
        }
      } else if (idx % 2 === 1) {
        el('path', { d: `M${gx + inset} ${gy + inset} L${gx + gw - inset} ${gy + gh / 2} L${gx + inset} ${gy + gh - inset}`, class: 's-open' }, g);
        el('path', { d: `M${gx + inset} ${gy + inset} L${gx + gw / 2} ${gy + gh - inset} L${gx + gw - inset} ${gy + inset}`, class: 's-open s-open--tilt' }, g);
      }
    };

    // боковые стороны в проекции
    const sidePoly = (fx, dir) => {
      const bx = fx + dir * -dx;
      el('polygon', { points: `${fx},${y0} ${bx},${y0 - dy} ${bx},${y0 + GH - dy} ${fx},${y0 + GH}`, class: 's-side' }, g);
      el('polygon', { points: `${fx},${y0 + GH} ${bx},${y0 + GH - dy} ${bx},${y0 + GH + PH - dy} ${fx},${y0 + GH + PH}`, class: 's-wall' }, g);
    };
    if (sides >= 1) sidePoly(x0, 1);
    if (sides === 2) sidePoly(x0 + L, -1);

    // крыша
    if (state.bextras.has('roof')) {
      el('polygon', { points: `${x0 - (sides ? dx : 0) - 6},${y0 - dy - 4} ${x0 + L + (sides === 2 ? dx : 0) + 6},${y0 - dy - 4} ${x0 + L + 10},${y0 - 2} ${x0 - 10},${y0 - 2}`, fill: '#cfd3da', stroke: '#1d1d1f', 'stroke-width': 1.2 }, g);
    }

    // фасадное остекление
    const n = Math.max(2, Math.round(state.len / 0.75));
    const sw = L / n;
    for (let i = 0; i < n; i++) section(x0 + sw * i, y0, sw, GH, i);
    // ограждение
    el('rect', { x: x0, y: y0 + GH, width: L, height: PH, class: 's-wall' }, g);
    el('line', { x1: x0, y1: y0 + GH, x2: x0 + L, y2: y0 + GH, stroke: '#1d1d1f', 'stroke-width': 1.6 }, g);

    drawDim(g, x0, y0 + GH + PH + 22, x0 + L, y0 + GH + PH + 22, `${len()} м`, false);

    svg.setAttribute('aria-label', `Балкон ${SHAPE_NAMES[state.shape]}, ${len()} м по фасаду, ${state.glazing === 'warm' ? 'тёплое' : 'холодное'} остекление`);
  }

  /* ---------- общий рендер ---------- */
  function render(withTransition) {
    const isWin = state.mode === 'window';
    root.querySelectorAll('.calc__group').forEach((gr) => { gr.hidden = gr.dataset.for !== state.mode; });
    hint.hidden = !isWin;
    sashBox.hidden = !isWin;
    if (isWin) { drawWindow(); renderSashButtons(); } else { drawBalcony(); }
    if (withTransition && window.gsap && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.fromTo(svg, { opacity: 0, scale: 0.96, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.7, ease: 'expo.out' });
    }
    updateSummary();
  }

  /* ---------- управление ---------- */
  const wInput = document.getElementById('w-width');
  const hInput = document.getElementById('w-height');
  const wOut = document.getElementById('w-width-out');
  const hOut = document.getElementById('w-height-out');
  const hLabel = document.getElementById('w-height-label');
  const lInput = document.getElementById('b-length');
  const lOut = document.getElementById('b-length-out');

  function applyType(type) {
    const t = TYPES[type];
    state.type = type;
    state.sashes = t.sashes.slice();
    [wInput.min, wInput.max, wInput.value] = t.w;
    [hInput.min, hInput.max, hInput.value] = t.h;
    state.w = t.w[2];
    state.h = t.h[2];
    wOut.textContent = `${state.w} мм`;
    hOut.textContent = `${state.h} мм`;
    hLabel.textContent = t.door ? 'Высота двери' : 'Высота';
    setFill(wInput); setFill(hInput);
  }

  root.querySelectorAll('.segmented button').forEach((b) => {
    b.addEventListener('click', () => {
      if (state.mode === b.dataset.mode) return;
      state.mode = b.dataset.mode;
      root.querySelector('.segmented').dataset.mode = state.mode;
      root.querySelectorAll('.segmented button').forEach((x) => {
        const on = x === b;
        x.classList.toggle('is-active', on);
        x.setAttribute('aria-selected', on);
      });
      render(true);
      if (window.ScrollTrigger) ScrollTrigger.refresh();
    });
  });

  form.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'wtype') { applyType(t.value); render(true); return; }
    if (t.name === 'glass') state.glass = +t.value;
    if (t.name === 'wextra') t.checked ? state.wextras.add(t.value) : state.wextras.delete(t.value);
    if (t.name === 'bshape') { state.shape = t.value; render(true); return; }
    if (t.name === 'bglazing') state.glazing = t.value;
    if (t.name === 'bextra') t.checked ? state.bextras.add(t.value) : state.bextras.delete(t.value);
    render(false);
  });

  wInput.addEventListener('input', () => { state.w = +wInput.value; wOut.textContent = `${state.w} мм`; setFill(wInput); render(false); });
  hInput.addEventListener('input', () => { state.h = +hInput.value; hOut.textContent = `${state.h} мм`; setFill(hInput); render(false); });
  lInput.addEventListener('input', () => { state.len = +lInput.value; lOut.textContent = `${len()} м`; setFill(lInput); render(false); });

  /* ---------- отправка ---------- */
  function requestText() {
    const lines = ['Здравствуйте. Посчитайте, пожалуйста, стоимость:'];
    if (state.mode === 'window') {
      const t = TYPES[state.type];
      lines.push(`${t.name}, ${state.w} × ${state.h} мм`);
      lines.push(`Створки: ${state.sashes.map((k) => SASH_NAMES[k]).join(', ')}`);
      lines.push(`Стеклопакет: ${state.glass === 2 ? 'двухкамерный' : 'однокамерный'}`);
      if (state.wextras.size) lines.push(`Дополнительно: ${[...state.wextras].map((k) => EXTRA_NAMES[k]).join(', ')}`);
    } else {
      lines.push(`Балкон ${SHAPE_NAMES[state.shape]}, ${len()} м по фасаду`);
      lines.push(`Остекление: ${state.glazing === 'warm' ? 'тёплое, ПВХ' : 'холодное, алюминий'}`);
      if (state.bextras.size) lines.push(`Дополнительно: ${[...state.bextras].map((k) => EXTRA_NAMES[k]).join(', ')}`);
    }
    lines.push('Интересует и бесплатный замер.');
    return lines.join('\n');
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = requestText();
    const channel = e.submitter && e.submitter.dataset.channel;
    if (window.sendLead) {
      window.sendLead({ source: 'calculator', calc: text, text, subject: 'Расчёт стоимости с сайта' }, form, channel);
    }
  });

  /* ---------- старт ---------- */
  [wInput, hInput, lInput].forEach(setFill);
  render(false);
})();
