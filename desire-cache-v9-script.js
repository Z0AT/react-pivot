const STATE = {
  items: [],
  filtered: [],
  sections: [],
  activeSection: 'ALL',
  activePriority: 'ALL',
  activeSource: 'ALL',
  query: '',
  viewMode: 'tree',
  mapScale: 1,
  mapTranslateX: 0,
  mapTranslateY: 0,
  dragging: false,
  dragStartX: 0,
  dragStartY: 0,
  startTranslateX: 0,
  startTranslateY: 0
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

function mapNodeColorClass(item) {
  if (item.priority === 'HOT') return 'hot';
  if (item.sale || item.priority === 'SALE') return 'sale';
  if (item.priceChanged) return 'changed';
  return 'normal';
}

function buildMapSvg() {
  const width = 1600;
  const height = 1200;
  const centerX = width / 2;
  const centerY = height / 2;
  const sectionRadius = 330;
  const bySection = new Map();
  for (const item of STATE.filtered) {
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section).push(item);
  }
  const sections = Array.from(bySection.entries());

  const lines = [];
  const sectionNodes = [];
  const itemNodes = [];

  sections.forEach(([section, items], sectionIndex) => {
    const sectionAngle = (sectionIndex / Math.max(sections.length, 1)) * Math.PI * 2 - Math.PI / 2;
    const sx = centerX + Math.cos(sectionAngle) * sectionRadius;
    const sy = centerY + Math.sin(sectionAngle) * sectionRadius;

    lines.push(`<line class="map-line" x1="${centerX}" y1="${centerY}" x2="${sx}" y2="${sy}" />`);
    sectionNodes.push(`
      <g class="section-hub">
        <circle cx="${sx}" cy="${sy}" r="18" class="section-hub-circle" />
        <text x="${sx}" y="${sy - 26}" text-anchor="middle" class="section-label">${esc(section)}</text>
        <text x="${sx}" y="${sy + 34}" text-anchor="middle" class="section-count">${items.length} objects</text>
      </g>
    `);

    const subsectionMap = new Map();
    items.forEach(item => {
      if (!subsectionMap.has(item.subsection || 'GENERAL')) subsectionMap.set(item.subsection || 'GENERAL', []);
      subsectionMap.get(item.subsection || 'GENERAL').push(item);
    });

    const subsections = Array.from(subsectionMap.entries());
    subsections.forEach(([subsection, subsectionItems], subIndex) => {
      const subAngle = sectionAngle + ((subIndex + 1) / (subsections.length + 1)) * 1.1 - 0.55;
      const subRadius = 120;
      const subX = sx + Math.cos(subAngle) * subRadius;
      const subY = sy + Math.sin(subAngle) * subRadius;
      lines.push(`<line class="map-line faint" x1="${sx}" y1="${sy}" x2="${subX}" y2="${subY}" />`);
      sectionNodes.push(`
        <g class="subsection-hub">
          <circle cx="${subX}" cy="${subY}" r="10" class="subsection-hub-circle" />
          <text x="${subX}" y="${subY - 18}" text-anchor="middle" class="subsection-label">${esc(subsection)}</text>
        </g>
      `);

      subsectionItems.forEach((item, itemIndex) => {
        const itemAngle = subAngle + ((itemIndex + 1) / (subsectionItems.length + 1)) * 1.5 - 0.75;
        const itemRadius = 70 + Math.floor(itemIndex / 4) * 22;
        const ix = subX + Math.cos(itemAngle) * itemRadius;
        const iy = subY + Math.sin(itemAngle) * itemRadius;
        const colorClass = mapNodeColorClass(item);
        const thumb = item.image
          ? `<image href="${esc(item.image)}" x="${ix - 16}" y="${iy - 16}" width="32" height="32" clip-path="circle(16px at 16px 16px)" preserveAspectRatio="xMidYMid slice"></image>`
          : '';
        lines.push(`<line class="map-line faint" x1="${subX}" y1="${subY}" x2="${ix}" y2="${iy}" />`);
        itemNodes.push(`
          <g class="map-node-group ${colorClass}" data-open-item="${esc(item.id)}" transform="translate(${ix}, ${iy})">
            <circle r="20" class="map-node-ring" />
            <circle r="17" class="map-node-core" />
            ${thumb}
            <title>${esc(item.title)}</title>
          </g>
        `);
      });
    });
  });

  return `
    <section class="map-view panel">
      <div class="map-toolbar">
        <button type="button" class="view-button" id="map-zoom-out">ZOOM_OUT</button>
        <button type="button" class="view-button" id="map-reset">RESET</button>
        <button type="button" class="view-button" id="map-zoom-in">ZOOM_IN</button>
        <span class="map-hint">DRAG_TO_PAN // WHEEL_TO_ZOOM</span>
      </div>
      <div class="map-shell" id="map-shell">
        <svg class="map-svg" viewBox="0 0 ${width} ${height}" id="map-svg">
          <g id="map-viewport" transform="translate(${STATE.mapTranslateX} ${STATE.mapTranslateY}) scale(${STATE.mapScale})">
            <g class="map-core-group">
              <circle cx="${centerX}" cy="${centerY}" r="78" class="map-core-outer" />
              <circle cx="${centerX}" cy="${centerY}" r="52" class="map-core-inner" />
              <text x="${centerX}" y="${centerY - 4}" text-anchor="middle" class="map-core-text">DESIRE</text>
              <text x="${centerX}" y="${centerY + 20}" text-anchor="middle" class="map-core-text sub">CACHE.sys</text>
            </g>
            <g class="map-lines">${lines.join('')}</g>
            <g class="map-sections">${sectionNodes.join('')}</g>
            <g class="map-items">${itemNodes.join('')}</g>
          </g>
        </svg>
      </div>
      <div class="map-legend">
        <span><i class="legend-dot hot"></i> HOT</span>
        <span><i class="legend-dot sale"></i> SALE</span>
        <span><i class="legend-dot changed"></i> PRICE_SHIFT</span>
      </div>
    </section>
  `;
}

