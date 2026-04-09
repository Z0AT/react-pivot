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
const DATA_FILE = process.env.DESIRE_CACHE_DATA_FILE || path.join(__dirname, 'desire-cache-data.json');
const DATA_CACHE_TTL_MS = Number(process.env.DESIRE_CACHE_DATA_TTL_MS || 15 * 60 * 1000);
const AUTO_REFRESH_MS = Number(process.env.DESIRE_CACHE_AUTO_REFRESH_MS || 30 * 60 * 1000);

app.use(cors());
app.use(express.json());

const metadataCache = new Map();
const CACHE_FILE = path.join(__dirname, 'metadata-cache.json');
const SNAPSHOT_FILE = path.join(__dirname, 'items-snapshot.json');
let dataCache = { fetchedAt: 0, payload: null, refreshing: false, lastRefreshError: null };

function loadJsonFile(file) {
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJsonFile(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function loadMetadataCache() {
  try {
    const data = loadJsonFile(CACHE_FILE);
    if (!data) return;
    for (const [k, v] of Object.entries(data)) metadataCache.set(k, v);
  } catch (error) {
    console.error(`cache load failed: ${error.message}`);
  }
}

function saveMetadataCache() {
  try {
    saveJsonFile(CACHE_FILE, Object.fromEntries(metadataCache.entries()));
  } catch (error) {
    console.error(`cache save failed: ${error.message}`);
  }
}

function slugify(input) {
  return String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
}

function truthy(value) {
  return ['true', 'yes', '1', 'sale', 'y'].includes(String(value || '').trim().toLowerCase());
}

function normalizeRecord(row, index) {
  const url = String(row.link || row.url || '').trim();
  const title = String(row.name || row.title || '').trim();
  return {
    id: `${slugify(row.section)}-${slugify(row.subsection)}-${slugify(url || title)}-${index}`,
    url,
    titleOverride: title,
    section: String(row.section || '').trim() || 'UNSORTED',
    subsection: String(row.subsection || '').trim() || 'GENERAL',
    priority: String(row.priority || '').trim().toUpperCase(),
    size: String(row.size || '').trim(),
    manualPrice: String(row.price || '').trim(),
    saleOverride: truthy(row.sale),
    amazonOverride: truthy(row.amazon),
    notes: String(row.notes || '').trim(),
    status: String(row.status || 'want').trim().toLowerCase()
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

function derivePriceChanged(previous, next) {
  if (!previous) return false;
  const before = previous.lastSeenPrice || previous.effectivePrice || '';
  const after = next.lastSeenPrice || next.effectivePrice || '';
  return Boolean(before && after && before !== after);
}

async function buildDataPayload(force = false) {
  const now = Date.now();
  if (!force && dataCache.payload && (now - dataCache.fetchedAt) < DATA_CACHE_TTL_MS) return dataCache.payload;
  if (dataCache.refreshing && dataCache.payload) return dataCache.payload;

  dataCache.refreshing = true;
  dataCache.lastRefreshError = null;
  try {
    const sourceData = loadJsonFile(DATA_FILE);
    if (!sourceData || !Array.isArray(sourceData.items)) throw new Error(`Invalid data file: ${DATA_FILE}`);
    const previous = loadJsonFile(SNAPSHOT_FILE);
    const previousItems = new Map((previous?.items || []).map(item => [item.id, item]));
    const items = sourceData.items.map(normalizeRecord).filter(item => item.url || item.titleOverride);

    const enriched = [];
    for (const item of items) {
      const metadata = await fetchMetadata(item.url);
      const source = metadata.source || (item.amazonOverride ? 'amazon.com' : '');
      const next = {
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
      };
      next.priceChanged = derivePriceChanged(previousItems.get(item.id), next);
      enriched.push(next);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      source: 'local-json',
      totalItems: enriched.length,
      sections: [...new Set(enriched.map(i => i.section).filter(Boolean))],
      suggestedSheetColumns: {
        keep: ['Link', 'Section', 'Subsection', 'Priority'],
        optional: ['Name', 'Size'],
        removableAfterCleanup: ['Price', 'SALE', 'Amazon']
      },
      items: enriched
    };

    dataCache = { fetchedAt: now, payload, refreshing: false, lastRefreshError: null };
    saveJsonFile(SNAPSHOT_FILE, payload);
    return payload;
  } catch (error) {
    dataCache.refreshing = false;
    dataCache.lastRefreshError = error.message;
    throw error;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    service: 'DESIRE_CACHE_DATA_SERVICE',
    source: 'local-json',
    dataFile: path.basename(DATA_FILE),
    cached_items: metadataCache.size,
    data_cache_age_ms: dataCache.payload ? Date.now() - dataCache.fetchedAt : null,
    refreshing: dataCache.refreshing,
    lastRefreshError: dataCache.lastRefreshError
  });
});

app.get('/api/items', async (req, res) => {
  try {
    const payload = await buildDataPayload(req.query.refresh === '1');
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/refresh', async (_req, res) => {
  try {
    const payload = await buildDataPayload(true);
    res.json({ ok: true, generatedAt: payload.generatedAt, totalItems: payload.totalItems });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/metadata', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  res.json(await fetchMetadata(url));
});

loadMetadataCache();
setInterval(() => {
  buildDataPayload(true).catch(err => console.error(`auto refresh failed: ${err.message}`));
}, AUTO_REFRESH_MS).unref();

app.listen(PORT, HOST, () => {
  console.log(`✨ Desire Cache service running at http://${HOST}:${PORT}`);
  buildDataPayload(false).catch(err => console.error(`initial warm failed: ${err.message}`));
});
