// The guide: a short list of missions per station. Each one asks the learner
// to do something to the apparatus, notices when they have, then explains
// what they just saw. Predict, observe, explain.
(() => {
  const QL = (globalThis.QL ||= {});
  const { el, icons } = QL.ui;

  QL.Guide = class {
    constructor(host, { id, missions, store, toast, next }) {
      this.host = host;
      this.id = id;
      this.missions = missions;
      this.store = store;
      this.toast = toast;
      this.next = next;
      const saved = store.get('guide:' + id) || {};
      this.done = new Set(saved.done || []);
      this.picks = saved.picks || {};
      this.open = null;      // which finished mission has its insight open
      this.fresh = null;     // mission that completed during this visit
      this.render();
    }

    get current() { return this.missions.find((m) => !this.done.has(m.id)) || null; }
    get complete() { return this.missions.every((m) => this.done.has(m.id)); }

    save() { this.store.set('guide:' + this.id, { done: [...this.done], picks: this.picks, total: this.missions.length }); }

    finish(m, quiet = false) {
      if (this.done.has(m.id)) return;
      this.done.add(m.id);
      this.open = m.id;
      this.fresh = m.id;
      this.save();
      this.render();
      if (!quiet) this.toast?.(`<span class="ok">&#10003;</span>${m.title}`);
      this.onProgress?.();
    }

    // Called a few times a second by the lab shell.
    poll() {
      const m = this.current;
      if (!m) return;
      if (m.predict && this.picks[m.id] == null) return; // commit to a prediction first
      let v = false;
      try { v = m.check ? m.check() : false; } catch { v = false; }
      if (typeof v === 'number' ? v >= 1 : !!v) { this.finish(m); return; }
      if (this.progEl && m.progress) {
        const text = m.progress();
        if (text !== this.progText) { this.progText = text; this.progEl.textContent = text; }
      }
    }

    reset() {
      this.done.clear();
      this.picks = {};
      this.open = null;
      this.fresh = null;
      this.save();
      this.render();
    }

    render() {
      const cur = this.current, n = this.missions.length, k = this.done.size;
      this.progEl = null;
      this.progText = '';
      const rows = this.missions.map((m, i) => {
        const done = this.done.has(m.id), now = m === cur;
        const title = el('div', { class: 't', text: m.title });
        const row = el('div', { class: `mission ${done ? 'done' : ''} ${now ? 'now' : ''}` },
          el('div', { class: 'dot', html: done ? icons.check : '' }), title);
        if (done) {
          title.setAttribute('role', 'button');
          title.setAttribute('tabindex', '0');
          const flip = () => { this.open = this.open === m.id ? null : m.id; this.fresh = null; this.render(); };
          title.addEventListener('click', flip);
          title.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
          if (this.open === m.id) {
            if (m.predict) row.append(this.predictBlock(m, true));
            row.append(el('div', { class: `insight ${this.fresh === m.id ? 'pop' : ''}`, html: `<span class="lbl">What you just saw</span>${m.insight}` }));
          }
        } else if (now) {
          row.append(el('div', { class: 'body', html: m.body }));
          if (m.predict) row.append(this.predictBlock(m, false));
          const meta = el('div', { class: 'meta' });
          if (m.progress) { this.progEl = el('span', { class: 'prog' }); meta.append(this.progEl); }
          if (m.show && !(m.predict && this.picks[m.id] == null)) meta.append(el('span', { class: 'link', text: 'Show me', role: 'button', tabindex: '0', onclick: () => m.show() }));
          meta.append(el('span', { class: 'link', text: 'Skip', role: 'button', tabindex: '0', style: { color: 'var(--ink-3)' }, onclick: () => this.finish(m, true) }));
          row.append(meta);
        }
        return row;
      });
      const kids = [
        el('div', { class: 'sec-h' }, 'Guide', el('span', { class: 'r', text: `${k} of ${n}` })),
        el('div', { class: 'bar' }, el('i', { style: { width: `${(100 * k) / n}%` } })),
        ...rows,
      ];
      if (this.complete && this.next) {
        kids.push(el('div', { class: 'finish' },
          el('p', { html: `<b>Station complete.</b>${this.next.blurb}` }),
          el('button', { class: 'btn primary', type: 'button', onclick: this.next.go }, this.next.label, el('span', { html: icons.chev, style: { display: 'inline-grid' } }))));
      }
      this.host.replaceChildren(...kids);
      this.fresh = null;
    }

    predictBlock(m, revealed) {
      const pick = this.picks[m.id];
      const opts = m.predict.options.map((text, i) => {
        const b = el('button', { type: 'button', text });
        if (revealed) {
          b.disabled = true;
          if (i === m.predict.answer) b.classList.add('right');
          else if (i === pick) b.classList.add('pick', 'wrong');
          else b.classList.add('wrong');
        } else {
          if (i === pick) b.classList.add('pick');
          b.addEventListener('click', () => { this.picks[m.id] = i; this.save(); this.render(); });
        }
        return b;
      });
      return el('div', { class: 'predict' },
        el('div', { class: 'q', text: revealed ? m.predict.q : `Predict first: ${m.predict.q}` }),
        el('div', { class: 'opts' }, opts));
    }
  };
})();
