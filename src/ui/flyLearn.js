import { createEpisode, createGenome, createPolicy, stepEpisode, DT } from '../fly/core/engine.js';
import { values } from '../fly/policies/sarsa.js';
import { LEARN_SECTIONS, LEARN_SNIPPETS } from '../fly/learn/content.js';
import '../fly/learn/learn.css';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const signed = value => `${value >= 0 ? '+' : ''}${value.toFixed(6)}`;
const actions = ['Turn left', 'Straight', 'Turn right'];
const chapterNames = { overview: 'The fly', loop: 'Control loop', learning: 'Training', teaching: 'Teach new behaviors', commands: 'Commands' };
const distance = episode => Math.min(...episode.sources.filter(source => source.rewarded && source.active)
  .map(source => Math.hypot(episode.fly.x - source.x, episode.fly.y - source.y, episode.fly.z - source.z)));

/** A reading surface and isolated, real-core teaching example. Never mutates the user's specimen. */
export class FlyLearn {
  constructor() {
    this.section = 'overview';
    this.learning = true;
    this.resetDemo();
    this.el = document.createElement('dialog');
    this.el.className = 'fly-learn';
    this.el.setAttribute('aria-labelledby', 'fly-learn-title');
    this.el.innerHTML = `
      <header class="learn-header"><div><span class="learn-eyebrow">FLY EXPEDITION LAB / FIELD MANUAL</span><h2 id="fly-learn-title">Learn</h2></div><button type="button" class="learn-close" aria-label="Close Learn">Back to Train <span aria-hidden="true">×</span></button></header>
      <div class="learn-layout"><nav class="learn-nav" aria-label="Learn chapters">${LEARN_SECTIONS.map((section, index) => `<button type="button" data-learn-section="${section.id}" aria-controls="fly-learn-reading"><span>0${index + 1}</span>${esc(chapterNames[section.id] || section.title)}</button>`).join('')}<p>From a scent sample<br>to a learned action.</p></nav>
      <article class="learn-reading" id="fly-learn-reading" tabindex="0"></article></div>
      <footer class="learn-footer"><span>MODEL MANUAL <b>v1.0</b></span><span>Real code. Reduced biology.</span></footer>`;
    document.body.append(this.el);
    this.el.addEventListener('click', event => this.onClick(event));
    this.el.addEventListener('change', event => {
      if (event.target.matches('[data-learn-learning]')) {
        this.learning = event.target.checked; this.resetDemo(); this.renderDemo();
      }
    });
    // Keep Observatory hotkeys from pausing jobs or capturing images while reading/copying code.
    this.el.addEventListener('keydown', event => event.stopPropagation());
    this.el.addEventListener('close', () => this.opener?.isConnected && this.opener.focus());
    this.renderSection();
  }

  open(opener) {
    this.opener = opener;
    if (!this.el.open) this.el.showModal();
    this.el.querySelector('.learn-close').focus();
  }
  close() { if (this.el.open) this.el.close(); }
  dispose() { this.close(); this.el.remove(); }

  onClick(event) {
    if (event.target.closest('.learn-close')) return this.close();
    const chapter = event.target.closest('[data-learn-section]');
    if (chapter) {
      this.section = chapter.dataset.learnSection; this.renderSection(); return;
    }
    const copyButton = event.target.closest('[data-learn-copy]');
    if (copyButton) return this.copySnippet(copyButton);
    if (event.target.closest('[data-learn-step]')) { this.stepDemo(); this.renderDemo(); }
    if (event.target.closest('[data-learn-reset]')) { this.resetDemo(); this.renderDemo(); }
  }

