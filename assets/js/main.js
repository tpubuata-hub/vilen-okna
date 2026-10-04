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
     Заявки: WhatsApp или почта, а если указан свой обработчик, то на него
     ====================================================================== */
  const openWhatsApp = (text) => {
    window.open(`https://wa.me/${cfg.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  };
  const openMail = (subject, text) => {
    location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.replace(/\n/g, '\r\n'))}`;
  };

  window.sendLead = (data, formEl, channel) => {
    if (channel === 'email') { openMail(data.subject || 'Заявка с сайта', data.text); return; }
    if (!cfg.formEndpoint) { openWhatsApp(data.text); return; }
    const btn = formEl && formEl.querySelector('[data-channel="whatsapp"]');
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.textContent = 'Отправляем…'; }
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
        openWhatsApp(data.text);
        if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; }
      });
  };

  if (cfg.formEndpoint) {
    qa('.calc__note, .form__note, [data-channel="email"]').forEach((n) => { n.hidden = true; });
    qa('#lead-form [data-channel="whatsapp"]').forEach((b) => { b.textContent = 'Записаться на замер'; });
    qa('#calc-form [data-channel="whatsapp"]').forEach((b) => { b.textContent = 'Отправить запрос'; });
  }

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
        source: 'zamer', name, phone: phoneDigits ? '+7' + phoneDigits : '', topic: topics.join(', '), comment,
        text: lines.join('\n'), subject: 'Заявка на замер с сайта',
      }, leadForm, e.submitter && e.submitter.dataset.channel);
    });
  }

  /* ======================================================================
     Шапка, меню, якоря
     ====================================================================== */
  const header = q('#nav');
  const burger = q('.burger');
  const menu = q('#menu');
  const hero = q('.hero');
  const dock = q('#dock');
  let lenis = null;

  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle('is-compact', y > 24);
    if (dock) dock.classList.toggle('is-visible', y > hero.offsetHeight - window.innerHeight * 0.35);
  };
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
        gsap.fromTo(qa('.menu__links a, .menu__foot > *', menu), { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.035, ease: 'power3.out' });
      }
      const first = q('.menu__links a', menu);
      if (first) first.focus({ preventScroll: true });
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
  window.addEventListener('resize', () => {
    if (!menu.hidden && getComputedStyle(burger).display === 'none') setMenu(false);
  });

  // якорные ссылки: плавная прокрутка с учётом шапки, при необходимости фокус в поле формы
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? document.body : q(id);
    if (!target) return;
    e.preventDefault();
    if (!menu.hidden) setMenu(false);
    const focusEl = a.dataset.focus ? q(a.dataset.focus) : null;
    const done = () => { if (focusEl) focusEl.focus({ preventScroll: true }); };
    const offset = id === '#top' ? 0 : -parseFloat(getComputedStyle(docEl).getPropertyValue('--header-h-compact')) + 1;
    if (lenis) {
      // Lenis сам учитывает scroll-padding-top у html, отдельный отступ не нужен
      lenis.scrollTo(id === '#top' ? 0 : target, { duration: 1.2, onComplete: done });
    } else {
      const y = id === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY + offset;
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(done, reduce ? 0 : 700);
    }
    if (id !== '#top') history.replaceState(null, '', id);
  });

  // активный пункт меню
  const navLinks = qa('.site-nav a');
  const sections = navLinks.map((a) => q(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s));
    new IntersectionObserver(([en]) => {
      if (en.isIntersecting) navLinks.forEach((a) => a.classList.remove('is-active'));
    }, { threshold: 0.4 }).observe(hero);
  }

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
     Наши работы: просмотр фото на весь экран
     ====================================================================== */
  const lightbox = q('#lightbox');
  const shots = qa('.work__media');
  if (lightbox && shots.length && typeof lightbox.showModal === 'function') {
    const lbImg = q('.lightbox__img', lightbox);
    const lbText = q('.lightbox__text', lightbox);
    const lbCount = q('.lightbox__count', lightbox);
    let current = 0;
    let opener = null;

    const show = (i) => {
      current = (i + shots.length) % shots.length;
      const b = shots[current];
      const img = q('img', b);
      lbImg.classList.add('is-loading');
      const next = new Image();
      next.onload = next.onerror = () => {
        lbImg.src = b.dataset.full;
        lbImg.alt = img ? img.alt : '';
        requestAnimationFrame(() => lbImg.classList.remove('is-loading'));
      };
      next.src = b.dataset.full;
      lbText.textContent = b.dataset.caption || '';
      lbCount.textContent = `${current + 1} / ${shots.length}`;
      // заранее грузим соседнее фото
      new Image().src = shots[(current + 1) % shots.length].dataset.full;
    };

    const open = (i, btn) => {
      opener = btn;
      show(i);
      lightbox.showModal();
      document.body.style.overflow = 'hidden';
      if (lenis) lenis.stop();
    };
    const close = () => { if (lightbox.open) lightbox.close(); };

    lightbox.addEventListener('close', () => {
      document.body.style.overflow = '';
      if (lenis) lenis.start();
      if (opener) opener.focus({ preventScroll: true });
    });
    shots.forEach((b, i) => b.addEventListener('click', () => open(i, b)));
    q('.lightbox__prev', lightbox).addEventListener('click', () => show(current - 1));
    q('.lightbox__next', lightbox).addEventListener('click', () => show(current + 1));
    q('.lightbox__close', lightbox).addEventListener('click', close);
    // клик по тёмному фону закрывает
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox || e.target.classList.contains('lightbox__figure')) close(); });
    lightbox.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
    });
    // свайп на телефоне
    let startX = null;
    lightbox.addEventListener('pointerdown', (e) => { startX = e.clientX; });
    lightbox.addEventListener('pointerup', (e) => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    });
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

  lenis = new Lenis({ duration: 1.1, easing: (x) => Math.min(1, 1.001 - Math.pow(2, -10 * x)) });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* ---------- заголовки по словам ---------- */
  qa('.reveal-lines').forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute('aria-label', h.textContent.trim());
    h.innerHTML = words.map((w) => `<span class="w" aria-hidden="true"><span>${w}</span></span>`).join(' ');
    gsap.from(qa('.w > span', h), {
      yPercent: 110, duration: 1.1, stagger: 0.05, ease: 'expo.out',
      scrollTrigger: { trigger: h, start: 'top 86%', once: true },
    });
  });

  /* ---------- блоки ---------- */
  ScrollTrigger.batch('.reveal', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', overwrite: true }),
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
  const mm = gsap.matchMedia();
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

  // фото работ: лёгкое проявление при появлении на экране
  qa('.work__media img').forEach((img) => {
    gsap.fromTo(img, { scale: 1.08 }, {
      scale: 1, duration: 1.4, ease: 'expo.out', clearProps: 'transform',
      scrollTrigger: { trigger: img, start: 'top 90%', once: true },
    });
  });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
