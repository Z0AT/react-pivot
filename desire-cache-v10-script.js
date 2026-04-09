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
  return [item.priority || '', item.sale ? 'SALE' : '', item.amazon ? 'AMAZON' : '', item.size || '', item.priceChanged ? 'PRICE_SHIFT' : ''].filter(Boolean);
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

function buildCircuitMap(root) {
  const width = 1800;
  const height = 1400;
  const sectionX = 330;
  const centerY = 220;
  const sectionSpacing = 260;
  const subsectionSpacing = 180;
  const nodeSpacing = 86;
  const bySection = new Map();
  for (const item of STATE.filtered) {
    if (!bySection.has(item.section)) bySection.set(item.section, new Map());
    const subsectionMap = bySection.get(item.section);
    if (!subsectionMap.has(item.subsection || 'GENERAL')) subsectionMap.set(item.subsection || 'GENERAL', []);
    subsectionMap.get(item.subsection || 'GENERAL').push(item);
  }

  const lines = [];
  const blocks = [];
  const nodes = [];
  const preview = document.createElement('div');
  preview.className = 'hover-preview hidden';
  root.innerHTML = '';
  root.appendChild(preview);

  const sections = Array.from(bySection.entries());
  sections.forEach(([section, subsectionMap], sectionIndex) => {
    const sy = centerY + sectionIndex * sectionSpacing;
    const sx = sectionX;
    blocks.push(`
      <g class="circuit-section-block">
        <rect x="${sx - 110}" y="${sy - 42}" width="220" height="84" rx="10" class="section-block-rect" />
        <text x="${sx}" y="${sy - 4}" text-anchor="middle" class="section-block-title">${esc(section)}</text>
        <text x="${sx}" y="${sy + 22}" text-anchor="middle" class="section-block-sub">${subsectionMap.size} branches</text>
      </g>
    `);
    lines.push(`<path class="circuit-line trunk" d="M ${sx + 110} ${sy} H ${sx + 220}" />`);

    const subsections = Array.from(subsectionMap.entries());
    subsections.forEach(([subsection, items], subIndex) => {
      const subX = sx + 320;
      const subY = sy + (subIndex - (subsections.length - 1) / 2) * subsectionSpacing;
      blocks.push(`
        <g class="circuit-subsection-block">
          <rect x="${subX - 90}" y="${subY - 28}" width="180" height="56" rx="8" class="subsection-block-rect" />
          <text x="${subX}" y="${subY + 6}" text-anchor="middle" class="subsection-block-title">${esc(subsection)}</text>
        </g>
      `);
      lines.push(`<path class="circuit-line branch" d="M ${sx + 220} ${sy} C ${sx + 250} ${sy}, ${subX - 110} ${subY}, ${subX - 90} ${subY}" />`);

      const rows = 3;
      const cols = Math.max(1, Math.ceil(items.length / rows));
      const fieldX = subX + 170;
      const fieldY = subY - 110;
      const cellW = 112;
      const cellH = 74;
      const fieldW = cols * cellW + 36;
      const fieldH = rows * cellH + 36;

      blocks.push(`
        <g class="subsection-field-block">
          <rect x="${fieldX}" y="${fieldY}" width="${fieldW}" height="${fieldH}" rx="10" class="subsection-field-rect" />
        </g>
      `);

      items.forEach((item, nodeIndex) => {
        const row = nodeIndex % rows;
        const col = Math.floor(nodeIndex / rows);
        const nx = fieldX + 30 + col * cellW;
        const ny = fieldY + 28 + row * cellH;
        const colorClass = mapNodeColorClass(item);
        lines.push(`<path class="circuit-line node" d="M ${subX + 90} ${subY} H ${fieldX - 16} V ${ny} H ${nx - 30}" />`);
        nodes.push(`
          <g class="circuit-node ${colorClass}" data-open-item="${esc(item.id)}" data-preview-title="${esc(item.title)}" data-preview-source="${esc(item.source || 'UNKNOWN_SOURCE')}" data-preview-price="${esc(item.effectivePrice || item.lastSeenPrice || 'UNKNOWN')}" data-preview-image="${esc(item.image || '')}" transform="translate(${nx}, ${ny})">
            <rect x="-24" y="-16" width="48" height="32" rx="7" class="circuit-node-body" />
            <rect x="-18" y="-10" width="36" height="20" rx="4" class="circuit-node-inner" />
            <line x1="-24" y1="0" x2="-30" y2="0" class="circuit-node-pin" />
            <line x1="24" y1="0" x2="30" y2="0" class="circuit-node-pin" />
            <circle r="5" class="circuit-node-indicator" />
            <title>${esc(item.title)}</title>
          </g>
        `);
      });
    });
  });

  root.insertAdjacentHTML('beforeend', `
    <section class="map-view panel circuit-map-view">
      <div class="map-toolbar">
        <button type="button" class="view-button" id="map-zoom-out">ZOOM_OUT</button>
        <button type="button" class="view-button" id="map-reset">RESET</button>
        <button type="button" class="view-button" id="map-zoom-in">ZOOM_IN</button>
        <span class="map-hint">DRAG_TO_PAN // WHEEL_TO_ZOOM // HOVER_TO_PREVIEW</span>
      </div>
      <div class="map-shell" id="map-shell">
        <svg class="map-svg" viewBox="0 0 ${width} ${height}" id="map-svg">
          <g id="map-viewport">
            <g class="circuit-lines">${lines.join('')}</g>
            <g class="circuit-blocks">${blocks.join('')}</g>
            <g class="circuit-nodes">${nodes.join('')}</g>
          </g>
        </svg>
      </div>
      <div class="map-legend">
        <span><i class="legend-dot hot"></i> HOT</span>
        <span><i class="legend-dot sale"></i> SALE</span>
        <span><i class="legend-dot changed"></i> PRICE_SHIFT</span>
      </div>
    </section>
  `);

  attachMapInteractions(root, preview);
}

