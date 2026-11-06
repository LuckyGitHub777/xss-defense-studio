import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../app.js', import.meta.url), 'utf8');

test('offline, same-origin HTML contract', () => {
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  for (const directive of ["default-src 'none'", "script-src 'self'", "style-src 'self'", "connect-src 'none'", "form-action 'none'"]) {
    assert.ok(html.includes(directive), directive);
  }
  assert.match(html, /src="\.\/app\.js"/);
  assert.match(html, /href="\.\/styles\.css"/);
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//i);
  assert.doesNotMatch(html, /<script(?![^>]*src=)[^>]*>/i);
});

test('DOM interactions avoid dangerous sinks and network clients', () => {
  assert.match(js, /output\.textContent\s*=\s*input\.value/);
  assert.doesNotMatch(js, /\.(?:innerHTML|outerHTML)\s*=/);
  assert.doesNotMatch(js, /insertAdjacentHTML\s*\(/);
  assert.doesNotMatch(js, /\b(?:eval|Function|fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/);
  assert.doesNotMatch(js, /sendBeacon\s*\(/);
});

test('accessibility and motion controls exist', () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(css, /@media \(max-width:760px\)/);
});

test('safe output, switcher, answer and reset work in a synthetic DOM', () => {
  class Element {
    constructor({value = '', dataset = {}} = {}) {
      this.value = value;
      this.dataset = dataset;
      this.textContent = '';
      this.listeners = {};
      this.attributes = {};
      this.focused = false;
    }
    addEventListener(name, handler) { this.listeners[name] = handler; }
    fire(name) { assert.equal(typeof this.listeners[name], 'function'); this.listeners[name](); }
    setAttribute(name, value) { this.attributes[name] = value; }
    focus() { this.focused = true; }
  }
  const selectors = [
    '#untrusted', '#rendered', '#character-count', '#render-status', '#render-button', '#reset-button',
    '#context-index', '#context-heading', '#context-description', '#context-note', '#url-candidate', '#url-check', '#url-result', '#answer-feedback'
  ];
  const els = Object.fromEntries(selectors.map(s => [s, new Element()]));
  els['#untrusted'].value = '<em>Hello, world.</em>';
  const contextButtons = ['text', 'attribute', 'url'].map(context => new Element({dataset: {context}}));
  const answers = ['markup', 'text'].map(answer => new Element({dataset: {answer}}));
  const document = {
    querySelector: selector => {
      assert.ok(els[selector], selector);
      return els[selector];
    },
    querySelectorAll: selector => {
      if (selector === '[data-context]') return contextButtons;
      if (selector === '[data-answer]') return answers;
      throw new Error('Unexpected selector: ' + selector);
    }
  };
  runInNewContext(js, {document, URL}, {timeout: 1000});
  assert.equal(els['#rendered'].textContent, '<em>Hello, world.</em>');
  assert.equal(els['#character-count'].textContent, String(els['#untrusted'].value.length) + ' / 1200');
  els['#untrusted'].value = '<strong>Displayed literally</strong>';
  els['#untrusted'].fire('input');
  els['#render-button'].fire('click');
  assert.equal(els['#rendered'].textContent, '<strong>Displayed literally</strong>');
  contextButtons[2].fire('click');
  assert.equal(els['#context-index'].textContent, 'CONTEXT 03 / 03');
  assert.equal(contextButtons[2].attributes['aria-pressed'], 'true');
  assert.equal(contextButtons[0].attributes['aria-pressed'], 'false');
  els['#url-candidate'].value = 'https://developer.mozilla.org/en-US/docs/Web/Security';
  els['#url-check'].fire('click');
  assert.match(els['#url-result'].textContent, /^Allowed/);
  for (const bad of [
    'javascript:alert(1)',
    'data:text/html,example',
    'http://developer.mozilla.org/',
    'https://developer.mozilla.org.evil.example/',
    'https://developer.mozilla.org@evil.example/',
    'https://someone@developer.mozilla.org/',
    '//developer.mozilla.org/',
    'not a URL'
  ]) {
    els['#url-candidate'].value = bad;
    els['#url-check'].fire('click');
    assert.match(els['#url-result'].textContent, /^Blocked/, bad);
  }
  answers[1].fire('click');
  assert.match(els['#answer-feedback'].textContent, /^Correct/);
  answers[0].fire('click');
  assert.match(els['#answer-feedback'].textContent, /^Try the other/);
  els['#reset-button'].fire('click');
  assert.equal(els['#rendered'].textContent, '<em>Hello, world.</em>');
  assert.equal(els['#untrusted'].focused, true);
});
