(() => {
  const cfg = window.SITE_CONFIG;
  const docEl = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduce;
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];

  if (!motion) docEl.classList.remove('motion');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  /* ======================================================================
     Заявки: на свой обработчик, если он указан, иначе в WhatsApp
     ====================================================================== */
  window.sendLead = (data, formEl) => {
    if (!cfg.formEndpoint) {
      window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(data.text)}`, '_blank', 'noopener');
      return;
    }
    const btn = formEl && formEl.querySelector('[type="submit"]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Отправляем…'; }
    fetch(cfg.formEndpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...data, page: location.href, date: new Date().toISOString() }),
    })
      .then(() => {
        const done = formEl && formEl.querySelector('.form__done');
        if (done) done.hidden = false;
        if (btn) btn.textContent = 'Отправлено';
      })
      .catch(() => {
        // обработчик недоступен: не теряем заявку, открываем WhatsApp
        window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(data.text)}`, '_blank', 'noopener');
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
      });
  };

  if (cfg.formEndpoint) qa('.calc__note, .form__note').forEach((n) => { n.hidden = true; });

  /* ---------- форма замера ---------- */
  const leadForm = q('#lead-form');
  const phoneInput = q('#lead-phone');
  const phoneError = q('#lead-phone-error');

  const digitsOf = (v) => {
    let d = v.replace(/\D/g, '');
    if (d.startsWith('8') || d.startsWith('7')) d = d.slice(1);
    return d.slice(0, 10);
  };
  const formatPhone = (d) => {
    if (!d) return '';
    let out = '+7 (' + d.slice(0, 3);
    if (d.length >= 3) out += ') ' + d.slice(3, 6);
    if (d.length >= 6) out += '-' + d.slice(6, 8);
    if (d.length >= 8) out += '-' + d.slice(8, 10);
    return out;
  };

  if (phoneInput) {
    phoneInput.addEventListener('input', () => {
      phoneInput.value = formatPhone(digitsOf(phoneInput.value));
      if (phoneInput.getAttribute('aria-invalid') === 'true' && digitsOf(phoneInput.value).length === 10) {
        phoneInput.removeAttribute('aria-invalid');
        phoneError.hidden = true;
      }
    });
  }

  if (leadForm) {
    leadForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(leadForm);
      const phoneDigits = digitsOf(fd.get('phone') || '');
      const phoneNeeded = !!cfg.formEndpoint || phoneDigits.length > 0;
      if (phoneNeeded && phoneDigits.length !== 10) {
        phoneInput.setAttribute('aria-invalid', 'true');
        phoneInput.setAttribute('aria-describedby', 'lead-phone-error');
        phoneError.hidden = false;
        phoneInput.focus();
        return;
      }
      const name = (fd.get('name') || '').trim();
      const topics = fd.getAll('topic');
      const comment = (fd.get('comment') || '').trim();
      const lines = [`Здравствуйте${name ? ', меня зовут ' + name : ''}. Хочу записаться на бесплатный замер.`];
      if (topics.length) lines.push(`Что нужно: ${topics.join(', ').toLowerCase()}`);
      if (phoneDigits) lines.push(`Телефон: ${formatPhone(phoneDigits)}`);
      if (comment) lines.push(`Комментарий: ${comment}`);
      window.sendLead({
        source: 'zamer', name, phone: phoneDigits ? '+7' + phoneDigits : '', topic: topics.join(', '), comment, text: lines.join('\n'),
      }, leadForm);
    });
  }

  /* ======================================================================
     Навигация, меню
     ====================================================================== */
  const nav = q('#nav');
  const burger = q('.nav__burger');
  const menu = q('#menu');
  let lenis = null;

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function setMenu(open) {
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    if (open) {
      menu.hidden = false;
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      if (motion) {
        gsap.fromTo(menu, { opacity: 0 }, { opacity: 1, duration: 0.3 });
        gsap.fromTo(qa('.menu__links a, .menu__foot > *', menu), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, stagger: 0.04, ease: 'expo.out' });
      }
    } else {
      menu.hidden = true;
      document.body.style.overflow = '';
      if (lenis) lenis.start();
    }
  }
  burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) { setMenu(false); burger.focus(); }
  });

  // якорные ссылки
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : q(id);
    if (!target) return;
    e.preventDefault();
    if (!menu.hidden) setMenu(false);
    if (lenis) {
      lenis.scrollTo(id === '#top' ? 0 : target, { offset: id === '#top' ? 0 : -nav.offsetHeight + 1, duration: 1.4 });
    } else {
      const y = id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY - nav.offsetHeight + 1;
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    }
    if (id !== '#top') history.replaceState(null, '', id);
  });

  /* ======================================================================
     Снег за окном
     ====================================================================== */
  const snowState = { intensity: 0 };
  (function snow() {
    const canvas = q('.win__snow');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const N = 160;
    let w = 0, h = 0, flakes = [], running = false, raf = 0, t = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      flakes = Array.from({ length: N }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: 0.5 + Math.random() * Math.random() * 2.4,
        s: 0.35 + Math.random() * 0.7,
        ph: Math.random() * Math.PI * 2,
        a: 0.55 + Math.random() * 0.45,
      }));
    }

    function frame() {
      t += 0.016;
      const k = snowState.intensity;
      const active = Math.round(N * (0.4 + 0.6 * k));
      const speed = 0.55 + k * 0.9;
      const wind = 0.15 + k * 0.9;
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < active; i++) {
        const f = flakes[i];
        f.y += f.s * speed * (0.6 + f.r * 0.5);
        f.x += Math.sin(t * 1.3 + f.ph) * 0.25 + wind * f.r * 0.35;
        if (f.y > h + 4) { f.y = -4; f.x = Math.random() * w; }
        if (f.x > w + 4) f.x = -4;
        ctx.globalAlpha = f.a;
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (running) raf = requestAnimationFrame(frame);
    }

    resize();
    window.addEventListener('resize', resize);
    if (reduce) { frame(); return; }
    new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !running) { running = true; raf = requestAnimationFrame(frame); }
      else if (!entry.isIntersecting) { running = false; cancelAnimationFrame(raf); }
    }).observe(canvas);
  })();

  /* ======================================================================
     Балконы: переключатель вариантов
     ====================================================================== */
  const chips = qa('.chip');
  const balcImgs = qa('.balc__media img');
  let balcIndex = 0, balcTween = null, balcAuto = motion;

  function showBalc(i, fromUser) {
    balcIndex = i;
    chips.forEach((c, j) => {
      c.classList.toggle('is-active', j === i);
      c.setAttribute('aria-selected', j === i);
    });
    balcImgs.forEach((img, j) => img.classList.toggle('is-active', j === i));
    if (fromUser) balcAuto = false;
    if (!hasGsap) return;
    if (balcTween) balcTween.kill();
    qa('.chip__bar i').forEach((b) => gsap.set(b, { scaleX: 0 }));
    if (balcAuto) {
      balcTween = gsap.fromTo(chips[i].querySelector('.chip__bar i'), { scaleX: 0 }, {
        scaleX: 1, duration: 6, ease: 'none',
        onComplete: () => showBalc((balcIndex + 1) % chips.length, false),
      });
      balcTween.pause();
    }
  }
  chips.forEach((c, i) => c.addEventListener('click', () => showBalc(i, true)));
  showBalc(0, false);

  /* ======================================================================
     До и после
     ====================================================================== */
  const ba = q('#ba');
  const baRange = q('.ba__range');
  if (ba && baRange) {
    baRange.addEventListener('input', () => ba.style.setProperty('--pos', baRange.value + '%'));
  }

  /* ======================================================================
     Бегущие отзывы: копия ленты для бесшовной прокрутки
     ====================================================================== */
  if (motion) {
    qa('.marquee__track').forEach((track) => {
      const items = [...track.children];
      items.forEach((it) => {
        const clone = it.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        track.appendChild(clone);
      });
      track.style.setProperty('--dur', `${Math.round(items.length * 9)}s`);
    });
  }

  if (!motion) {
    qa('[data-count]').forEach((n) => { n.textContent = (+n.dataset.count).toFixed(+n.dataset.decimals || 0).replace('.', ','); });
    return;
  }

  /* ======================================================================
     Дальше только анимация
     ====================================================================== */
  ScrollTrigger.config({ ignoreMobileResize: true });

  lenis = new Lenis({ duration: 1.15, easing: (x) => Math.min(1, 1.001 - Math.pow(2, -10 * x)) });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ---------- первое появление ---------- */
  const ready = Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 700))]);
  ready.then(() => {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.to('.nav', { opacity: 1, duration: 0.9 }, 0)
      .fromTo('.rating-badge', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1 }, 0.1)
      .to('.hero__title .line > span', { y: 0, duration: 1.3, stagger: 0.09 }, 0.15)
      .fromTo('.hero__sub', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.1 }, 0.45)
      .fromTo('.hero__cta', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 1.1 }, 0.55)
      .fromTo('.hero__stage', { opacity: 0, y: 70, scale: 0.94 }, { opacity: 1, y: 0, scale: 1, duration: 1.8 }, 0.2)
      .fromTo('.temp', { opacity: 0, scale: 0.85, y: 10 }, { opacity: 1, scale: 1, y: 0, duration: 1, stagger: 0.15, ease: 'back.out(1.6)' }, 1.1)
      .to('.hero__hint > *', { opacity: 1, duration: 1 }, 1.4);
  });

  /* ---------- окно при прокрутке ---------- */
  const win = q('#win');
  const right = q('.sash--right');
  const tilt = q('.sash__tilt', right);
  const lever = q('.handle__lever');
  const steps = qa('.story__step');
  const bars = qa('.story__progress i');
  const layers = qa('.glass > *', right);
  const tempOut = q('[data-temp-out]');
  const tempState = { v: -18 };
  const setTemp = () => { tempOut.textContent = `−${Math.abs(Math.round(tempState.v))}°`; };

  gsap.set(steps, { autoAlpha: 0, y: 30 });
  gsap.set('.story__progress', { autoAlpha: 0 });
  gsap.set(bars, { '--p': 0 });
  layers.forEach((l, i) => gsap.set(l, { z: i * 0.4 }));

  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 1024px)', mobile: '(max-width: 1023px)' }, (ctx) => {
    const { desktop } = ctx.conditions;
    const layerZ = (i) => () => i * win.offsetWidth * (desktop ? 0.075 : 0.07);

    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: '.hero',
        start: 'top top',
        end: desktop ? '+=340%' : '+=280%',
        pin: true,
        scrub: 0.9,
        anticipatePin: 1,
        invalidateOnRefresh: true,
      },
    });

    // проветривание
    tl.to('.hero__intro', { autoAlpha: 0, y: -40, duration: 0.6 }, 0)
      .to('.hero__hint', { autoAlpha: 0, duration: 0.3 }, 0)
      .to(steps[0], { autoAlpha: 1, y: 0, duration: 0.5 }, 0.45)
      .to('.story__progress', { autoAlpha: 1, duration: 0.4 }, 0.45)
      .to(bars[0], { '--p': 1, duration: 1.7, ease: 'none' }, 0.45)
      .to(lever, { rotation: -180, duration: 0.5 }, 0.5)
      .to(tilt, { rotationX: -17, duration: 0.8 }, 1.05)
    // поворот
      .to(tilt, { rotationX: 0, duration: 0.6 }, 2.1)
      .to(steps[0], { autoAlpha: 0, y: -30, duration: 0.4 }, 2.2)
      .to(steps[1], { autoAlpha: 1, y: 0, duration: 0.5 }, 2.55)
      .to(bars[1], { '--p': 1, duration: 1.8, ease: 'none' }, 2.55)
      .to(lever, { rotation: -90, duration: 0.4 }, 2.7)
      .to(right, { rotationY: 44, duration: 1.0 }, 3.1)
    // стеклопакет
      .to(right, { rotationY: 0, duration: 0.8 }, 4.4)
      .to(lever, { rotation: 0, duration: 0.4 }, 5.15)
      .to(steps[1], { autoAlpha: 0, y: -30, duration: 0.4 }, 4.6)
      .to(steps[2], { autoAlpha: 1, y: 0, duration: 0.5 }, 5.0)
      .to(bars[2], { '--p': 1, duration: 2.0, ease: 'none' }, 5.0)
      .to(win, { rotationY: -36, rotationX: 8, duration: 1.0 }, 5.4)
      .to(win, { '--explode': 1, duration: 0.6 }, 5.9)
      .to(layers, { z: (i) => layerZ(i)(), duration: 1.0, stagger: 0 }, 5.9)
    // зима
      .to(layers, { z: (i) => i * 0.4, duration: 0.8 }, 7.4)
      .to(win, { '--explode': 0, duration: 0.5 }, 7.5)
      .to(win, { rotationY: 0, rotationX: 0, duration: 0.9 }, 7.7)
      .to(steps[2], { autoAlpha: 0, y: -30, duration: 0.4 }, 7.6)
      .to(steps[3], { autoAlpha: 1, y: 0, duration: 0.5 }, 8.0)
      .to(bars[3], { '--p': 1, duration: 1.5, ease: 'none' }, 8.0)
      .to('.hero__glow', { opacity: 1, duration: 1.0 }, 8.0)
      .to(snowState, { intensity: 1, duration: 1.0 }, 8.0)
      .to(tempState, { v: -32, duration: 1.0, ease: 'power1.inOut', onUpdate: setTemp }, 8.0)
      .to({}, { duration: 0.6 }, 9.5);

    return () => { gsap.set([right, tilt, lever, win], { clearProps: 'transform' }); };
  });

  /* ---------- нижняя панель на телефоне ---------- */
  const dock = q('#dock');
  ScrollTrigger.create({
    trigger: '.facts',
    start: 'top 80%',
    onEnter: () => dock.classList.add('is-visible'),
    onLeaveBack: () => dock.classList.remove('is-visible'),
  });

  /* ---------- активный пункт меню ---------- */
  qa('.nav__links a').forEach((a) => {
    const sec = q(a.getAttribute('href'));
    if (!sec) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 45%', end: 'bottom 45%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    });
  });

  /* ---------- заголовки по словам ---------- */
  qa('.reveal-lines').forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map((w) => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(' ');
    gsap.from(qa('.w > span', h), {
      yPercent: 110, duration: 1.2, stagger: 0.06, ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 86%', once: true },
    });
  });

  /* ---------- блоки ---------- */
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out', overwrite: true }),
  });

  // параллакс фото в плитках
  qa('.tile__media img').forEach((img) => {
    gsap.fromTo(img, { yPercent: -12 }, {
      yPercent: 0, ease: 'none',
      scrollTrigger: { trigger: img.closest('.tile'), start: 'top bottom', end: 'bottom top', scrub: true },
    });
  });

  // счётчики
  qa('[data-count]').forEach((n) => {
    const to = +n.dataset.count, dec = +n.dataset.decimals || 0;
    const o = { v: 0 };
    n.textContent = (0).toFixed(dec).replace('.', ',');
    gsap.to(o, {
      v: to, duration: 1.6, ease: 'power3.out',
      onUpdate: () => { n.textContent = o.v.toFixed(dec).replace('.', ','); },
      scrollTrigger: { trigger: n, start: 'top 90%', once: true },
    });
  });

  // балконы: автопрокрутка, только когда блок на экране
  ScrollTrigger.create({
    trigger: '.balc', start: 'top 75%', end: 'bottom 25%',
    onToggle: (self) => { if (balcTween) self.isActive && balcAuto ? balcTween.play() : balcTween.pause(); },
  });

  // этапы: линия рисуется по мере прокрутки
  const stepEls = qa('.step');
  mm.add({ desktop: '(min-width: 1024px)', mobile: '(max-width: 1023px)' }, (ctx) => {
    const { desktop } = ctx.conditions;
    gsap.fromTo('.steps__rail i', desktop ? { scaleX: 0 } : { scaleY: 0 }, {
      ...(desktop ? { scaleX: 1 } : { scaleY: 1 }),
      ease: 'none',
      scrollTrigger: {
        trigger: '.steps', start: desktop ? 'top 75%' : 'top 70%', end: desktop ? 'top 30%' : 'bottom 60%', scrub: 0.6,
        onUpdate: (self) => {
          stepEls.forEach((s, i) => s.classList.toggle('is-on', self.progress >= i / (stepEls.length - 1) - 0.02));
        },
      },
    });
    gsap.from(stepEls, {
      y: 40, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out',
      scrollTrigger: { trigger: '.steps', start: 'top 80%', once: true },
    });
  });

  // до и после: подсказка, что фото можно сравнить
  if (ba) {
    const o = { p: 50 };
    gsap.timeline({ scrollTrigger: { trigger: ba, start: 'top 65%', once: true } })
      .to(o, { p: 26, duration: 0.9, ease: 'power2.inOut', onUpdate: () => ba.style.setProperty('--pos', o.p + '%') })
      .to(o, { p: 50, duration: 1.1, ease: 'power3.inOut', onUpdate: () => ba.style.setProperty('--pos', o.p + '%') })
      .eventCallback('onComplete', () => { baRange.value = 50; });
  }

  // галерея: на компьютере едет вбок при прокрутке
  mm.add('(min-width: 1024px)', () => {
    const track = q('.gallery__track');
    gsap.fromTo(track, { x: 0 }, {
      x: () => -(track.scrollWidth - window.innerWidth) * 0.6,
      ease: 'none',
      scrollTrigger: { trigger: '.gallery', start: 'top bottom', end: 'bottom top', scrub: 0.5, invalidateOnRefresh: true },
    });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
