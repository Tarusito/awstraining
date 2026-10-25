const $ = selector => document.querySelector(selector);
const normalize = text => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const node = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text != null) el.textContent = text; return el; };
const query = new URLSearchParams(location.search);
const state = { query: query.get('q') || '', category: query.get('category') || '', certification: query.get('cert') || '', mode: query.get('essential') === '1' ? 'essential' : 'all', sort: 'relevance', page: 0 };
let catalog;
let certifications = [];
let saved = new Set();
try { const stored = JSON.parse(localStorage.getItem('nube.services.saved.v1') || '[]'); if (Array.isArray(stored)) saved = new Set(stored); } catch { /* Bookmarks are optional. */ }
const PAGE_SIZE = 24;
const categoryColors = ['#216757','#5c7798','#8c6d9c','#b7894f','#5e8b86','#968453','#6582a5','#b17a80'];
function updateUrl() {
  const params = new URLSearchParams();
  if (state.query) params.set('q', state.query);
  if (state.category) params.set('category', state.category);
  if (state.certification) params.set('cert', state.certification);
  if (state.mode === 'essential') params.set('essential', '1');
  history.replaceState(null, '', location.pathname + (params.size ? `?${params}` : ''));
}
function clearFilters() { state.query = ''; state.category = ''; state.certification = ''; state.mode = 'all'; state.page = 0; $('#service-search').value = ''; $('#category-select').value = ''; renderCategories(); render(); }
function setMode(mode) { state.mode = mode; state.page = 0; render(); }
function selectedCertification() { return certifications.find(group => group.id === state.certification); }
function certificationEntries() {
  const group = selectedCertification();
  return group ? catalog.entries.filter(entry => group.serviceIds.has(entry.id)) : catalog.entries;
}
function selectCertification(id) {
  state.certification = id;
  state.mode = 'all';
  state.page = 0;
  renderCategories();
  render();
  if (matchMedia('(max-width: 760px)').matches) $('#certification-groups').open = false;
}
function renderCertificationControls() {
  const priorities = $('#priority-certifications'); priorities.replaceChildren();
  const selector = $('#certification-select'); selector.replaceChildren(new Option('Todo el catálogo', ''));
  const sections = [
    ['Tus prioridades', certifications.filter(group => group.priority)],
    ['Otras guías oficiales', certifications.filter(group => !group.priority && group.basis === 'official')],
    ['Versiones del banco local · menciones en preguntas', certifications.filter(group => group.basis === 'bank')],
  ];
  for (const [label, groups] of sections) {
    const options = document.createElement('optgroup'); options.label = label;
    for (const group of groups) {
      options.append(new Option(`${group.name} · ${group.code} (${group.services.length})`, group.id));
      if (!group.priority) continue;
      const button = node('button', 'priority-certification'); button.dataset.certification = group.id;
      const heading = node('span', 'priority-certification-heading');
      heading.append(node('span', '', group.code), node('span', 'certification-count', `${group.services.length} fichas`));
      button.append(heading, node('strong', '', group.name));
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => selectCertification(group.id)); priorities.append(button);
    }
    if (groups.length) selector.append(options);
  }
  selector.disabled = false;
}
function renderCertificationSummary() {
  const group = selectedCertification();
  $('#certification-select').value = group?.id || '';
  $('#certification-current').textContent = group ? `${group.code} · ${group.name}` : 'Todo el catálogo';
  $('#certification-all').hidden = !group;
  $('#certification-summary').hidden = !group;
  $('#filter-essential').hidden = !!group;
  for (const button of document.querySelectorAll('.priority-certification')) {
    const active = button.dataset.certification === state.certification;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  }
  if (!group) return;
  $('#certification-name').textContent = `${group.name} · ${group.code}`;
  const official = group.basis === 'official';
  $('#certification-description').textContent = official
    ? `${group.services.length} fichas del catálogo citadas en la guía. Las funciones se agrupan con su servicio; la lista oficial no es exhaustiva.`
    : `${group.services.length} fichas detectadas por sus nombres en las ${group.questionCount} preguntas de esta versión. Agrupación de repaso del banco local, sin equivalencia con el temario oficial actual.`;
  const link = $('#certification-guide'); link.hidden = !official;
  if (official) link.href = group.source; else link.removeAttribute('href');
  const details = $('#certification-unmapped');
  if (details.dataset.certification !== group.id) details.open = false;
  details.dataset.certification = group.id;
  details.hidden = !group.unmapped.length;
  $('#certification-unmapped-heading').textContent = `Referencias sin ficha (${group.unmapped.length})`;
  $('#certification-unmapped-list').replaceChildren(...group.unmapped.map(name => node('li', '', name)));
}
function renderCategories() {
  const nav = $('#categories'); nav.replaceChildren();
  const counts = new Map();
  for (const entry of certificationEntries()) counts.set(entry.category, (counts.get(entry.category) || 0) + 1);
  const categories = [...counts].sort(([a],[b]) => a.localeCompare(b,'es'));
  $('#category-total').textContent = new Set(catalog.entries.map(entry => entry.category)).size;
  const options = $('#category-select'); options.replaceChildren(new Option('Todas las categorías', ''));
  for (const [category, count] of [['', certificationEntries().length], ...categories]) {
    const button = node('button','category-link'); button.dataset.category = category;
    button.append(node('span','', category || 'Todas las categorías'), node('span','',count));
    button.addEventListener('click', () => { state.category = category; state.page = 0; $('#category-select').value = category; render(); }); nav.append(button);
    if (category) options.add(new Option(`${category} (${count})`,category));
  }
  if (!counts.has(state.category)) state.category = '';
  options.value = state.category;
}
function render() {
  if (!catalog) return;
  renderCertificationSummary();
  const group = selectedCertification();
  const terms = normalize(state.query).trim().split(/\s+/).filter(Boolean);
  const entries = certificationEntries().filter(entry => {
    if (state.category && entry.category !== state.category) return false;
    if (state.mode === 'essential' && !entry.essential) return false;
    if (state.mode === 'saved' && !saved.has(entry.id)) return false;
    const content = normalize([entry.name,entry.category,entry.description,...entry.features,...(entry.aliases || []),entry.keywords || ''].join(' '));
    return terms.every(term => content.includes(term));
  });
  entries.sort((a,b) => (state.sort === 'relevance' ? ((a.rank ?? 1000)-(b.rank ?? 1000)) : 0) || a.name.localeCompare(b.name,'es'));
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE)); state.page = Math.max(0,Math.min(state.page,pages-1));
  const start = state.page * PAGE_SIZE;
  $('#service-result-count').textContent = entries.length ? `Mostrando ${start+1}–${Math.min(start+PAGE_SIZE,entries.length)} de ${entries.length} fichas` : '0 fichas';
  $('#catalog-empty').hidden = !!entries.length;
  $('#catalog-pagination').hidden = entries.length <= PAGE_SIZE;
  $('#services-previous').disabled = state.page === 0; $('#services-next').disabled = state.page >= pages-1;
  $('#services-page-number').textContent = `Página ${state.page+1} de ${pages}`;
  $('#clear-service-filters').hidden = !state.query && !state.category && !state.certification && state.mode === 'all';
  for (const mode of ['all','essential','saved']) { const button=$(`#filter-${mode}`); button.classList.toggle('active',state.mode===mode); button.setAttribute('aria-pressed',String(state.mode===mode)); }
  for (const button of document.querySelectorAll('.category-link')) { button.classList.toggle('active',button.dataset.category===state.category); button.setAttribute('aria-pressed',String(button.dataset.category===state.category)); }
  $('#saved-count').textContent = certificationEntries().filter(entry => saved.has(entry.id)).length;
  const grid = $('#service-grid'); grid.replaceChildren();
  const categories = [...new Set(catalog.entries.map(entry=>entry.category))].sort();
  for (const entry of entries.slice(start,start+PAGE_SIZE)) {
    const card = node('article','service-card'); card.dataset.service = entry.id;
    card.style.setProperty('--card-color',categoryColors[categories.indexOf(entry.category)%categoryColors.length]);
    const top = node('div','service-card-top');
    const category = node('span','service-category',entry.category);
    const bookmark = node('button','service-bookmark',saved.has(entry.id)?'★':'☆'); bookmark.setAttribute('aria-label',`${saved.has(entry.id)?'Quitar de guardados':'Guardar'} ${entry.name}`); bookmark.setAttribute('aria-pressed',String(saved.has(entry.id)));
    bookmark.addEventListener('click',()=>{ if(saved.has(entry.id))saved.delete(entry.id);else saved.add(entry.id); try{localStorage.setItem('nube.services.saved.v1',JSON.stringify([...saved]));}catch{} render(); });
    top.append(category,bookmark);card.append(top);
    const title = node('h2','',entry.name);card.append(title);
    const labels=node('div','service-labels');
    if(entry.essential) labels.append(node('span','essential-label','✦ Clave para repasar'));
    if(entry.kind!=='service') labels.append(node('span','kind-label',({feature:'Función',tool:'Herramienta',infrastructure:'Infraestructura'})[entry.kind] || 'Producto'));
    if(entry.status) labels.append(node('span',`lifecycle-label ${entry.status}`,({maintenance:'En mantenimiento',sunset:'Retirada anunciada',closed:'Retirado'})[entry.status] || 'Aviso de disponibilidad'));
    card.append(labels);
    if (group?.basis === 'official') {
      const names = group.references.get(entry.id);
      const reference = node('p','service-scope-reference', `En la guía: ${names.join(' · ')}`);
      card.append(reference);
    }
    card.append(node('p','service-description',entry.description));
    const features=node('ul','service-features');for(const feature of entry.features)features.append(node('li','',feature));card.append(features);
    const links=node('footer','service-links');const source=node('a','', 'Fuente AWS ↗');source.href=entry.url;source.target='_blank';source.rel='noopener noreferrer';links.append(source);
    if(entry.docs && entry.docs!==entry.url){const docs=node('a','','Documentación ↗');docs.href=entry.docs;docs.target='_blank';docs.rel='noopener noreferrer';links.append(docs);}
    if(entry.statusSource){const status=node('a','lifecycle-source','Ver aviso ↗');status.href=entry.statusSource;status.target='_blank';status.rel='noopener noreferrer';links.append(status);}
    card.append(links);grid.append(card);
  }
  updateUrl();
}
if (matchMedia('(max-width: 760px)').matches) $('#certification-groups').open = false;
$('#certification-select').addEventListener('change', event => selectCertification(event.target.value));
$('#certification-all').addEventListener('click', () => selectCertification(''));
$('#service-search').value=state.query;
$('#service-search').addEventListener('input',event=>{state.query=event.target.value;state.page=0;render();});
$('#category-select').addEventListener('change',event=>{state.category=event.target.value;state.page=0;render();});
$('#service-sort').addEventListener('change',event=>{state.sort=event.target.value;state.page=0;render();});
for(const mode of ['all','essential','saved']) $(`#filter-${mode}`).addEventListener('click',()=>setMode(mode));
$('#clear-service-filters').addEventListener('click',clearFilters);$('#empty-clear').addEventListener('click',clearFilters);
$('#services-previous').addEventListener('click',()=>{state.page--;render();$('#service-result-count').scrollIntoView({block:'start'});});
$('#services-next').addEventListener('click',()=>{state.page++;render();$('#service-result-count').scrollIntoView({block:'start'});});
async function fetchJson(path) {
 const response = await fetch(path, {cache:'no-cache'});
 if (!response.ok) throw new Error('Content unavailable');
 return response.json();
}
try{
 const [servicesResult, certificationsResult] = await Promise.allSettled([
   fetchJson('content/aws-services.json'), fetchJson('content/aws-certifications.json'),
 ]);
 if (servicesResult.status !== 'fulfilled') throw new Error('Catalog unavailable');
 catalog = servicesResult.value;
 if (certificationsResult.status === 'fulfilled') {
   const ids = new Set(catalog.entries.map(entry => entry.id));
   certifications = certificationsResult.value.groups.map(group => {
     const services = group.services.filter(service => ids.has(service.id));
     return {...group, services, serviceIds:new Set(services.map(service => service.id)), references:new Map(services.map(service => [service.id, service.names]))};
   });
   if (!selectedCertification()) state.certification = '';
   if (selectedCertification() && state.mode === 'essential') state.mode = 'all';
   renderCertificationControls();
 } else {
   state.certification = '';
   $('#certifications-error').hidden = false;
   $('#certification-select').replaceChildren(new Option('Agrupaciones no disponibles', ''));
 }
 $('#catalog-total').textContent=catalog.entries.length;
 const date=new Date(`${catalog.updated}T12:00:00`);const label=new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'short',year:'numeric'}).format(date);
 $('#snapshot-date').textContent=`Revisión: ${label}`;$('#snapshot-sidebar').textContent=`Revisado el ${label}`;
 renderCategories();render();
}catch{ $('#catalog-error').hidden=false;$('#service-result-count').textContent='Catálogo no disponible';$('#catalog-pagination').hidden=true; }
