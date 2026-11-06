'use strict';

// Offline educational preview. User-supplied text never becomes markup.
const example = '<em>Hello, world.</em>';
const input = document.querySelector('#untrusted');
const output = document.querySelector('#rendered');
const count = document.querySelector('#character-count');
const status = document.querySelector('#render-status');
const renderButton = document.querySelector('#render-button');
const resetButton = document.querySelector('#reset-button');

function updateCount() {
  count.textContent = String(input.value.length) + ' / 1200';
}

function renderAsText() {
  // This is the essential invariant of the interactive demonstration.
  output.textContent = input.value;
  status.textContent = 'Rendered as plain text. Nothing was interpreted as HTML.';
}

input.addEventListener('input', updateCount);
renderButton.addEventListener('click', renderAsText);
resetButton.addEventListener('click', () => {
  input.value = example;
  updateCount();
  renderAsText();
  input.focus();
});
updateCount();
renderAsText();

const contexts = Object.freeze({
  text: {
    number: 'CONTEXT 01 / 03',
    title: 'Render text, not markup.',
    description: 'For plain text in the DOM, use textContent or an equivalent safe API. Untrusted input is displayed without becoming HTML.',
    note: 'Rule: never route plain text through an HTML parser.'
  },
  attribute: {
    number: 'CONTEXT 02 / 03',
    title: 'The attribute changes the rule.',
    description: 'Use purpose-built DOM properties and attributes with context-appropriate validation. Never insert unchecked input into an event handler or executable attribute.',
    note: 'Rule: choose safe properties, not string-built markup.'
  },
  url: {
    number: 'CONTEXT 03 / 03',
    title: 'A destination deserves scrutiny.',
    description: 'Validate an intended URL scheme and destination before assigning it to a navigation property. Encoding alone is not an authorization or safe-URL policy.',
    note: 'Rule: check the destination and allowed scheme before use.'
  }
});
const contextButtons = [...document.querySelectorAll('[data-context]')];
const contextIndex = document.querySelector('#context-index');
const contextHeading = document.querySelector('#context-heading');
const contextDescription = document.querySelector('#context-description');
const contextNote = document.querySelector('#context-note');

function selectContext(key) {
  const item = contexts[key];
  if (!item) return;
  contextIndex.textContent = item.number;
  contextHeading.textContent = item.title;
  contextDescription.textContent = item.description;
  contextNote.textContent = item.note;
  for (const button of contextButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.context === key));
  }
}
for (const button of contextButtons) {
  button.addEventListener('click', () => selectContext(button.dataset.context));
}

// A deliberately narrow example policy. No link is created and no request is made.
const urlCandidate = document.querySelector('#url-candidate');
const urlButton = document.querySelector('#url-check');
const urlResult = document.querySelector('#url-result');

function matchesExampleURLPolicy(raw) {
  if (typeof raw !== 'string' || !raw.trim() || raw.length > 500) return false;
  try {
    const destination = new URL(raw.trim());
    return destination.protocol === 'https:'
      && destination.hostname === 'developer.mozilla.org'
      && destination.username === ''
      && destination.password === ''
      && destination.port === '';
  } catch {
    return false;
  }
}
urlButton.addEventListener('click', () => {
  const allowed = matchesExampleURLPolicy(urlCandidate.value);
  urlResult.textContent = allowed
    ? 'Allowed by this example policy. No link was opened and no request was sent.'
    : 'Blocked by this example policy. Require exact HTTPS hostname and no embedded credentials.';
});

const feedback = document.querySelector('#answer-feedback');
const answerButtons = [...document.querySelectorAll('[data-answer]')];
for (const button of answerButtons) {
  button.addEventListener('click', () => {
    const correct = button.dataset.answer === 'text';
    for (const option of answerButtons) {
      option.setAttribute('aria-pressed', String(option === button));
    }
    feedback.textContent = correct
      ? 'Correct. textContent treats a visitor’s plain text as data, not HTML.'
      : 'Try the other option. innerHTML parses a string as HTML and is not the safe default for untrusted plain text.';
  });
}
