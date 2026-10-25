const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const STORAGE = 'nube.study.v1';
const normalize = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch { /* Start clean if storage is unavailable. */ }
const state = { language: 'es', exam: '', current: {}, attempts: {}, bookmarks: {}, ...saved, filter: 'all', query: '', selected: [], revealed: false, checked: false, questions: [], filtered: [], mapPage: 0, loadVersion: 0 };
let manifest;
let storageAvailable = true;
const pendingTranslations = new Map();
const translationErrors = new Map();
const discussions = new Map();
function persist() {
  const { language, exam, current, attempts, bookmarks } = state;
  try { localStorage.setItem(STORAGE, JSON.stringify({ language, exam, current, attempts, bookmarks })); }
  catch { if (storageAvailable) { $('.sidebar-bottom small').textContent = 'No se pudo guardar el progreso'; $('#storage-notice').hidden = false; storageAvailable = false; } }
}
const currentQuestion = () => state.questions.find(q => q.id === state.current[state.exam]);
const questionKey = (q) => `${state.exam}:${q.id}`;
const isBookmarked = (q) => !!state.bookmarks[questionKey(q)];
const attempt = (q) => state.attempts[questionKey(q)];
const languageText = (q, english, spanish) => state.language === 'en' ? english : (q.es ? spanish : english);
function ensureTranslation(q) {
  if (q.es || state.language === 'en') return;
  const exam = state.exam;
  const key = `${exam}:${q.id}`;
  if (pendingTranslations.has(key) || translationErrors.has(key)) return;
  pendingTranslations.set(key, true);
  (async () => {
    try {
      const response = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exam, question: q.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo traducir esta pregunta.');
      if (typeof data.stem !== 'string' || !data.stem.trim() || !Array.isArray(data.choices) || data.choices.length !== q.choices.length || data.choices.some(text => typeof text !== 'string' || !text.trim())) throw new Error('La traducción recibida está incompleta.');
      q.es = data;
      if (state.exam === exam) { const current = state.questions.find(item => item.id === q.id); if (current) current.es = data; }
    } catch (error) { translationErrors.set(key, error.message); }
    finally { pendingTranslations.delete(key); if (state.exam === exam && currentQuestion()?.id === q.id) renderQuestion(currentQuestion()); }
  })();
}
function element(tag, className, text) { const el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; }
function isMatch(q) {
  const status = attempt(q)?.correct;
  if (state.filter === 'bookmarked' && !isBookmarked(q)) return false;
  if (state.filter === 'incorrect' && status !== false) return false;
  const text = [q.number, q.stem, ...q.choices.map(c => c.text), q.es?.stem || '', ...(q.es?.choices || [])].join(' ');
  return !state.query || normalize(text).includes(normalize(state.query));
}
function updateFilters({ preserve = true } = {}) {
  state.filtered = state.questions.filter(isMatch);
  if (!preserve || !state.filtered.some(q => q.id === state.current[state.exam])) state.current[state.exam] = state.filtered[0]?.id;
  state.mapPage = Math.floor(Math.max(0, state.filtered.findIndex(q => q.id === state.current[state.exam])) / 30);
  resetAnswer();
  persist();
  render();
}
function resetAnswer() { state.selected = []; state.revealed = false; state.checked = false; $('#discussion-details').open = false; }
async function loadExam(id) {
  const version = ++state.loadVersion;
  state.exam = id;
  state.query = ''; $('#search').value = ''; state.filter = 'all';
  $('#loading').hidden = false; $('#loading').textContent = 'Cargando preguntas…'; $('#load-retry').hidden = true; $('#source-link').hidden = true; $('#bookmark').hidden = true; $('#question-content').hidden = true; $('#empty-state').hidden = true;
  $('#question-card').setAttribute('aria-busy', 'true');
  $('#question-number').textContent = '';
  try {
    const response = await fetch(`data/${encodeURIComponent(id)}.json`, { cache: 'no-cache' });
    if (!response.ok) throw new Error('No se pudo abrir el archivo de preguntas.');
    const data = await response.json();
    if (version !== state.loadVersion) return;
    state.questions = data.questions;
    updateFilters();
  } catch (error) { if (version === state.loadVersion) { $('#loading').textContent = 'No se pudieron cargar las preguntas. Comprueba tu conexión y vuelve a intentarlo.'; $('#load-retry').hidden = false; $('#question-card').setAttribute('aria-busy', 'false'); } }
}
function render() {
  const exam = manifest.exams.find(e => e.id === state.exam);
  document.title = `${exam.name} — Nube`;
  $('#exam-name').textContent = exam.name; $('#breadcrumb-name').textContent = exam.name; $('#exam-code').textContent = exam.code;
  $('#loading').hidden = true; $('#question-card').setAttribute('aria-busy', 'false');
  $$('.recommended-exam').forEach(b => b.classList.toggle('active', b.dataset.exam === state.exam));
  $$('[data-filter]').forEach(b => { const active = b.dataset.filter === state.filter; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
  $$('[data-language]').forEach(b => { const active = b.dataset.language === state.language; b.classList.toggle('active', active); b.setAttribute('aria-pressed', String(active)); });
  const practiced = state.questions.filter(q => attempt(q));
  const correct = practiced.filter(q => attempt(q).correct).length;
  $('#all-count').textContent = exam.count; $('#bookmarked-count').textContent = state.questions.filter(isBookmarked).length;
  $('#incorrect-count').textContent = practiced.length - correct;
  $('#answered-count').textContent = practiced.length; $('#progress-denominator').textContent = `/ ${exam.count} practicadas`;
  $('#correct-count').textContent = correct; $('#review-count').textContent = practiced.length - correct;
  $('#mobile-progress').textContent = `${practiced.length} practicadas · ${correct} acertadas`;
  const percent = Math.round(practiced.length / exam.count * 100);
  $('#progress-fill').style.width = `${percent}%`;
  $('#study-progress').setAttribute('aria-valuenow', String(percent));
  $('#study-progress').setAttribute('aria-valuetext', `${practiced.length} de ${exam.count} preguntas practicadas`);
  $('#encouragement').textContent = practiced.length ? `Ya has dado ${practiced.length} ${practiced.length === 1 ? 'paso' : 'pasos'}. Sigue a tu ritmo.` : 'Comprueba una respuesta para empezar a registrar tu progreso.';
  $('#result-count').textContent = state.query || state.filter !== 'all' ? `${state.filtered.length} de ${exam.count} preguntas` : `${exam.count} preguntas para explorar`;
  const q = currentQuestion();
  const hasQuestion = q && state.filtered.some(item => item.id === q.id);
  $('#empty-state').hidden = !!hasQuestion; $('#question-content').hidden = !hasQuestion;
  $('#bookmark').hidden = !hasQuestion; $('#source-link').hidden = !hasQuestion;
  if (!hasQuestion) $('#empty-message').textContent = state.filter === 'bookmarked' ? 'Marca preguntas con la estrella y las encontrarás aquí.' : state.filter === 'incorrect' ? 'Aquí aparecerán las preguntas que necesiten un repaso después de comprobar tus respuestas.' : 'Prueba con otro término o quita los filtros.';
  const position = state.filtered.findIndex(item => item.id === q?.id);
  $('#navigation-position').textContent = hasQuestion ? `${position + 1} de ${state.filtered.length}` : '0 preguntas';
  $('#previous').disabled = position <= 0; $('#next').disabled = position < 0 || position >= state.filtered.length - 1;
  $('#shuffle').disabled = state.filtered.length < 2;
  if (hasQuestion) renderQuestion(q);
  renderMap();
}
function renderQuestion(q) {
  ensureTranslation(q);
  $('#question-number').textContent = `Pregunta ${q.number}`;
  $('#bookmark').textContent = isBookmarked(q) ? '★' : '☆'; $('#bookmark').setAttribute('aria-pressed', String(isBookmarked(q))); $('#bookmark').setAttribute('aria-label', isBookmarked(q) ? 'Quitar de marcadas' : 'Marcar pregunta');
  const stem = $('#question-stem'); stem.replaceChildren();
  stem.append(element('div', '', languageText(q, q.stem, q.es?.stem)));
  if (state.language === 'both' && q.es) { const original = element('div', 'parallel-english'); original.append(element('span', 'parallel-label', 'ENGLISH · ORIGINAL'), document.createTextNode(q.stem)); stem.append(original); }
  $('#translation-notice').hidden = state.language === 'en' || !!q.es;
  $('#translation-notice').textContent = translationErrors.get(questionKey(q)) || 'Preparando la traducción en español… Mientras tanto, puedes consultar el original en inglés.';
  $('#translation-retry').hidden = state.language === 'en' || !!q.es || !translationErrors.has(questionKey(q));
  $('#translation-label').textContent = state.language === 'en' ? 'Original en inglés · Banco de la comunidad' : 'Traducción automática de estudio · No oficial';
  const images = $('#question-images'); images.replaceChildren();
  for (const url of q.images) {
    if (!/^https:\/\//.test(url)) continue;
    const image = element('img'); image.src = url; image.alt = 'Imagen del enunciado original'; image.loading = 'lazy';
    image.addEventListener('error', () => { const link = element('a', 'image-link', 'Consultar la imagen en la fuente ↗'); link.href = q.source; link.target = '_blank'; link.rel = 'noopener noreferrer'; image.replaceWith(link); });
    images.append(image);
  }
  $('#selection-hint').textContent = !q.choices.length ? 'La fuente no incluye opciones para esta pregunta.' : q.answers.length > 1 ? `Selecciona ${q.answers.length} respuestas.` : 'Selecciona una respuesta.';
  const choices = $('#choices'); choices.replaceChildren();
  q.choices.forEach((choice, index) => {
    const button = element('button', 'choice'); button.type = 'button'; button.dataset.choice = choice.key;
    const selected = state.selected.includes(choice.key);
    const showAnswer = state.checked || state.revealed;
    button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected));
    button.disabled = showAnswer;
    button.append(element('span', 'choice-letter', choice.key));
    const body = element('span', 'choice-body', languageText(q, choice.text, q.es?.choices[index]));
    if (state.language === 'both' && q.es) body.append(element('span', 'choice-english', choice.text));
    button.append(body);
    if (showAnswer && q.answers.includes(choice.key)) { button.classList.add('correct'); button.append(element('span', 'choice-status', '✓')); }
    else if (showAnswer && selected) { button.classList.add('incorrect'); button.append(element('span', 'choice-status', '×')); }
    button.addEventListener('click', () => {
      if (q.answers.length > 1) state.selected = selected ? state.selected.filter(key => key !== choice.key) : [...state.selected, choice.key];
      else state.selected = [choice.key];
      renderQuestion(q);
      choices.querySelector(`[data-choice="${choice.key}"]`)?.focus({ preventScroll: true });
    });
    choices.append(button);
  });
  $('#check-answer').hidden = state.checked || state.revealed;
  $('#check-answer').disabled = !q.answers.length || state.selected.length !== q.answers.length;
  $('#reveal-answer').hidden = state.checked || state.revealed || !q.answers.length;
  $('#retry').hidden = !state.checked && !state.revealed;
  $('#source-link').href = /^https:\/\//.test(q.source) ? q.source : '#';
  const feedback = $('#feedback'); feedback.hidden = !state.checked && !state.revealed && q.answers.length > 0;
  feedback.className = 'feedback';
  if (!q.answers.length) { feedback.classList.add('revealed'); feedback.textContent = 'La fuente no incluye una respuesta que se pueda comprobar. Puedes consultar el enlace original.'; }
  else if (state.revealed) { feedback.classList.add('revealed'); feedback.textContent = `Respuesta de la fuente: ${q.answers.join(', ')}. Verla no cuenta como pregunta practicada.`; }
  else if (state.checked) { const correct = attempt(q)?.correct; feedback.classList.toggle('incorrect', !correct); feedback.textContent = correct ? '¡Bien! Tu respuesta coincide con la fuente.' : `Una más para repasar. Respuesta de la fuente: ${q.answers.join(', ')}.`; }
  renderDiscussion(q);
}
function renderDiscussion(q) {
  const panel = $('#discussion');
  panel.hidden = !q.discussionCount || (!state.checked && !state.revealed);
  if (panel.hidden) return;
  const key = questionKey(q);
  const details = $('#discussion-details');
  if (details.dataset.question !== key) { details.open = false; details.dataset.question = key; }
  $('#discussion-summary').textContent = `Ver comentarios (${q.discussionCount})`;
  $('#discussion-language').textContent = state.language === 'en' ? 'Comentarios en su idioma original. Las respuestas a otros comentarios se indican debajo del autor.' : 'Comentarios originales de la comunidad. Puedes traducir cada uno al español; la traducción es automática.';
  const list = $('#discussion-comments'); list.replaceChildren();
  const status = $('#discussion-status'); status.hidden = true;
  const more = $('#discussion-more'); more.hidden = true;
  if (!details.open) return;
  let entry = discussions.get(key);
  if (!entry) {
    entry = { loading: true, comments: [], visible: 5 }; discussions.set(key, entry);
    const exam = state.exam;
    (async () => {
      try {
        const response = await fetch(`data/discussions/${encodeURIComponent(exam)}/${q.id}.json`, { cache: 'no-cache' });
        if (!response.ok) throw new Error('No se pudieron cargar los comentarios.');
        const data = await response.json(); entry.comments = data.comments;
      } catch { entry.error = 'No se pudieron cargar los comentarios. Puedes volver a intentarlo o consultar la fuente.'; }
      finally { entry.loading = false; if (state.exam === exam && currentQuestion()?.id === q.id) renderDiscussion(currentQuestion()); }
    })();
  }
  if (entry.loading || entry.error) {
    status.hidden = false; status.textContent = entry.error || 'Cargando el debate…';
    more.hidden = !entry.error; more.textContent = 'Reintentar carga'; return;
  }
  entry.comments.slice(0, entry.visible).forEach(comment => {
    const card = element('article', 'discussion-comment'); card.dataset.comment = comment.id;
    const header = element('header', 'comment-heading');
    const author = element('div'); author.append(element('strong', '', comment.author));
    if (comment.replyTo) author.append(element('span', 'comment-reply', `En respuesta a ${comment.replyTo}`));
    header.append(author, element('span', 'comment-votes', `↑ ${comment.votes} ${comment.votes === 1 ? 'voto' : 'votos'}`)); card.append(header);
    const showSpanish = state.language !== 'en' && comment.es;
    card.append(element('p', 'comment-content', showSpanish ? comment.es : comment.text));
    if (showSpanish) card.append(element('span', 'comment-translation-label', 'Traducción automática'));
    if (comment.es && (state.language === 'both' || comment.showOriginal) && state.language !== 'en') {
      const original = element('div', 'comment-original'); original.append(element('span', 'parallel-label', 'ORIGINAL'), element('p', 'comment-content', comment.text)); card.append(original);
    }
    if (state.language !== 'en') {
      const actions = element('div', 'comment-actions');
      if (!comment.es) {
        const translate = element('button', 'text-button', comment.translating ? 'Traduciendo…' : comment.error ? 'Reintentar traducción' : 'Traducir al español');
        translate.disabled = !!comment.translating;
        translate.addEventListener('click', () => translateComment(q, comment)); actions.append(translate);
        if (comment.error) actions.append(element('span', 'comment-error', comment.error));
      } else if (state.language !== 'both') {
        const original = element('button', 'text-button', comment.showOriginal ? 'Ocultar original' : 'Ver original');
        original.addEventListener('click', () => { comment.showOriginal = !comment.showOriginal; renderDiscussion(q); }); actions.append(original);
      }
      card.append(actions);
    }
    list.append(card);
  });
  more.hidden = entry.visible >= entry.comments.length;
  more.textContent = `Mostrar más comentarios (${Math.max(0, entry.comments.length - entry.visible)} restantes)`;
}
async function translateComment(q, comment) {
  const exam = state.exam;
  if (comment.translating) return;
  comment.translating = true; comment.error = null; renderDiscussion(q);
  try {
    const response = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exam, question: q.id, comment: comment.id }) });
    const data = await response.json();
    if (!response.ok || typeof data.text !== 'string' || !data.text.trim()) throw new Error('No se pudo traducir. El original sigue disponible.');
    comment.es = data.text;
  } catch { comment.error = 'No se pudo traducir. El original sigue disponible.'; }
  finally { comment.translating = false; if (state.exam === exam && currentQuestion()?.id === q.id) renderDiscussion(currentQuestion()); }
}
function renderMap() {
  const start = state.mapPage * 30;
  $('#map-range').textContent = state.filtered.length ? `${start + 1}–${Math.min(start + 30, state.filtered.length)}` : '0';
  $('#map-previous').disabled = state.mapPage === 0; $('#map-next').disabled = start + 30 >= state.filtered.length;
  $('#jump').max = state.questions.length;
  const grid = $('#question-grid'); grid.replaceChildren();
  state.filtered.slice(start, start + 30).forEach(q => {
    const button = element('button', 'question-cell', q.number);
    button.classList.toggle('current', q.id === state.current[state.exam]);
    button.classList.toggle('done', attempt(q)?.correct === true); button.classList.toggle('missed', attempt(q)?.correct === false); button.classList.toggle('saved', isBookmarked(q));
    button.setAttribute('aria-label', `Pregunta ${q.number}${attempt(q) ? (attempt(q).correct ? ', acertada' : ', para repasar') : ''}${isBookmarked(q) ? ', marcada' : ''}`);
    if (q.id === state.current[state.exam]) button.setAttribute('aria-current', 'true');
    button.addEventListener('click', () => navigateTo(q)); grid.append(button);
  });
}
function navigateTo(q) {
  if (!q) return;
  state.current[state.exam] = q.id; resetAnswer();
  state.mapPage = Math.floor(state.filtered.findIndex(item => item.id === q.id) / 30);
  persist(); render();
  $('#question-card').focus({ preventScroll: true });
  if (compactStudy.matches) { $('#progress-dialog').close(); $('#question-card').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }); }
}
function move(delta) { const index = state.filtered.findIndex(q => q.id === state.current[state.exam]); navigateTo(state.filtered[index + delta]); }
function showLibrary() { if (!manifest) return; $('#exam-search').value = ''; renderLibrary(); $('#library-dialog').showModal(); if (matchMedia('(pointer: fine)').matches) $('#exam-search').focus(); }
function renderLibrary() {
  const query = normalize($('#exam-search').value);
  const list = $('#exam-list'); list.replaceChildren();
  manifest.exams.filter(e => normalize(`${e.name} ${e.code}`).includes(query)).forEach(exam => {
    const button = element('button', 'exam-option'); button.classList.toggle('active', exam.id === state.exam);
    button.append(element('span', 'exam-option-code', exam.code), element('strong', '', exam.name), element('span', '', `${exam.count.toLocaleString('es-ES')} preguntas · ${exam.translated === exam.count ? 'EN / ES' : 'EN · ES al consultar'}`));
    button.addEventListener('click', () => { $('#library-dialog').close(); loadExam(exam.id); }); list.append(button);
  });
  if (!list.children.length) list.append(element('p', 'no-exams', 'No se encontraron certificaciones.'));
}
// Keep a single progress/map panel, in the sidebar on desktop and a modal on touch layouts.
const compactStudy = matchMedia('(max-width: 1150px)');
const studyAside = $('.study-aside');
const studyAsideHome = studyAside.parentElement;
function placeStudyPanel() {
  if (compactStudy.matches) $('#mobile-study-panel').append(studyAside);
  else { $('#progress-dialog').close(); studyAsideHome.append(studyAside); }
}
placeStudyPanel();
compactStudy.addEventListener('change', placeStudyPanel);
$('#study-overview').addEventListener('click', () => $('#progress-dialog').showModal());
$('#close-progress').addEventListener('click', () => $('#progress-dialog').close());
for (const dialog of [$('#progress-dialog'), $('#library-dialog')]) {
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
}
document.querySelectorAll('[data-library-trigger]').forEach(button => button.addEventListener('click', showLibrary));
$('#library-button').addEventListener('click', showLibrary); $('#change-exam').addEventListener('click', showLibrary);
$('#close-library').addEventListener('click', () => $('#library-dialog').close());
$('#exam-search').addEventListener('input', renderLibrary);
$('#search').addEventListener('input', event => { state.query = event.target.value; updateFilters(); });
$$('[data-language]').forEach(button => button.addEventListener('click', () => { state.language = button.dataset.language; persist(); render(); }));
$$('[data-filter]').forEach(button => button.addEventListener('click', () => { state.filter = button.dataset.filter; updateFilters({ preserve: false }); }));
$('#clear-filters').addEventListener('click', () => { state.filter = 'all'; state.query = ''; $('#search').value = ''; updateFilters(); });
$('#bookmark').addEventListener('click', () => { const q = currentQuestion(); if (!q) return; const key = questionKey(q); if (state.bookmarks[key]) delete state.bookmarks[key]; else state.bookmarks[key] = true; persist(); if (state.filter === 'bookmarked') updateFilters(); else render(); });
$('#check-answer').addEventListener('click', () => {
  const q = currentQuestion(); if (!q || !q.answers.length || state.selected.length !== q.answers.length) return;
  state.checked = true; state.attempts[questionKey(q)] = { selected: [...state.selected], correct: q.answers.every(key => state.selected.includes(key)) }; persist(); render();
});
$('#reveal-answer').addEventListener('click', () => { state.revealed = true; render(); });
$('#retry').addEventListener('click', () => { resetAnswer(); render(); });
$('#translation-retry').addEventListener('click', () => { const q = currentQuestion(); if (q) { translationErrors.delete(questionKey(q)); renderQuestion(q); } });
$('#discussion-details').addEventListener('toggle', () => { const q = currentQuestion(); if ($('#discussion-details').open && q) renderDiscussion(q); });
$('#discussion-more').addEventListener('click', () => { const q = currentQuestion(); if (!q) return; const key = questionKey(q); const entry = discussions.get(key); if (entry?.error) discussions.delete(key); else if (entry) entry.visible += 5; renderDiscussion(q); });
$('#previous').addEventListener('click', () => move(-1)); $('#next').addEventListener('click', () => move(1));
$('#shuffle').addEventListener('click', () => { const pool = state.filtered.filter(q => q.id !== state.current[state.exam]); navigateTo(pool[Math.floor(Math.random() * pool.length)]); });
$('#map-previous').addEventListener('click', () => { if (state.mapPage > 0) { state.mapPage--; renderMap(); } });
$('#map-next').addEventListener('click', () => { if ((state.mapPage + 1) * 30 < state.filtered.length) { state.mapPage++; renderMap(); } });
$('#jump-form').addEventListener('submit', event => {
  event.preventDefault();
  const input = $('#jump');
  const question = state.questions.find(q => q.number === Number(input.value));
  if (!question) return;
  state.query = ''; state.filter = 'all'; $('#search').value = ''; state.filtered = [...state.questions];
  navigateTo(question); input.value = '';
});
$('#load-retry').addEventListener('click', () => {
  if (manifest && state.exam) loadExam(state.exam);
  else init().catch(showLoadError);
});
document.addEventListener('keydown', event => { if ($('#library-dialog').open || $('#progress-dialog').open || /INPUT|TEXTAREA|SELECT|BUTTON/.test(event.target.tagName) || event.ctrlKey || event.metaKey || event.altKey) return; if (event.key === 'ArrowRight') { event.preventDefault(); move(1); } if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); } });
async function init() {
  const response = await fetch('data/manifest.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error('No se pudo abrir la biblioteca.');
  manifest = await response.json();
  if (!['en', 'es', 'both'].includes(state.language)) state.language = 'es';
  $('#exam-count').textContent = manifest.exams.length;
  $('#library-button').disabled = false; $('#change-exam').disabled = false; document.querySelectorAll('[data-library-trigger]').forEach(button => { button.disabled = false; });
  const recommended = $('#recommended'); recommended.replaceChildren();
  manifest.exams.slice(0, 3).forEach((exam, index) => {
    const button = element('button', 'recommended-exam'); button.dataset.exam = exam.id;
    button.append(element('span', 'exam-symbol', exam.code.split('-')[0]));
    const info = element('span'); info.append(element('strong', '', exam.name), element('small', '', exam.code)); button.append(info);
    button.addEventListener('click', () => loadExam(exam.id)); recommended.append(button);
  });
  await loadExam(manifest.exams.some(e => e.id === state.exam) ? state.exam : manifest.exams[0].id);
}
function showLoadError() { $('#loading').textContent = 'No se pudo cargar la biblioteca. Comprueba tu conexión y vuelve a intentarlo.'; $('#load-retry').hidden = false; $('#question-card').setAttribute('aria-busy', 'false'); }
init().catch(showLoadError);
