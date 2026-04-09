import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { buildApiUrl } from './config';
import type { DesireCacheItem, DesireCachePayload } from './types';

const SECTION_ALIASES: Record<string, string> = {
  perks: 'Perk Injector',
  comfort: 'Comfort Daemon',
  style: 'Shell Mods',
  setup: 'Rig Matrix'
};

const SECTION_COLORS = ['#7dd3fc', '#c084fc', '#fb7185', '#4ade80', '#f59e0b', '#2dd4bf'];

function sectionLabelFor(section: string) {
  return SECTION_ALIASES[section.toLowerCase()] ?? section;
}

function branchLabelFor(item: DesireCacheItem) {
  const subsection = item.subsection?.trim();
  if (subsection) return subsection;

  const source = item.source?.trim();
  if (source) return source;

  return 'Unsorted Branch';
}

function itemTitle(item: DesireCacheItem) {
  return item.titleOverride?.trim() || item.title?.trim() || item.fetchedTitle?.trim() || 'Unknown node';
}

function itemDescription(item: DesireCacheItem) {
  return item.description?.trim() || item.fetchedDescription?.trim() || 'No dossier text yet.';
}

function itemPrice(item: DesireCacheItem) {
  return item.effectivePrice || item.manualPrice || item.lastSeenPrice || 'Unknown';
}

function itemTypeLabel(item: DesireCacheItem) {
  if (item.priority?.trim()) return item.priority;
  if (item.sale) return 'SALE';
  if (item.priceChanged) return 'SHIFT';
  return item.amazon ? 'AMAZON' : 'STASH';
}

function normalizeSection(section: string) {
  return section?.trim() || 'Misc';
}

function normalizeSearchValue(item: DesireCacheItem) {
  return [
    itemTitle(item),
    itemDescription(item),
    normalizeSection(item.section),
    branchLabelFor(item),
    item.source,
    item.size,
    itemTypeLabel(item)
  ]
    .join(' ')
    .toLowerCase();
}

function itemAccentClass(item: DesireCacheItem) {
  if (item.priority === 'HOT') return 'is-hot';
  if (item.sale || item.priority === 'SALE') return 'is-sale';
  if (item.priceChanged) return 'is-shift';
  return 'is-normal';
}

function groupByBranch(items: DesireCacheItem[]) {
  const map = new Map<string, DesireCacheItem[]>();

  for (const item of items) {
    const branch = branchLabelFor(item);
    if (!map.has(branch)) map.set(branch, []);
    map.get(branch)!.push(item);
  }

  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
}

