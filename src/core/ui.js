// Small DOM kit: element builder, icons, and the handful of controls the lab uses.
(() => {
  const QL = (globalThis.QL ||= {});
  const M = QL.math;

  const el = (tag, props, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(3)) {
      if (kid == null || kid === false) continue;
      e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return e;
  };

  const svg = (d, extra = '') =>
    `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
  const icons = {
    play: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4.5 2.8v10.4a.6.6 0 0 0 .9.5l8.4-5.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5z"/></svg>`,
    pause: `<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3.2" height="11" rx=".8"/><rect x="9.3" y="2.5" width="3.2" height="11" rx=".8"/></svg>`,
    reset: svg('<path d="M2.6 8a5.4 5.4 0 1 0 1.7-3.9"/><path d="M2.4 2.2v2.9h2.9"/>'),
    check: svg('<path d="M3 8.4l3.2 3.1L13 4.6"/>', 'stroke-width="2.2"'),
    chev: svg('<path d="M6 3.5 10.5 8 6 12.5"/>'),
    back: svg('<path d="M10 3.5 5.5 8 10 12.5"/>'),
    help: svg('<circle cx="8" cy="8" r="6.2"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.5 1.7c-.5.3-.8.6-.8 1.2"/><path d="M8 11.4v.1"/>'),
    bolt: `<svg viewBox="0 0 16 16" fill="currentColor"><path d="M9.2 1.2 3.4 9h3.7l-.9 5.8L12.6 7H8.5z"/></svg>`,
    eye: svg('<path d="M1.5 8S4 3.6 8 3.6 14.5 8 14.5 8 12 12.4 8 12.4 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="1.9"/>'),
    trash: svg('<path d="M3 4.5h10M6.2 4.5V3h3.6v1.5M4.4 4.5l.6 8.3h6l.6-8.3"/>'),
    dice: svg('<rect x="2.5" y="2.5" width="11" height="11" rx="2.4"/><path d="M5.6 5.6v.1M10.4 10.4v.1M8 8v.1M10.4 5.6v.1M5.6 10.4v.1"/>', 'stroke-width="1.8"'),
    target: svg('<circle cx="8" cy="8" r="5.5"/><circle cx="8" cy="8" r="1.4"/><path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15"/>'),
  };
  const icon = (name) => el('span', { class: 'ic', html: icons[name] || '', style: { display: 'inline-grid' } });

  // ---------------------------------------------------------------- slider
  const slider = ({ label, min, max, step = 0.01, value, fmt = (v) => v, unit = '', onInput, hint, log = false }) => {
    const toPos = (v) => (log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min));
    const fromPos = (p) => {
      const v = log ? min * Math.pow(max / min, p) : min + p * (max - min);
      return M.clamp(Math.round(v / step) * step, min, max);
    };
    const input = el('input', { type: 'range', min: 0, max: 1000, step: 1, 'aria-label': label });
    const val = el('span', { class: 'val' });
    const hintEl = hint ? el('div', { class: 'hint', html: hint }) : null;
    const root = el('div', { class: 'ctl sl' }, el('div', { class: 'row' }, el('label', { text: label }), val), input, hintEl);
    let current = value;
    const paint = () => {
      const p = M.clamp(toPos(current), 0, 1);
      input.value = Math.round(p * 1000);
      input.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      val.innerHTML = `${fmt(current)}${unit ? `<span>${unit}</span>` : ''}`;
    };
    input.addEventListener('input', () => {
      current = fromPos(input.value / 1000);
      paint();
      onInput?.(current);
    });
    paint();
    return {
      el: root,
      get value() { return current; },
      set value(v) { current = M.clamp(v, min, max); paint(); },
      set hint(h) { if (hintEl) hintEl.innerHTML = h; },
      setDisabled(d) { root.classList.toggle('off', !!d); },
    };
  };

  // ------------------------------------------------------------- segmented
  const segmented = ({ label, options, value, onChange, hint }) => {
    let current = value;
    const buttons = options.map((o) => {
      const b = el('button', { type: 'button', text: o.label, 'aria-pressed': 'false', title: o.title || null });
      b.addEventListener('click', () => { if (current !== o.value) { api.value = o.value; onChange?.(o.value); } });
      return b;
    });
    const paint = () => buttons.forEach((b, i) => {
      const on = options[i].value === current;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
    const root = el('div', { class: 'ctl' },
      label ? el('div', { class: 'row' }, el('span', { class: 'lab', text: label })) : null,
      el('div', { class: 'seg', role: 'group', 'aria-label': label || 'options' }, buttons),
      hint ? el('div', { class: 'hint', html: hint }) : null);
    const api = {
      el: root,
      get value() { return current; },
      set value(v) { current = v; paint(); },
      setDisabled(d) { root.classList.toggle('off', !!d); },
    };
    paint();
    return api;
  };

  // ---------------------------------------------------------------- toggle
  const toggle = ({ label, value = false, onChange, hint }) => {
    let current = !!value;
    const btn = el('button', { type: 'button', class: 'tg', role: 'switch', 'aria-checked': String(current) },
      el('span', { class: 'lab', text: label }), el('span', { class: 'sw' }));
    btn.addEventListener('click', () => { api.value = !current; onChange?.(current); });
    const root = el('div', { class: 'ctl' }, btn, hint ? el('div', { class: 'hint', html: hint }) : null);
    const api = {
      el: root,
      get value() { return current; },
      set value(v) { current = !!v; btn.setAttribute('aria-checked', String(current)); },
      setDisabled(d) { root.classList.toggle('off', !!d); },
    };
    return api;
  };

  const button = ({ label, icon: ic, kind = '', onClick, kbd, title, small }) => {
    const b = el('button', { type: 'button', class: `btn ${kind} ${small ? 'sm' : ''}`, title: title || null },
      ic ? icon(ic) : null, label ? el('span', { text: label }) : null, kbd ? el('kbd', { text: kbd }) : null);
    b.addEventListener('click', (e) => onClick?.(e));
    return b;
  };
  const buttons = (...list) => el('div', { class: 'ctl btns' }, list);

  // Stat tile. set(value, unit) updates it; value text is plain, never markup.
  const stat = ({ label, swatch, wide, tip }) => {
    const v = el('div', { class: 'v' });
    const root = el('div', { class: `stat ${wide ? 'wide' : ''}` },
      el('div', { class: 'k', title: tip || null }, swatch ? el('i', { style: { background: swatch } }) : null, label), v);
    let last = '';
    return {
      el: root,
      set(value, unit = '') {
        const key = value + '|' + unit;
        if (key === last) return;
        last = key;
        v.textContent = value;
        if (unit) v.append(el('small', { text: unit }));
      },
    };
  };

  // One floating tooltip for every [data-tip] element.
  const tipEl = el('div', { class: 'float-tip', role: 'tooltip' });
  const showTip = (target) => {
    tipEl.textContent = target.getAttribute('data-tip');
    document.body.append(tipEl);
    const r = target.getBoundingClientRect();
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    const x = M.clamp(r.left + r.width / 2 - w / 2, 8, innerWidth - w - 8);
    const y = r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8;
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
    tipEl.classList.add('on');
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerover', (e) => { const t = e.target.closest?.('[data-tip]'); if (t) showTip(t); });
    document.addEventListener('pointerout', (e) => { if (e.target.closest?.('[data-tip]')) tipEl.classList.remove('on'); });
    document.addEventListener('focusin', (e) => { const t = e.target.closest?.('[data-tip]'); if (t) showTip(t); });
    document.addEventListener('focusout', () => tipEl.classList.remove('on'));
  }

  // Glossary helper for guide copy: QL.ui.term('wavefunction') -> span with a tip.
  const glossary = {
    wavefunction: 'A complex number at every point. Its squared size gives the probability of finding the particle there.',
    amplitude: 'The complex number quantum theory assigns to each possibility. Amplitudes add before you square them, which is where interference comes from.',
    superposition: 'A state that is a sum of several possibilities at once, each with its own amplitude.',
    phase: 'The angle of a complex amplitude, drawn here as color. Only phase differences matter, and they decide whether waves add or cancel.',
    collapse: 'When a measurement gives one result, the state afterwards is the one matching that result.',
    eigenstate: 'A state with a definite value of some quantity. Measuring that quantity always returns the same value.',
    decoherence: 'The loss of interference when a system leaves a record of itself in its surroundings.',
    momentum: 'Mass times velocity. For a quantum wave it is set by the wavelength: p = h / wavelength.',
  };
  const term = (word, shown = word) => `<span data-tip="${glossary[word] || ''}" tabindex="0">${shown}</span>`;

  // Keeps a small fixed-height canvas crisp at the current width. Call fit()
  // at the top of every draw; it returns false until the canvas has a size.
  const fitCanvas = (canvas, height) => {
    const ctx = canvas.getContext('2d');
    const state = { ctx, w: 0, h: height };
    state.fit = () => {
      const w = canvas.clientWidth, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!w) return false;
      if (w !== state.w || canvas.width !== Math.round(w * dpr)) {
        state.w = w;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };
    return state;
  };

  QL.ui = { el, icon, icons, slider, segmented, toggle, button, buttons, stat, term, fitCanvas };
})();