  renderSection() {
    const section = LEARN_SECTIONS.find(item => item.id === this.section) || LEARN_SECTIONS[0];
    this.section = section.id;
    this.el.querySelectorAll('[data-learn-section]').forEach(button => {
      if (button.dataset.learnSection === section.id) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
    const article = this.el.querySelector('.learn-reading');
    article.innerHTML = `<div class="learn-chapter-heading"><span class="learn-eyebrow">${esc(section.kicker)}</span><h3>${esc(section.title)}</h3><p>${esc(section.intro)}</p></div>${section.html}`;
    for (const placeholder of article.querySelectorAll('[data-learn-snippet]')) {
      const id = placeholder.dataset.learnSnippet, snippet = LEARN_SNIPPETS[id];
      if (!snippet) continue;
      placeholder.classList.add('learn-code');
      placeholder.innerHTML = `<div class="learn-code-title"><span>${esc(snippet.label)} <small>${esc(snippet.language)}</small></span><button type="button" data-learn-copy="${esc(id)}" aria-label="Copy ${esc(snippet.label)}">Copy</button></div><pre tabindex="0"><code>${esc(snippet.code)}</code></pre><p>${esc(snippet.context)}</p><span class="learn-copy-status" role="status"></span>`;
    }
    if (article.querySelector('[data-learn-inspector]')) this.buildDemo();
    const next = LEARN_SECTIONS[LEARN_SECTIONS.indexOf(section) + 1];
    if (next) article.insertAdjacentHTML('beforeend', `<button type="button" class="learn-next" data-learn-section="${next.id}"><span>CONTINUE READING</span>${esc(next.title)} <b aria-hidden="true">→</b></button>`);
    article.scrollTop = 0;
  }

  async copySnippet(button) {
    const snippet = LEARN_SNIPPETS[button.dataset.learnCopy];
    const status = button.closest('.learn-code').querySelector('.learn-copy-status');
    try {
      await navigator.clipboard.writeText(snippet.code);
      status.textContent = 'Copied. Run it in the environment shown above.';
    } catch {
      const selection = window.getSelection(), range = document.createRange();
      range.selectNodeContents(button.closest('.learn-code').querySelector('code'));
      selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Code selected. Press Ctrl+C or ⌘C to copy.';
    }
  }

  resetDemo() {
    this.demo = createEpisode({ seed: 18, policy: createPolicy(17), genome: createGenome(),
      scenario: 'orchard', training: this.learning, epsilon: this.learning ? .12 : 0 });
    this.lastStep = null;
  }

  stepDemo() {
    const episode = this.demo;
    if (episode.done) return;
    const features = [...episode.features], action = episode.action;
    const beforePolicy = { ...episode.policy, weights: [...episode.policy.weights] };
    const beforeScores = values(beforePolicy, features), beforeDistance = distance(episode), collisions = episode.fly.collisions;
    stepEpisode(episode, 1);
    const nextQ = episode.done ? 0 : values(beforePolicy, episode.features)[episode.action];
    const changed = episode.policy.weights.filter((weight, i) => weight !== beforePolicy.weights[i]).length;
    this.lastStep = { action, features, beforeScores, afterScores: values(episode.policy, features), changed,
      delta: episode.reward + .97 * nextQ - beforeScores[action],
      shaping: episode.training ? 100 * (beforeDistance - distance(episode)) : 0,
      collision: episode.fly.collisions > collisions ? -.12 : 0, arrival: episode.fly.success ? 8 : 0 };
  }

  buildDemo() {
    const root = this.el.querySelector('[data-learn-inspector]');
    root.className = 'learn-inspector';
    root.innerHTML = `<div class="learn-inspector-heading"><div><span class="learn-eyebrow">OPEN THE CONTROL LOOP</span><h4>One tick, under the microscope.</h4></div><span class="learn-demo-badge">ISOLATED DEMO</span></div>
      <p>This is the actual simulator, with a fresh policy and world seed 18. Step through its decisions without changing your specimen or training job.</p>
      <div class="learn-demo-controls"><button type="button" data-learn-step>Advance 1 tick <span aria-hidden="true">→</span></button><button type="button" data-learn-reset>Reset demo</button><label><input type="checkbox" data-learn-learning ${this.learning ? 'checked' : ''}>Apply learning</label></div>
      <p class="learn-demo-help">Switching learning resets the demo. Off means frozen weights, zero exploration, and no distance shaping; equal action scores still use seeded random tie-breaking.</p>
      <div class="learn-demo-output" aria-live="polite" aria-atomic="true"></div>
      <details class="learn-demo-json"><summary>Inspect the observation and encoded features</summary><pre tabindex="0"><code></code></pre></details>`;
    this.renderDemo();
  }

  renderDemo() {
    const root = this.el.querySelector('[data-learn-inspector]');
    if (!root) return;
    const episode = this.demo, last = this.lastStep;
    root.querySelector('[data-learn-step]').disabled = episode.done;
    const output = root.querySelector('.learn-demo-output');
    output.innerHTML = `<dl class="learn-demo-stats"><div><dt>Simulation tick</dt><dd>${episode.tick} <small>/ ${episode.maxTicks}</small></dd></div><div><dt>Elapsed time</dt><dd>${episode.t.toFixed(2)} <small>s</small></dd></div><div><dt>Executed action</dt><dd>${last ? actions[last.action] : 'Awaiting first tick'}</dd></div><div><dt>Weights changed</dt><dd>${last?.changed || 0} <small>/ 270</small></dd></div></dl>
      ${last ? `<div class="learn-tick-result"><div><span>Reward received</span><strong>${signed(episode.reward)}</strong></div><p>−0.015 tick cost ${last.collision ? '− 0.120 collision' : '+ 0 collision'} ${last.arrival ? '+ 8.000 arrival' : '+ 0 arrival'} ${episode.training ? `${last.shaping >= 0 ? '+' : '−'} ${Math.abs(last.shaping).toFixed(6)} progress` : '+ 0 shaping (evaluation)'}</p><div><span>TD error δ</span><strong>${signed(last.delta)}</strong></div><p>${episode.training ? `Applied to eligible weights at learning rate 0.025 / ${last.features.length}.` : 'Shown for inspection only. No learning update was applied.'}</p></div>
      <table class="learn-table"><caption>Q scores for the previous observation, before and after this tick’s update</caption><thead><tr><th>Action</th><th>Before</th><th>After</th></tr></thead><tbody>${actions.map((action, index) => `<tr${index === last.action ? ' class="learn-chosen"' : ''}><th scope="row">${action}${index === last.action ? ' · executed' : ''}</th><td>${signed(last.beforeScores[index])}</td><td>${signed(last.afterScores[index])}</td></tr>`).join('')}</tbody></table><p class="learn-demo-help">The next action was chosen before this update: <strong>${actions[episode.action]}</strong>. ${episode.done ? 'This episode has ended, so that action will not execute. Reset to start again.' : `It will execute on the next ${DT}-second tick.`}</p>` : '<p class="learn-demo-ready">All 270 weights start at zero. Advance a tick to see how a real reward changes the policy.</p>'}`;
    root.querySelector('.learn-demo-json code').textContent = JSON.stringify({ observation: episode.observations,
      encodedFeatures: episode.features, ...(last ? { executedFeatures: last.features } : {}),
      pendingAction: episode.action, learningEnabled: episode.training }, null, 2);
  }
}