function App() {
  const [payload, setPayload] = useState<DesireCachePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<DesireCacheItem | null>(null);
  const [activeSection, setActiveSection] = useState<string>('ALL');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(buildApiUrl('/api/items'), { signal: controller.signal });
        if (!response.ok) throw new Error(`API request failed with ${response.status}`);
        const nextPayload = (await response.json()) as DesireCachePayload;
        setPayload(nextPayload);
        setSelectedItem(nextPayload.items[0] ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unknown Desire Cache API failure');
      }
    }

    load();
    return () => controller.abort();
  }, []);

  const sections = useMemo(() => {
    const base = payload?.sections?.length ? payload.sections : Array.from(new Set((payload?.items ?? []).map((item) => normalizeSection(item.section))));
    return base.map((section, index) => ({
      id: section,
      label: sectionLabelFor(section),
      color: SECTION_COLORS[index % SECTION_COLORS.length]
    }));
  }, [payload]);

  const filteredItems = useMemo(() => {
    const lowerQuery = query.trim().toLowerCase();

    return (payload?.items ?? []).filter((item) => {
      const itemSection = normalizeSection(item.section);
      if (activeSection !== 'ALL' && itemSection !== activeSection) return false;
      if (lowerQuery && !normalizeSearchValue(item).includes(lowerQuery)) return false;
      return true;
    });
  }, [payload, activeSection, query]);

  const groupedBranches = useMemo(() => groupByBranch(filteredItems), [filteredItems]);

  const activeSectionMeta = useMemo(() => {
    if (activeSection === 'ALL') {
      return {
        label: 'All Sectors',
        color: '#7dd3fc'
      };
    }

    return sections.find((section) => section.id === activeSection) ?? {
      label: sectionLabelFor(activeSection),
      color: '#7dd3fc'
    };
  }, [activeSection, sections]);

  return (
    <main className="app-shell inventory-theme">
      <section className="hero-panel shop-hero">
        <div className="shop-hero__portrait">
          <div className="portrait-shell">
            <div className="portrait-mark">DC</div>
            <div className="portrait-copy">
              <p className="eyebrow">Desire Cache // Trade Deck</p>
              <h1>Inventory-first browse pass</h1>
              <p className="lede">
                Dense item scan, strong dossier panel, and category framing first. Skill-tree DNA stays as subtle structure, not permanent clutter.
              </p>
            </div>
          </div>
        </div>

        <div className="shop-hero__stats">
          <span>{payload?.totalItems ?? 0} total</span>
          <span>{filteredItems.length} visible</span>
          <span>{groupedBranches.length} lanes</span>
          <span>{error ? 'feed degraded' : 'feed nominal'}</span>
        </div>
      </section>

      <section className="shop-shell">
        <aside className="section-rail panel-surface">
          <div className="rail-header">
            <p className="eyebrow">Sections</p>
            <strong>Browse rails</strong>
          </div>

          <button
            className={`rail-button ${activeSection === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setActiveSection('ALL')}
            type="button"
          >
            <span>All Sectors</span>
            <small>{payload?.totalItems ?? 0}</small>
          </button>

          {sections.map((section) => {
            const count = (payload?.items ?? []).filter((item) => normalizeSection(item.section) === section.id).length;
            return (
              <button
                key={section.id}
                className={`rail-button ${activeSection === section.id ? 'is-active' : ''}`}
                style={{ ['--section-color' as string]: section.color }}
                onClick={() => setActiveSection(section.id)}
                type="button"
              >
                <span>{section.label}</span>
                <small>{count}</small>
              </button>
            );
          })}
        </aside>

        <section className="inventory-panel panel-surface">
          <header className="inventory-toolbar">
            <div>
              <p className="eyebrow">{activeSectionMeta.label}</p>
              <h2>Trade inventory</h2>
            </div>

            <label className="search-shell">
              <span>Search</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find an item, source, or lane" />
            </label>
          </header>

          {error ? <div className="state-panel error">{error}</div> : null}

          <div className="lane-stack">
            {groupedBranches.map(([branch, items]) => (
              <section key={branch} className="lane-panel">
                <header className="lane-header">
                  <div>
                    <p className="lane-kicker">Lane</p>
                    <h3>{branch}</h3>
                  </div>
                  <span>{items.length} items</span>
                </header>

                <div className="inventory-grid">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      className={`item-card ${itemAccentClass(item)} ${selectedItem?.id === item.id ? 'is-selected' : ''}`}
                      onClick={() => setSelectedItem(item)}
                      onMouseEnter={() => setSelectedItem(item)}
                      type="button"
                    >
                      <div className="item-card__image">
                        {item.image ? <img src={item.image} alt="" loading="lazy" /> : <div className="image-fallback">NO PREVIEW</div>}
                      </div>

                      <div className="item-card__body">
                        <div className="item-card__head">
                          <p>{itemTypeLabel(item)}</p>
                          <span>{item.size || branch}</span>
                        </div>
                        <h4>{itemTitle(item)}</h4>
                        <div className="item-card__footer">
                          <strong>{itemPrice(item)}</strong>
                          <span>{item.source || 'Unknown source'}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}

            {!error && groupedBranches.length === 0 ? <div className="state-panel">No items match this filter state.</div> : null}
          </div>
        </section>

        <aside className="detail-panel panel-surface dossier-panel" style={{ ['--section-color' as string]: activeSectionMeta.color }}>
          {selectedItem ? (
            <>
              <div className="dossier-header">
                <p className="detail-kicker">{sectionLabelFor(selectedItem.section || 'Misc')}</p>
                <span>{branchLabelFor(selectedItem)}</span>
              </div>

              <h2>{itemTitle(selectedItem)}</h2>
              <p className="detail-copy">{itemDescription(selectedItem)}</p>

              {selectedItem.image ? <img className="detail-image" src={selectedItem.image} alt="" /> : <div className="detail-image image-fallback large">NO PREVIEW</div>}

              <dl>
                <div>
                  <dt>Price</dt>
                  <dd>{itemPrice(selectedItem)}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{selectedItem.source || 'Unknown'}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{itemTypeLabel(selectedItem)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{selectedItem.priceChanged ? 'Price shifted' : selectedItem.sale ? 'Sale active' : 'Nominal'}</dd>
                </div>
              </dl>

              <div className="purchase-shell">
                <div className="purchase-shell__stepper">
                  <button type="button">−</button>
                  <strong>x1</strong>
                  <button type="button">+</button>
                </div>
                {selectedItem.url ? (
                  <a className="action-link purchase-link" href={selectedItem.url} target="_blank" rel="noreferrer">
                    Open item dossier
                  </a>
                ) : (
                  <button className="action-link purchase-link is-disabled" type="button">
                    Dossier unavailable
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="state-panel">Select an item to inspect its dossier.</div>
          )}
        </aside>
      </section>
    </main>
  );
}

export default App;
