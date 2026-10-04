(() => {
  const cfg = window.SITE_CONFIG;
  const docEl = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = !!window.gsap;
  const motion = hasGsap && !reduce;
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];

  if (!motion) docEl.classList.remove('motion');
  window.__voMotion = motion;

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

  const consentInput = q('#lead-consent');
  const consentError = q('#lead-consent-error');
  if (consentInput) {
    consentInput.addEventListener('change', () => {
      if (consentInput.checked) {
        consentInput.removeAttribute('aria-invalid');
        consentError.hidden = true;
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
      // Без отмеченного согласия заявку не отправляем (152-ФЗ, согласие отдельным документом)
      if (consentInput && !consentInput.checked) {
        consentInput.setAttribute('aria-invalid', 'true');
        consentInput.setAttribute('aria-describedby', 'lead-consent-error');
        consentError.hidden = false;
        consentInput.focus();
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
        consent: true, consentAt: new Date().toISOString(),
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

  // Высоту первого экрана запоминаем один раз и обновляем через ResizeObserver:
  // чтение offsetHeight на каждом событии прокрутки заставляло браузер
  // пересчитывать раскладку посреди кадра.
  let heroHeight = hero.offsetHeight;
  if ('ResizeObserver' in window) new ResizeObserver(([en]) => { heroHeight = en.target.offsetHeight; }).observe(hero);
  let scrollQueued = false;
  const applyScroll = () => {
    scrollQueued = false;
    const y = window.scrollY;
    header.classList.toggle('is-compact', y > 24);
    if (dock) dock.classList.toggle('is-visible', y > heroHeight - window.innerHeight * 0.35);
  };
  const onScroll = () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(applyScroll);
  };
  applyScroll();
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

  /* ======================================================================
     Карта 2ГИС: тайлы 2ГИС через Leaflet и свой маркер, без всплывающей
     карточки. Библиотека и тайлы грузятся, только когда до контактов остаётся
     немного прокрутки, поэтому не тормозят загрузку; до этого на месте карты
     статичная заставка. Двигать карту можно после нажатия, иначе она
     перехватывала бы прокрутку страницы колесом и пальцем.
     ====================================================================== */
  const mapBox = q('#map');
  if (mapBox && 'IntersectionObserver' in window) {
    const live = q('.contact__map-live', mapBox);
    const activate = q('.map-activate', mapBox);
    const point = [+mapBox.dataset.lat, +mapBox.dataset.lon];
    const pinSvg = q('.map-pin-static', mapBox).innerHTML;
    const handlers = ['dragging', 'touchZoom', 'doubleClickZoom', 'scrollWheelZoom'];
    let map = null;

    const loadAsset = (tag, attrs) => new Promise((resolve, reject) => {
      const el = document.createElement(tag);
      Object.assign(el, attrs);
      el.onload = resolve;
      el.onerror = reject;
      document.head.appendChild(el);
    });

    const setActive = (on) => {
      mapBox.classList.toggle('is-active', on);
      if (map) handlers.forEach((h) => map[h][on ? 'enable' : 'disable']());
    };

    const build = () => {
      const L = window.L;
      map = L.map(live, {
        center: point, zoom: 16, minZoom: 11, maxZoom: 18,
        zoomControl: false, attributionControl: false, boxZoom: false, keyboard: false,
        dragging: false, touchZoom: false, doubleClickZoom: false, scrollWheelZoom: false,
      });
      L.control.zoom({ position: 'topright', zoomInTitle: 'Приблизить', zoomOutTitle: 'Отдалить' }).addTo(map);
      L.control.attribution({ prefix: false })
        .addAttribution('© <a href="https://law.2gis.ru/api-rules/" target="_blank" rel="noopener">2ГИС</a>')
        .addTo(map);
      let loaded = 0, failed = 0;
      L.tileLayer('https://tile{s}.maps.2gis.com/tiles?x={x}&y={y}&z={z}&v=1', { subdomains: '0123', maxZoom: 18, className: 'map-tiles' })
        .on('tileload', () => {
          if (loaded++) return;
          mapBox.classList.add('is-live');
          activate.hidden = false;
        })
        // тайлы не грузятся совсем — остаёмся на статичной карте
        .on('tileerror', () => {
          if (++failed > 8 && !loaded && map) { map.remove(); map = null; }
        })
        .addTo(map);
      const icon = L.divIcon({ className: 'map-marker', html: pinSvg, iconSize: [36, 46], iconAnchor: [18, 45] });
      L.marker(point, { icon, keyboard: false, title: 'Вилен Окна, ул. Красина, 56' }).addTo(map);
    };

    const near = new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      near.disconnect();
      Promise.all([
        loadAsset('link', { rel: 'stylesheet', href: 'assets/vendor/leaflet/leaflet.css' }),
        loadAsset('script', { src: 'assets/vendor/leaflet/leaflet.js' }),
      ]).then(build).catch(() => {});
    }, { rootMargin: '600px 0px' });
    near.observe(mapBox);

    activate.addEventListener('click', () => setActive(true));
    mapBox.addEventListener('mouseleave', () => setActive(false));
    // карта ушла с экрана — снова защищаем прокрутку от случайных жестов
    new IntersectionObserver(([en]) => { if (!en.isIntersecting) setActive(false); }).observe(mapBox);
  }

  if (!motion) {
    qa('[data-count]').forEach((n) => { n.textContent = (+n.dataset.count).toFixed(+n.dataset.decimals || 0).replace('.', ','); });
    return;
  }

  /* ======================================================================
     Дальше только анимация.
     На каждом кадре прокрутки ничего не считается: блоки появляются через
     CSS-переходы по одному IntersectionObserver, а параллакс фото и линия
     этапов — CSS-анимации, привязанные к прокрутке (их ведёт браузер, без
     JS). Раньше всё это делал ScrollTrigger: при загрузке он десятки раз
     заставлял пересчитывать раскладку, а при прокрутке проверял все триггеры
     на каждом кадре.
     ====================================================================== */
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');

  // Плавное колесо мыши — только где есть мышь. На телефоне прокрутка родная,
  // Lenis там всё равно не работает, а свой цикл кадров у него бы остался.
  if (window.Lenis && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    idle(() => {
      lenis = new Lenis({ duration: 1.1, easing: (x) => Math.min(1, 1.001 - Math.pow(2, -10 * x)), autoRaf: true });
    });
  }

  /* ---------- заголовки по словам ---------- */
  qa('.reveal-lines').forEach((h) => {
    const text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    h.innerHTML = text.split(/\s+/).map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${esc(w)}</span></span>`).join(' ');
  });

  /* ---------- появление блоков: один наблюдатель на всё ---------- */
  const onEnter = new Map();
  const enter = new IntersectionObserver((entries) => {
    let n = 0;
    entries.forEach((en) => {
      if (!en.isIntersecting) return;
      const el = en.target;
      // блоки, появившиеся одновременно, идут лесенкой
      if (el.classList.contains('reveal')) el.style.setProperty('--stagger', `${n++ * 100}ms`);
      el.classList.add('is-in');
      enter.unobserve(el);
      const fn = onEnter.get(el);
      if (fn) fn();
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  qa('.reveal, .reveal-lines, .steps, .work__media').forEach((el) => enter.observe(el));

  // счётчики
  qa('[data-count]').forEach((n) => {
    const to = +n.dataset.count, dec = +n.dataset.decimals || 0;
    const fmt = (v) => v.toFixed(dec).replace('.', ',');
    n.textContent = fmt(0);
    onEnter.set(n, () => {
      if (!hasGsap) { n.textContent = fmt(to); return; }
      const o = { v: 0 };
      gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => { n.textContent = fmt(o.v); } });
    });
    enter.observe(n);
  });

  // до и после (если блок есть на странице): подсказка, что фото можно сравнить
  const ba = q('#ba');
  const baRange = ba && q('.ba__range', ba);
  if (ba && baRange && hasGsap) {
    onEnter.set(ba, () => {
      const o = { p: 50 };
      const set = () => ba.style.setProperty('--pos', o.p + '%');
      gsap.timeline({ onComplete: () => { baRange.value = 50; } })
        .to(o, { p: 26, duration: 0.9, ease: 'power2.inOut', onUpdate: set })
        .to(o, { p: 50, duration: 1.1, ease: 'power3.inOut', onUpdate: set });
    });
    enter.observe(ba);
  }

  /* ---------- то, что работает только пока видно ---------- */
  const whileVisible = (el, fn, rootMargin = '0px') => {
    if (el) new IntersectionObserver(([en]) => fn(en.isIntersecting), { rootMargin }).observe(el);
  };
  // балконы: автопереключение вариантов
  whileVisible(q('.balc'), (on) => { if (balcTween) on && balcAuto ? balcTween.play() : balcTween.pause(); }, '-25% 0px -25% 0px');
  // бегущие отзывы не крутятся за пределами экрана
  qa('.marquee').forEach((el) => whileVisible(el, (on) => el.classList.toggle('is-running', on), '100px 0px'));

  /* ---------- этапы: кружки загораются по мере прокрутки ---------- */
  const stepIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      // выше линии на 60% экрана — горит; ушёл вниз при прокрутке назад — гаснет
      const above = en.isIntersecting || en.boundingClientRect.top < 0;
      en.target.classList.toggle('is-on', above);
    });
  }, { rootMargin: '0px 0px -40% 0px' });
  qa('.step').forEach((s) => stepIO.observe(s));
})();
