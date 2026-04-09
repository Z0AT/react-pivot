const STATE = {
  items: [],
  filtered: [],
  activeSection: 'ALL',
  activePriority: 'ALL',
  activeSource: 'ALL',
  query: ''
};

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtDate(value) {
  if (!value) return 'UNKNOWN';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function uniqueValues(items, key) {
  return ['ALL', ...Array.from(new Set(items.map(item => item[key]).filter(Boolean))).sort()];
}

function priorityRank(item) {
  if (item.priority === 'HOT') return 0;
  if (item.priority === 'SALE' || item.sale) return 1;
  return 2;
}

function applyFilters() {
  STATE.filtered = STATE.items
    .filter(item => STATE.activeSection === 'ALL' || item.section === STATE.activeSection)
    .filter(item => STATE.activePriority === 'ALL' || item.priority === STATE.activePriority || (STATE.activePriority === 'SALE' && item.sale))
    .filter(item => STATE.activeSource === 'ALL' || item.source === STATE.activeSource)
    .filter(item => {
      if (!STATE.query) return true;
      const hay = [item.title, item.section, item.subsection, item.source, item.description, item.fetchedDescription, item.size].join(' ').toLowerCase();
      return hay.includes(STATE.query);
    })
    .sort((a, b) => {
      const p = priorityRank(a) - priorityRank(b);
      if (p !== 0) return p;
      return a.title.localeCompare(b.title);
    });

  renderStats();
  renderGrid();
}

function renderStats() {
  document.getElementById('stat-total').textContent = STATE.items.length;
  document.getElementById('stat-visible').textContent = STATE.filtered.length;
  document.getElementById('stat-hot').textContent = STATE.items.filter(i => i.priority === 'HOT').length;
  document.getElementById('stat-sale').textContent = STATE.items.filter(i => i.sale || i.priority === 'SALE').length;
}

function renderSelect(id, values, current) {
  const select = document.getElementById(id);
  select.innerHTML = values.map(v => `<option value="${esc(v)}" ${v === current ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function cardClass(item) {
  if (item.priority === 'HOT') return 'card hot';
  if (item.sale || item.priority === 'SALE') return 'card sale';
  return 'card';
}

function renderGrid() {
  const grid = document.getElementById('object-grid');
  if (!STATE.filtered.length) {
    grid.innerHTML = '<div class="empty-state">NO_OBJECTS_MATCH_CURRENT_FILTERS</div>';
    return;
  }

  grid.innerHTML = STATE.filtered.map(item => {
    const description = item.description || item.fetchedDescription || 'No dossier text available.';
    const image = item.image
      ? `<img src="${esc(item.image)}" alt="${esc(item.title)}" loading="lazy">`
      : `<div class="image-fallback">NO_PREVIEW</div>`;
    const flags = [
      item.priority ? `<span class="tag">${esc(item.priority)}</span>` : '',
      item.sale ? '<span class="tag">SALE</span>' : '',
      item.amazon ? '<span class="tag">AMAZON</span>' : '',
      item.size ? `<span class="tag">${esc(item.size)}</span>` : ''
    ].filter(Boolean).join('');

    return `
      <article class="${cardClass(item)}">
        <div class="card-image">${image}</div>
        <div class="card-body">
          <div class="eyebrow">${esc(item.section || 'UNSORTED')} // ${esc(item.subsection || 'GENERAL')}</div>
          <h3>${esc(item.title)}</h3>
          <div class="source-line">${esc(item.source || 'UNKNOWN_SOURCE')}</div>
          <p>${esc(description)}</p>
          <div class="tag-row">${flags}</div>
          <div class="price-row">
            <span class="price">${esc(item.effectivePrice || 'UNKNOWN')}</span>
            <span class="status">${item.hasMetadataError ? 'DEGRADED_METADATA' : 'SYNC_OK'}</span>
          </div>
          ${item.url ? `<a class="object-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">OPEN_OBJECT</a>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

async function boot() {
  const response = await fetch('/api/items');
  if (!response.ok) throw new Error('failed to hydrate object cache');
  const payload = await response.json();
  STATE.items = payload.items || [];
  STATE.filtered = [...STATE.items];

  document.getElementById('sync-time').textContent = fmtDate(payload.generatedAt);
  document.getElementById('system-source').textContent = payload.source || 'UNKNOWN';

  renderSelect('section-filter', uniqueValues(STATE.items, 'section'), STATE.activeSection);
  renderSelect('priority-filter', ['ALL', 'HOT', 'SALE'], STATE.activePriority);
  renderSelect('source-filter', uniqueValues(STATE.items, 'source'), STATE.activeSource);

  document.getElementById('section-filter').addEventListener('change', e => { STATE.activeSection = e.target.value; applyFilters(); });
  document.getElementById('priority-filter').addEventListener('change', e => { STATE.activePriority = e.target.value; applyFilters(); });
  document.getElementById('source-filter').addEventListener('change', e => { STATE.activeSource = e.target.value; applyFilters(); });
  document.getElementById('search-filter').addEventListener('input', e => { STATE.query = e.target.value.trim().toLowerCase(); applyFilters(); });

  applyFilters();
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await boot();
  } catch (error) {
    document.getElementById('object-grid').innerHTML = `<div class="empty-state">BOOT_FAILURE // ${esc(error.message)}</div>`;
  }
});
