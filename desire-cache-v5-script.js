const STATE = {
  items: [],
  filtered: [],
  sections: [],
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
  try { return new Date(value).toLocaleString(); } catch { return value; }
}

function uniqueValues(items, key) {
  return ['ALL', ...Array.from(new Set(items.map(item => item[key]).filter(Boolean))).sort()];
}

function priorityRank(item) {
  if (item.priority === 'HOT') return 0;
  if (item.sale || item.priority === 'SALE') return 1;
  return 2;
}

function filtersMatch(item) {
  if (STATE.activeSection !== 'ALL' && item.section !== STATE.activeSection) return false;
  if (STATE.activePriority !== 'ALL' && item.priority !== STATE.activePriority && !(STATE.activePriority === 'SALE' && item.sale)) return false;
  if (STATE.activeSource !== 'ALL' && item.source !== STATE.activeSource) return false;
  if (STATE.query) {
    const hay = [item.title, item.section, item.subsection, item.source, item.description, item.fetchedDescription, item.size].join(' ').toLowerCase();
    if (!hay.includes(STATE.query)) return false;
  }
  return true;
}

function applyFilters() {
  STATE.filtered = STATE.items
    .filter(filtersMatch)
    .sort((a, b) => {
      const p = priorityRank(a) - priorityRank(b);
      if (p !== 0) return p;
      return a.title.localeCompare(b.title);
    });

  renderStats();
  renderSkillTree();
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

function nodeClass(item) {
  if (item.priority === 'HOT') return 'skill-node hot';
  if (item.sale || item.priority === 'SALE') return 'skill-node sale';
  return 'skill-node';
}

function buildNode(item) {
  const flags = [
    item.priority ? `<span class="tag">${esc(item.priority)}</span>` : '',
    item.sale ? '<span class="tag">SALE</span>' : '',
    item.amazon ? '<span class="tag">AMAZON</span>' : '',
    item.size ? `<span class="tag">${esc(item.size)}</span>` : ''
  ].filter(Boolean).join('');

  return `
    <article class="${nodeClass(item)}">
      <div class="node-strata"></div>
      <div class="node-head">
        <div class="node-title">${esc(item.title)}</div>
        <div class="node-source">${esc(item.source || 'UNKNOWN_SOURCE')}</div>
      </div>
      <div class="node-price-row">
        <span class="price">${esc(item.effectivePrice || item.lastSeenPrice || 'UNKNOWN')}</span>
        <span class="status">${item.hasMetadataError ? 'DEGRADED' : 'SYNC_OK'}</span>
      </div>
      <div class="tag-row">${flags}</div>
      <div class="node-links">
        ${item.url ? `<a class="object-link" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">OPEN_OBJECT</a>` : ''}
      </div>
    </article>
  `;
}

function renderSkillTree() {
  const root = document.getElementById('object-grid');
  if (!STATE.filtered.length) {
    root.innerHTML = '<div class="empty-state">NO_OBJECTS_MATCH_CURRENT_FILTERS</div>';
    return;
  }

  const bySection = new Map();
  for (const item of STATE.filtered) {
    if (!bySection.has(item.section)) bySection.set(item.section, new Map());
    const sub = bySection.get(item.section);
    if (!sub.has(item.subsection || 'GENERAL')) sub.set(item.subsection || 'GENERAL', []);
    sub.get(item.subsection || 'GENERAL').push(item);
  }

  root.innerHTML = Array.from(bySection.entries()).map(([section, subsections]) => {
    const subsectionHtml = Array.from(subsections.entries()).map(([subsection, items]) => `
      <div class="branch-column">
        <div class="branch-spine"></div>
        <div class="branch-header">${esc(subsection)}</div>
        <div class="branch-nodes">
          ${items.map(buildNode).join('')}
        </div>
      </div>
    `).join('');

    return `
      <section class="skill-tree-section panel">
        <div class="section-header">
          <h2>${esc(section)}</h2>
          <span>${subsections.size} BRANCH${subsections.size === 1 ? '' : 'ES'}</span>
        </div>
        <div class="branch-grid">
          ${subsectionHtml}
        </div>
      </section>
    `;
  }).join('');
}

async function boot() {
  const response = await fetch('/api/items');
  if (!response.ok) throw new Error('failed to hydrate object cache');
  const payload = await response.json();
  STATE.items = payload.items || [];
  STATE.sections = payload.sections || [];
  document.getElementById('sync-time').textContent = fmtDate(payload.generatedAt);
  document.getElementById('system-source').textContent = payload.source || 'UNKNOWN';

  renderSelect('section-filter', ['ALL', ...STATE.sections], STATE.activeSection);
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
