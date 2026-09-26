// Host-page wiring. The vendored components are untouched; this file does what any
// page would do with them: set attributes, listen for events, and replace an
// element when its data changes.
(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fmt = n => n.toLocaleString('en-US');

  const line = (kind, text) => {
    const li = document.createElement('li');
    li.className = kind;
    li.textContent = text;
    return li;
  };

  // Newest line on top. A key lets a burst (a slider drag) rewrite one line in place.
  function wire(list, kind, text, key) {
    const top = list.firstElementChild;
    if (key && top?.dataset.key === key) { top.textContent = text; return; }
    const li = line(kind, text);
    if (key) li.dataset.key = key;
    list.prepend(li);
    while (list.children.length > 5) list.lastElementChild.remove();
  }

  // Attributes the components write on their own hosts, not part of the page's API.
  const selfSet = new Set(['style', 'role', 'aria-label']);

  // Draw an element's opening tag with its page-facing attributes.
  function renderTag(el, inner = '') {
    const out = [];
    const tok = (cls, text) => {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      out.push(span);
    };
    tok('tok-tag', `<${el.localName}`);
    for (const { name, value } of el.attributes) {
      if (selfSet.has(name)) continue;
      tok('tok-attr', ` ${name}`);
      if (value !== '') { tok('tok-punct', '="'); tok('tok-val', value); tok('tok-punct', '"'); }
    }
    tok('tok-tag', '>');
    if (inner) { tok('tok-val', inner); tok('tok-tag', `</${el.localName}>`); }
    $(`[data-markup="${el.localName}"]`).replaceChildren(...out);
  }

  // Re-render only when a page-facing attribute changes; the lamp rewrites its own
  // style on every animation frame.
  function mirror(el, attributeFilter) {
    const render = () => renderTag(el);
    new MutationObserver(render).observe(el, { attributeFilter });
    render();
  }

  // 01 Pull Lamp: the lamp emits themechange, the page owns the theme.
  const lamp = $('pull-lamp');
  const lampWire = $('#lamp-wire');
  const applyTheme = theme => {
    document.documentElement.dataset.theme = theme;
    $('#mode').textContent = theme === 'light' ? 'DAY MODE' : 'NIGHT MODE';
  };
  mirror(lamp, ['on']);
  lamp.addEventListener('themechange', e => {
    wire(lampWire, 'out', `themechange { theme: "${e.detail.theme}" }`);
    applyTheme(e.detail.theme);
  });
  $('#page-theme').addEventListener('click', () => {
    const light = document.documentElement.dataset.theme !== 'light';
    applyTheme(light ? 'light' : 'dark');
    lamp.toggleAttribute('on', light);
    wire(lampWire, 'in', `${light ? 'on' : 'on removed'} (from code, so no themechange comes back)`);
  });

  // 02 Signal Orb: driven entirely by attributes, emits nothing.
  const orb = $('signal-orb');
  const orbWire = $('#orb-wire');
  const level = $('#orb-level');
  const runButton = $('#orb-run');
  const faces = {
    listening: ['Listening', 'Ready for input.'],
    thinking: ['Thinking', 'Working it out.'],
    searching: ['Searching', 'Following a lead.'],
    done: ['Done', 'Everything in place.'],
  };
  mirror(orb, ['state', 'level', 'particles']);

  const setOrb = (name, value) => {
    if (value == null) orb.removeAttribute(name);
    else orb.setAttribute(name, value);
    wire(orbWire, 'in', value == null ? `${name} removed` : `${name}="${value}"`, name === 'level' ? 'level' : undefined);
  };
  const setLevel = v => {
    level.value = v.toFixed(2);
    setOrb('level', level.value);
  };
  const setState = (state, hint) => {
    setOrb('state', state);
    $$('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.state === state)));
    $('#orb-label').textContent = faces[state][0];
    $('#orb-hint').textContent = hint ?? faces[state][1];
  };

  // A fake agent turn. The timings stand in for the events a real runtime would send.
  let turn = null;
  const stopTurn = () => {
    if (!turn) return;
    turn.stopped = true;
    turn = null;
    runButton.textContent = 'Simulate an agent turn';
  };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function agentTurn() {
    const me = turn = { stopped: false };
    runButton.textContent = 'Stop';
    setState('listening', 'User is talking; level follows a fake voice.');
    const start = performance.now();
    let now = start;
    while (now - start < 2600) {
      if (me.stopped) return;
      const t = (now - start) / 1000;
      setLevel(.18 + .72 * Math.abs(Math.sin(t * 9.5)) * (.55 + .45 * Math.sin(t * 2.3 + 1)));
      now = await new Promise(requestAnimationFrame);
    }
    if (me.stopped) return;
    setLevel(.5);
    for (const [state, hint, ms] of [
      ['thinking', 'Model is streaming a reply.', 2600],
      ['searching', 'A tool call is running.', 2800],
      ['done', 'Reply complete.', 2200],
    ]) {
      setState(state, hint);
      await sleep(ms);
      if (me.stopped) return;
    }
    setState('listening');
    stopTurn();
  }
  runButton.addEventListener('click', () => (turn ? stopTurn() : agentTurn()));
  $$('.seg button').forEach(b => b.addEventListener('click', () => {
    stopTurn();
    setState(b.dataset.state);
  }));
  level.addEventListener('input', () => {
    stopTurn();
    setOrb('level', level.value);
  });
  $('#orb-particles').addEventListener('change', e => setOrb('particles', e.target.value || null));

  // Renderer and particle budget come from the element (orb.gl is an internal);
  // fps is the page's frame rate, which the orb renders at.
  const orbStats = $('#orb-stats');
  let firstAuto = null;
  let frames = 0;
  let since = performance.now();
  const sample = now => {
    frames++;
    if (now - since >= 500) {
      const fps = Math.round(frames * 1000 / (now - since));
      frames = 0;
      since = now;
      const n = orb.particles;
      const auto = !orb.hasAttribute('particles');
      if (auto) firstAuto ??= n;
      const budget = !auto ? `${fmt(n)} particles`
        : n < firstAuto ? `${fmt(n)} particles (auto, down from ${fmt(firstAuto)})`
        : `${fmt(n)} particles (auto)`;
      orbStats.textContent = `${orb.gl ? 'WebGL' : 'Canvas 2D fallback'} · ${budget} · ${fps} fps`;
    }
    requestAnimationFrame(sample);
  };
  requestAnimationFrame(sample);

  // 03 Project Stack: JSON is read once on connect, so every change is a new element.
  const stage = $('#stack-stage');
  const json = $('#stack-json');
  const stackWire = $('#stack-wire');
  const stackStats = $('#stack-stats');
  const current = () => $('project-stack', stage);
  const initial = JSON.stringify(JSON.parse($('script', current()).textContent), null, 2);
  const hostile = JSON.stringify([
    { title: '<u>Hi</u>', tag: 'MARKUP', description: '<img src=x onerror=alert(1)> stays text.', href: 'javascript:alert(1)', accent: 'red;background:url(//evil.example)' },
    { title: 'Data link', tag: 'HREF', description: 'Only http(s) links survive.', href: 'data:text/html,<script>alert(1)</script>' },
    { title: 'Near miss', tag: 'ACCENT', description: 'An accent must be exactly #rrggbb.', href: 'https://example.com/ok', accent: '#83d63a;x' },
  ], null, 2);

  const normalized = href => { try { return new URL(href).href; } catch { return null; } };
  const clip = v => {
    const s = JSON.stringify(String(v));
    return s.length > 36 ? `${s.slice(0, 34)}…"` : s;
  };

  // Compare what went in with what the element actually rendered in its shadow root.
  function audit(el, items) {
    const lines = [];
    const cards = el.shadowRoot.querySelectorAll('.card');
    items.forEach((item, i) => {
      const card = cards[i];
      const n = `card ${i + 1}:`;
      const text = `${item.title ?? ''}${item.description ?? ''}`;
      if (/[<>]/.test(text) && !card.querySelector('.label *, .description *')) lines.push(line('note', `${n} markup kept as plain text`));
      const href = card.querySelector('a').getAttribute('href');
      if (item.href != null && href !== normalized(item.href)) lines.push(line('note', `${n} link ${clip(item.href)} → ${href}`));
      if (item.accent != null) {
        const applied = card.style.getPropertyValue('--accent');
        lines.push(line('note', applied ? `${n} accent ${applied} applied` : `${n} accent ${clip(item.accent)} ignored`));
      }
    });
    return lines.length ? lines : [line('note', 'every field accepted as given')];
  }

  const showStackMarkup = count => renderTag(current(), `\n  <script type="application/json">[ ${count} ]</script>\n`);
  const describe = data => (Array.isArray(data) ? `${data.length} item${data.length === 1 ? '' : 's'}` : typeof data);

  function rebuild(text, reason) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      stackWire.replaceChildren(line('note', `not rebuilt: ${err.message}`));
      return;
    }
    const el = document.createElement('project-stack');
    const script = document.createElement('script');
    script.type = 'application/json';
    script.textContent = JSON.stringify(data);
    el.append(script); // the JSON has to be inside before the element connects
    current().replaceWith(el);
    const fits = Array.isArray(data) && data.length === 3;
    stackWire.replaceChildren(
      line('note', `replaced <project-stack> (${reason})`),
      ...(fits ? audit(el, data) : [line('note', `got ${describe(data)}; it needs exactly 3, so it quietly showed its built-in sample`)]),
    );
    stackStats.textContent = `el.active = ${el.active}`;
    showStackMarkup(describe(data));
  }

  // The element emits nothing when a tab changes, so read el.active after the input lands.
  const readActive = () => { stackStats.textContent = `el.active = ${current().active}`; };
  stage.addEventListener('click', readActive);
  stage.addEventListener('keydown', readActive);

  json.value = initial;
  $('#stack-apply').addEventListener('click', () => rebuild(json.value, 'your JSON'));
  $('#stack-hostile').addEventListener('click', () => {
    json.value = hostile;
    rebuild(hostile, 'hostile input');
  });
  $('#stack-reset').addEventListener('click', () => {
    json.value = initial;
    rebuild(initial, 'reset');
  });
  stackWire.replaceChildren(line('note', 'built by the HTML parser on load'), ...audit(current(), JSON.parse(initial)));
  showStackMarkup('3 items');
})();