function attachMapInteractions(root) {
  const shell = root.querySelector('#map-shell');
  const viewport = root.querySelector('#map-viewport');
  if (!shell || !viewport) return;

  const applyTransform = () => {
    viewport.setAttribute('transform', `translate(${STATE.mapTranslateX} ${STATE.mapTranslateY}) scale(${STATE.mapScale})`);
  };

  root.querySelector('#map-zoom-in').addEventListener('click', () => {
    STATE.mapScale = Math.min(2.6, STATE.mapScale + 0.15);
    applyTransform();
  });
  root.querySelector('#map-zoom-out').addEventListener('click', () => {
    STATE.mapScale = Math.max(0.65, STATE.mapScale - 0.15);
    applyTransform();
  });
  root.querySelector('#map-reset').addEventListener('click', () => {
    STATE.mapScale = 1;
    STATE.mapTranslateX = 0;
    STATE.mapTranslateY = 0;
    applyTransform();
  });

  shell.addEventListener('wheel', event => {
    event.preventDefault();
    STATE.mapScale = Math.max(0.65, Math.min(2.6, STATE.mapScale + (event.deltaY < 0 ? 0.12 : -0.12)));
    applyTransform();
  }, { passive: false });

  shell.addEventListener('pointerdown', event => {
    if (event.target.closest('[data-open-item]')) return;
    STATE.dragging = true;
    STATE.dragStartX = event.clientX;
    STATE.dragStartY = event.clientY;
    STATE.startTranslateX = STATE.mapTranslateX;
    STATE.startTranslateY = STATE.mapTranslateY;
    shell.setPointerCapture(event.pointerId);
  });

  shell.addEventListener('pointermove', event => {
    if (!STATE.dragging) return;
    STATE.mapTranslateX = STATE.startTranslateX + (event.clientX - STATE.dragStartX);
    STATE.mapTranslateY = STATE.startTranslateY + (event.clientY - STATE.dragStartY);
    applyTransform();
  });

  shell.addEventListener('pointerup', () => {
    STATE.dragging = false;
  });
}

function renderMapView(root) {
  root.innerHTML = buildMapSvg();
  bindOpeners(root);
  attachMapInteractions(root);
}

function renderCurrentView() {
  const root = document.getElementById('object-grid');
  if (!STATE.filtered.length) {
    root.innerHTML = '<div class="empty-state">NO_OBJECTS_MATCH_CURRENT_FILTERS</div>';
    return;
  }

  if (STATE.viewMode === 'map') renderMapView(root);
  else {
    renderTreeView(root);
    bindOpeners(root);
  }
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
