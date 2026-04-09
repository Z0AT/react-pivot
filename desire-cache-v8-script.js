const STATE = {
  items: [],
  filtered: [],
  sections: [],
  activeSection: 'ALL',
  activePriority: 'ALL',
  activeSource: 'ALL',
  query: '',
  viewMode: 'tree'
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
  if (item.priceChanged) return 2;
  return 3;
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
  renderCurrentView();
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
  if (item.priceChanged) return 'skill-node changed';
  return 'skill-node';
}

function modalTags(item) {
  return [
    item.priority || '',
    item.sale ? 'SALE' : '',
    item.amazon ? 'AMAZON' : '',
    item.size || '',
    item.priceChanged ? 'PRICE_SHIFT' : ''
  ].filter(Boolean);
}

function openModal(itemId) {
  const item = STATE.items.find(i => i.id === itemId);
  if (!item) return;

  document.getElementById('modal-eyebrow').textContent = `${item.section || 'UNSORTED'} // ${item.subsection || 'GENERAL'}`;
  document.getElementById('modal-title').textContent = item.title || 'Unknown object';
  document.getElementById('modal-source').textContent = item.source || 'UNKNOWN_SOURCE';
  document.getElementById('modal-description').textContent = item.description || item.fetchedDescription || 'No dossier text available.';
  document.getElementById('modal-tags').innerHTML = modalTags(item).map(tag => `<span class="tag">${esc(tag)}</span>`).join('');

  const meta = [
    ['PRICE', item.effectivePrice || item.lastSeenPrice || 'UNKNOWN'],
    ['STATUS', item.hasMetadataError ? 'DEGRADED' : (item.priceChanged ? 'PRICE_SHIFT' : 'SYNC_OK')],
    ['LAST_FETCH', fmtDate(item.lastFetchedAt)],
    ['URL', item.url || 'NONE']
  ];
  document.getElementById('modal-meta').innerHTML = meta.map(([k, v]) => `<div class="meta-row"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');

  const imageWrap = document.getElementById('modal-image-wrap');
  imageWrap.innerHTML = item.image ? `<img src="${esc(item.image)}" alt="${esc(item.title)}">` : '<div class="image-fallback large">NO_PREVIEW</div>';

  const link = document.getElementById('modal-link');
  link.href = item.url || '#';
  link.style.display = item.url ? 'inline-block' : 'none';

  const modal = document.getElementById('dossier-modal');
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  const modal = document.getElementById('dossier-modal');
  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
}

function bindOpeners(root) {
  root.querySelectorAll('[data-open-item]').forEach(node => {
    node.addEventListener('click', event => {
      const id = event.currentTarget.getAttribute('data-open-item');
      openModal(id);
      event.stopPropagation();
    });
  });
}

function buildNodeMarkup(item, buttonLabel = 'OPEN_DOSSIER') {
  const flags = [
    item.priority ? `<span class="tag">${esc(item.priority)}</span>` : '',
    item.sale ? '<span class="tag">SALE</span>' : '',
    item.amazon ? '<span class="tag">AMAZON</span>' : '',
    item.size ? `<span class="tag">${esc(item.size)}</span>` : '',
    item.priceChanged ? '<span class="tag pulse">PRICE_SHIFT</span>' : ''
  ].filter(Boolean).join('');

  return `
    <article class="${nodeClass(item)}" data-open-item="${esc(item.id)}">
      <div class="node-strata"></div>
      <div class="node-head">
        <div class="node-title">${esc(item.title)}</div>
        <div class="node-source">${esc(item.source || 'UNKNOWN_SOURCE')}</div>
      </div>
      <div class="node-price-row">
        <span class="price">${esc(item.effectivePrice || item.lastSeenPrice || 'UNKNOWN')}</span>
        <span class="status">${item.hasMetadataError ? 'DEGRADED' : (item.priceChanged ? 'PRICE_SHIFT' : 'SYNC_OK')}</span>
      </div>
      <div class="tag-row">${flags}</div>
      <div class="node-links">
        <button class="object-link dossier-button" type="button" data-open-item="${esc(item.id)}">${buttonLabel}</button>
      </div>
    </article>
  `;
}

function renderTreeView(root) {
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
          ${items.map(item => buildNodeMarkup(item)).join('')}
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

function renderMapView(root) {
  const bySection = new Map();
  for (const item of STATE.filtered) {
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section).push(item);
  }

  const sections = Array.from(bySection.entries());
  root.innerHTML = `
    <section class="map-view panel">
      <div class="map-core">
        <div class="core-ring outer"></div>
        <div class="core-ring inner"></div>
        <div class="core-label">DESIRE_CACHE.sys</div>
      </div>
      <div class="orbit-field">
        ${sections.map(([section, items], index) => {
          const angle = (index / Math.max(sections.length, 1)) * Math.PI * 2;
          const x = 50 + Math.cos(angle) * 34;
          const y = 50 + Math.sin(angle) * 34;
          const nodes = items.map((item, nodeIndex) => {
            const spread = Math.min(1.35, 0.55 + items.length * 0.08);
            const nodeAngle = angle + ((nodeIndex + 1) / (items.length + 1)) * spread - (spread / 2);
            const radius = 10 + Math.floor(nodeIndex / 4) * 4 + (nodeIndex % 2);
            const nx = x + Math.cos(nodeAngle) * radius;
            const ny = y + Math.sin(nodeAngle) * radius;
            return `<button class="map-node ${item.priority === 'HOT' ? 'hot' : item.sale ? 'sale' : item.priceChanged ? 'changed' : ''}" style="left:${nx}%; top:${ny}%;" data-open-item="${esc(item.id)}" title="${esc(item.title)}"></button>`;
          }).join('');

          return `
            <div class="section-orbit" style="left:${x}%; top:${y}%;">
              <div class="orbit-anchor"></div>
              <div class="orbit-label">${esc(section)} <span>(${items.length})</span></div>
            </div>
            ${nodes}
          `;
        }).join('')}
      </div>
      <div class="map-legend">
        <span><i class="legend-dot hot"></i> HOT</span>
        <span><i class="legend-dot sale"></i> SALE</span>
        <span><i class="legend-dot changed"></i> PRICE_SHIFT</span>
      </div>
    </section>
  `;
}

function renderCurrentView() {
  const root = document.getElementById('object-grid');
  if (!STATE.filtered.length) {
    root.innerHTML = '<div class="empty-state">NO_OBJECTS_MATCH_CURRENT_FILTERS</div>';
    return;
  }

  if (STATE.viewMode === 'map') renderMapView(root);
  else renderTreeView(root);

  bindOpeners(root);
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
  document.getElementById('tree-view-button').addEventListener('click', () => {
    STATE.viewMode = 'tree';
    document.getElementById('tree-view-button').classList.add('active');
    document.getElementById('map-view-button').classList.remove('active');
    renderCurrentView();
  });
  document.getElementById('map-view-button').addEventListener('click', () => {
    STATE.viewMode = 'map';
    document.getElementById('map-view-button').classList.add('active');
    document.getElementById('tree-view-button').classList.remove('active');
    renderCurrentView();
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('dossier-modal').addEventListener('click', event => {
    if (event.target.hasAttribute('data-close-modal')) closeModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
  });

  applyFilters();
}

window.addEventListener('DOMContentLoaded', async () => {
  try {
    await boot();
  } catch (error) {
    document.getElementById('object-grid').innerHTML = `<div class="empty-state">BOOT_FAILURE // ${esc(error.message)}</div>`;
  }
});
