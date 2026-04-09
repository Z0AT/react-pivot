const CONFIG = {
  API_URL: '/api/items'
};

let allItems = [];

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function groupBySection(items) {
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.section)) grouped.set(item.section, new Map());
    const subsectionMap = grouped.get(item.section);
    if (!subsectionMap.has(item.subsection)) subsectionMap.set(item.subsection, []);
    subsectionMap.get(item.subsection).push(item);
  }
  return grouped;
}

function buildItemCard(item) {
  const priorityClass = item.priority === 'HOT' ? 'priority-hot' : (item.priority === 'SALE' || item.sale) ? 'priority-sale' : '';
  const description = item.description || item.fetchedDescription || '';
  const price = item.effectivePrice || 'Unknown';
  const source = item.source ? `<div class="item-source">${escapeHtml(item.source)}</div>` : '';
  const metadataWarning = item.hasMetadataError ? `<div class="item-warning">metadata refresh failed</div>` : '';
  const image = item.image ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" loading="lazy">` : '<div class="placeholder-image">NO PREVIEW</div>';

  return `
    <div class="item-card ${priorityClass}" data-priority="${escapeHtml(item.priority)}" data-section="${escapeHtml(item.section)}" data-subsection="${escapeHtml(item.subsection)}">
      <div class="item-image">${image}</div>
      <div class="item-content">
        <h3>${escapeHtml(item.title)}</h3>
        ${source}
        <p>${escapeHtml(description)}</p>
        <div class="item-meta">
          <span class="item-price">${escapeHtml(price)}</span>
          ${item.size ? `<span class="item-size">${escapeHtml(item.size)}</span>` : ''}
          ${item.priority ? `<span class="item-priority">${escapeHtml(item.priority)}</span>` : ''}
          ${item.sale ? `<span class="item-priority">SALE</span>` : ''}
          ${item.amazon ? `<span class="item-priority">AMAZON</span>` : ''}
        </div>
        ${metadataWarning}
        ${item.url ? `<a class="item-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">inspect object</a>` : ''}
      </div>
    </div>
  `;
}

function renderItems(items) {
  const container = document.getElementById('wishlist-container');
  const grouped = groupBySection(items);
  let html = '';

  for (const [section, subsectionMap] of grouped.entries()) {
    html += `<section class="wishlist-section"><h2>${escapeHtml(section || 'Unsorted')}</h2>`;
    for (const [subsection, subsectionItems] of subsectionMap.entries()) {
      html += `<div class="wishlist-subsection"><h3>${escapeHtml(subsection || 'General')}</h3><div class="item-grid">`;
      html += subsectionItems.map(buildItemCard).join('');
      html += `</div></div>`;
    }
    html += `</section>`;
  }

  container.innerHTML = html || '<p>No items found.</p>';
}

function applyFilters() {
  const priorityFilter = document.getElementById('priority-filter').value;
  const search = document.getElementById('search-input').value.trim().toLowerCase();

  const filtered = allItems.filter(item => {
    const priorityOk = !priorityFilter || item.priority === priorityFilter;
    const hay = [item.title, item.description, item.fetchedDescription, item.section, item.subsection, item.source].join(' ').toLowerCase();
    const searchOk = !search || hay.includes(search);
    return priorityOk && searchOk;
  });

  renderItems(filtered);
  document.getElementById('item-count').textContent = `${filtered.length} object${filtered.length === 1 ? '' : 's'}`;
}

async function loadData() {
  const container = document.getElementById('wishlist-container');
  container.innerHTML = '<p>Syncing desire cache...</p>';

  try {
    const response = await fetch(CONFIG.API_URL);
    if (!response.ok) throw new Error('Failed to fetch desire cache');
    const payload = await response.json();
    allItems = payload.items || [];
    document.getElementById('last-updated').textContent = new Date(payload.generatedAt).toLocaleString();
    document.getElementById('item-count').textContent = `${allItems.length} objects`;
    applyFilters();
  } catch (error) {
    container.innerHTML = `<p>Failed to load desire cache: ${escapeHtml(error.message)}</p>`;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('priority-filter').addEventListener('change', applyFilters);
  document.getElementById('search-input').addEventListener('input', applyFilters);
  loadData();
});