function attachMapInteractions(root, preview) {
  const shell = root.querySelector('#map-shell');
  const viewport = root.querySelector('#map-viewport');
  if (!shell || !viewport) return;

  const applyTransform = () => {
    viewport.setAttribute('transform', `translate(${STATE.mapTranslateX} ${STATE.mapTranslateY}) scale(${STATE.mapScale})`);
  };
  applyTransform();

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
    if (STATE.dragging) {
      STATE.mapTranslateX = STATE.startTranslateX + (event.clientX - STATE.dragStartX);
      STATE.mapTranslateY = STATE.startTranslateY + (event.clientY - STATE.dragStartY);
      applyTransform();
      return;
    }

    const target = event.target.closest('[data-open-item]');
    if (!target) {
      preview.classList.add('hidden');
      return;
    }

    const title = target.getAttribute('data-preview-title') || 'Unknown object';
    const source = target.getAttribute('data-preview-source') || 'UNKNOWN_SOURCE';
    const price = target.getAttribute('data-preview-price') || 'UNKNOWN';
    const image = target.getAttribute('data-preview-image') || '';
    preview.innerHTML = `
      <div class="preview-title">${esc(title)}</div>
      <div class="preview-source">${esc(source)}</div>
      <div class="preview-price">${esc(price)}</div>
      ${image ? `<img src="${esc(image)}" alt="${esc(title)}">` : ''}
    `;
    preview.style.left = `${event.clientX + 18}px`;
    preview.style.top = `${event.clientY + 18}px`;
    preview.classList.remove('hidden');
  });

  shell.addEventListener('pointerleave', () => preview.classList.add('hidden'));
  shell.addEventListener('pointerup', () => { STATE.dragging = false; });
  bindOpeners(root);
}

function renderMapView(root) {
  buildCircuitMap(root);
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
