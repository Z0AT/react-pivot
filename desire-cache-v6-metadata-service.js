#!/usr/bin/env node
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;
const HOST = '127.0.0.1';
const SHEET_URL = process.env.DESIRE_CACHE_SHEET_URL || 'https://docs.google.com/spreadsheets/d/1ISDMvLLboySVAlltqXOp5We0aG2TnDw9SKam6KzMy8M/gviz/tq?tqx=out:csv&gid=0';
const DATA_CACHE_TTL_MS = Number(process.env.DESIRE_CACHE_DATA_TTL_MS || 15 * 60 * 1000);

app.use(cors());
app.use(express.json());

const metadataCache = new Map();
const CACHE_FILE = path.join(__dirname, 'metadata-cache.json');
let dataCache = { fetchedAt: 0, payload: null };

function loadMetadataCache() {
  try {
    if (!fs.existsSync(CACHE_FILE)) return;
    const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    for (const [k, v] of Object.entries(data)) metadataCache.set(k, v);
  } catch (error) {
    console.error(`cache load failed: ${error.message}`);
  }
}

function saveMetadataCache() {
  try {
    const data = Object.fromEntries(metadataCache.entries());
    fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error(`cache save failed: ${error.message}`);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter(r => r.some(cell => String(cell || '').trim() !== ''));
}

function slugify(input) {
  return String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function truthy(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return ['true', 'yes', '1', 'sale', 'y'].includes(normalized);
}

function normalizeRow(row, index) {
  const [name, size, sourceUrl, price, section, subsection, priority, sale, amazon] = row;
  const url = String(sourceUrl || '').trim();
  const title = String(name || '').trim();
  return {
    id: `${slugify(section)}-${slugify(subsection)}-${slugify(url || title)}-${index}`,
    url,
    titleOverride: title,
    section: String(section || '').trim() || 'UNSORTED',
    subsection: String(subsection || '').trim() || 'GENERAL',
    priority: String(priority || '').trim().toUpperCase(),
    size: String(size || '').trim(),
    manualPrice: String(price || '').trim(),
    saleOverride: truthy(sale),
    amazonOverride: truthy(amazon),
    notes: '',
    status: 'want'
  };
}

async function fetchMetadata(url) {
  if (!url) return { title: '', description: '', image: '', price: '', source: '' };
  if (metadataCache.has(url)) return metadataCache.get(url);

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000,
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);
    let imageUrl = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || '';
    if (imageUrl && !imageUrl.startsWith('http')) {
      const u = new URL(url);
      imageUrl = new URL(imageUrl, u.origin).href;
    }

    const metadata = {
      title: $('meta[property="og:title"]').attr('content') || $('meta[name="twitter:title"]').attr('content') || $('title').text().trim() || '',
      description: $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '',
      image: imageUrl,
      price: $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content') || '',
      source: (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })(),
      fetchedAt: new Date().toISOString()
    };

    metadataCache.set(url, metadata);
    saveMetadataCache();
    return metadata;
  } catch (error) {
    return { title: '', description: '', image: '', price: '', source: '', error: error.message, fetchedAt: new Date().toISOString() };
  }
}

function deriveSale(item, metadata) {
  if (item.saleOverride) return true;
  const candidate = `${item.titleOverride} ${metadata.title} ${metadata.description}`.toLowerCase();
  return /sale|deal|discount|clearance|coupon/.test(candidate);
}

async function buildDataPayload(force = false) {
  const now = Date.now();
  if (!force && dataCache.payload && (now - dataCache.fetchedAt) < DATA_CACHE_TTL_MS) return dataCache.payload;

  const response = await axios.get(SHEET_URL, { timeout: 15000, responseType: 'text' });
  const rows = parseCsv(response.data);
  const items = rows.slice(1).map(normalizeRow).filter(item => item.url || item.titleOverride);

  const enriched = [];
  for (const item of items) {
    const metadata = await fetchMetadata(item.url);
    const source = metadata.source || (item.amazonOverride ? 'amazon.com' : '');
    enriched.push({
      id: item.id,
      url: item.url,
      title: item.titleOverride || metadata.title || 'Unknown object',
      titleOverride: item.titleOverride,
      fetchedTitle: metadata.title || '',
      description: item.notes || metadata.description || '',
      fetchedDescription: metadata.description || '',
      image: metadata.image || '',
      section: item.section,
      subsection: item.subsection,
      priority: item.priority,
      size: item.size,
      manualPrice: item.manualPrice,
      lastSeenPrice: metadata.price || '',
      effectivePrice: item.manualPrice || metadata.price || '',
      sale: deriveSale(item, metadata),
      saleOverride: item.saleOverride,
      amazon: item.amazonOverride || source.includes('amazon.'),
      source,
      status: item.status,
      hasMetadataError: Boolean(metadata.error),
      metadataError: metadata.error || '',
      lastFetchedAt: metadata.fetchedAt || new Date().toISOString()
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'google-sheets-csv',
    totalItems: enriched.length,
    sections: [...new Set(enriched.map(i => i.section).filter(Boolean))],
    suggestedSheetColumns: {
      keep: ['Link', 'Section', 'Subsection', 'Priority'],
      optional: ['Name', 'Size'],
      removableAfterCleanup: ['Price', 'SALE', 'Amazon']
    },
    items: enriched
  };

  dataCache = { fetchedAt: now, payload };
  return payload;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'online', service: 'DESIRE_CACHE_DATA_SERVICE', cached_items: metadataCache.size, data_cache_age_ms: dataCache.payload ? Date.now() - dataCache.fetchedAt : null });
});

app.get('/api/items', async (req, res) => {
  try {
    const payload = await buildDataPayload(req.query.refresh === '1');
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/metadata', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  res.json(await fetchMetadata(url));
});

loadMetadataCache();
app.listen(PORT, HOST, () => {
  console.log(`✨ Desire Cache service running at http://${HOST}:${PORT}`);
});
