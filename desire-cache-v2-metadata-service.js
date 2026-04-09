#!/usr/bin/env node
/**
 * Desire Cache data + metadata service
 *
 * Phase 1 modernization:
 * - robust CSV parsing
 * - server-side data aggregation
 * - normalized items API for frontend consumption
 */

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
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      for (const [k, v] of Object.entries(data)) metadataCache.set(k, v);
      console.log(`📂 Loaded ${metadataCache.size} metadata cache entries`);
    }
  } catch (error) {
    console.error(`⚠️ Failed to load metadata cache: ${error.message}`);
  }
}

function saveMetadataCache() {
  try {
    const out = {};
    for (const [k, v] of metadataCache.entries()) out[k] = v;
    fs.writeFileSync(CACHE_FILE, JSON.stringify(out, null, 2));
  } catch (error) {
    console.error(`⚠️ Failed to save metadata cache: ${error.message}`);
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

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
    } else {
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
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'item';
}

function normalizeRow(row, index) {
  const [name, size, sourceUrl, price, section, subsection, priority, sale, amazon] = row;
  const normalizedTitle = (name || '').trim();
  const normalizedUrl = (sourceUrl || '').trim();
  return {
    id: `${slugify(section)}-${slugify(subsection)}-${slugify(normalizedTitle || normalizedUrl)}-${index}`,
    section: (section || '').trim(),
    subsection: (subsection || '').trim(),
    title: normalizedTitle,
    description: '',
    url: normalizedUrl,
    size: (size || '').trim(),
    manualPrice: (price || '').trim(),
    priority: (priority || '').trim().toUpperCase(),
    status: 'want',
    sale: String(sale || '').trim().toUpperCase() === 'TRUE',
    amazon: String(amazon || '').trim().toUpperCase() === 'TRUE',
    tags: [],
  };
}

async function fetchMetadata(url) {
  if (!url) return { title: '', description: '', image: '', price: '' };
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
      price: $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content') || ''
    };

    metadataCache.set(url, metadata);
    saveMetadataCache();
    return metadata;
  } catch (error) {
    return { title: '', description: '', image: '', price: '', error: error.message };
  }
}

async function buildDataPayload(force = false) {
  const now = Date.now();
  if (!force && dataCache.payload && (now - dataCache.fetchedAt) < DATA_CACHE_TTL_MS) {
    return dataCache.payload;
  }

  const response = await axios.get(SHEET_URL, { timeout: 15000, responseType: 'text' });
  const rows = parseCsv(response.data);
  const items = rows.slice(1).map(normalizeRow).filter(item => item.url || item.title);

  const enriched = [];
  for (const item of items) {
    const metadata = await fetchMetadata(item.url);
    enriched.push({
      ...item,
      source: item.url ? (() => { try { return new URL(item.url).hostname.replace(/^www\./, ''); } catch { return ''; } })() : '',
      title: item.title || metadata.title || 'Unknown item',
      image: metadata.image || '',
      fetchedTitle: metadata.title || '',
      fetchedDescription: metadata.description || '',
      lastSeenPrice: metadata.price || '',
      effectivePrice: item.manualPrice || metadata.price || '',
      lastFetchedAt: new Date().toISOString(),
      hasMetadataError: Boolean(metadata.error),
      metadataError: metadata.error || ''
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    source: 'google-sheets-csv',
    sheetUrl: SHEET_URL,
    totalItems: enriched.length,
    sections: [...new Set(enriched.map(i => i.section).filter(Boolean))],
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
    const force = req.query.refresh === '1';
    const payload = await buildDataPayload(force);
    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/metadata', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });
  const metadata = await fetchMetadata(url);
  res.json(metadata);
});

loadMetadataCache();

app.listen(PORT, HOST, () => {
  console.log(`✨ Desire Cache service running at http://${HOST}:${PORT}`);
});
