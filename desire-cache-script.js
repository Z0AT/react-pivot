// Configuration
const CONFIG = {
    // Your Google Sheet CSV URL
    SHEET_URL: 'https://docs.google.com/spreadsheets/d/1ISDMvLLboySVAlltqXOp5We0aG2TnDw9SKam6KzMy8M/export?format=csv&gid=0',
    // Metadata service URL - uses same protocol and hostname as the page
    METADATA_SERVICE: `${window.location.protocol}//${window.location.hostname}`,
    // Auto-refresh interval in milliseconds (3600000 = 1 hour)
    REFRESH_INTERVAL: 3600000
};

// Subsection name mapping (Google Sheet name -> Display name)
const SUBSECTION_NAMES = {
    // ABILITY_POINT_ADDITIONS
    'Lockpicking': 'BREACH_PROTOCOLS',
    'Mobile Security': 'COMBAT_LOADOUT',

    // HARDWARE_MATRIX
    'Parts': 'SYSTEM_COMPONENTS',
    'Home Security': 'SURVEILLANCE_NET',
    'Network': 'NETWORK_CORE',
    'Car': 'AUTOPILOT_RIG',
    'Kitchen': 'SUSTENANCE_LAB',
    'Electrical': 'VOLTAGE_ARSENAL',

    // BIOMECHANICAL_SHELL
    'Shirts': 'TORSO_PLATING',
    'Hoodies': 'THERMAL_ARMOR',
    'Underwear': 'CORE_FOUNDATION',
    'Shoes': 'MOBILITY_UNITS',
    'Belts': 'LOAD_HARNESS',

    // COMFORT_STATUS_UPGRADES
    'Beach': 'RECOVERY_FIELD',
    'Bedding': 'SLEEP_CHAMBER'
};

// Parse CSV data
function parseCSV(text) {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        const values = lines[i].split(',').map(v => v.trim());
        const row = {};

        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        data.push(row);
    }

    return data;
}

// Fetch metadata from URL
async function fetchMetadata(url) {
    try {
        const response = await fetch(`${CONFIG.METADATA_SERVICE}/api/metadata`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            throw new Error('Metadata service unavailable');
        }

        const metadata = await response.json();
        return metadata;
    } catch (err) {
        console.warn(`Could not fetch metadata for ${url}:`, err.message);
        return null;
    }
}

// Create gift card HTML with metadata
async function createGiftCard(gift, container) {
    const card = document.createElement('div');
    card.className = 'gift-card loading-card';

    // Store subsection for filtering
    const subsection = gift.Subsection || gift.subsection || '';
    if (subsection) {
        card.dataset.subsection = subsection.trim();
    }

    // Check for HOT specifically in Priority column
    const priorityValue = gift.Priority || gift.priority || '';
    const isHot = priorityValue.toUpperCase() === 'HOT';
    const hotHTML = isHot ? '<div class="gift-hot">HOT</div>' : '';

    // Check for SALE
    const saleValue = gift.SALE || gift.Sale || gift.sale || '';
    const isSale = saleValue.toUpperCase() === 'TRUE' || saleValue === '1' || saleValue.toUpperCase() === 'YES';
    const saleHTML = isSale ? '<div class="gift-sale">SALE!</div>' : '';

    // Check for Amazon - add neon sign
    const amazonValue = gift.Amazon || gift.amazon || '';
    const isAmazon = amazonValue.toUpperCase() === 'TRUE' || amazonValue === '1' || amazonValue.toUpperCase() === 'YES';
    const amazonHTML = isAmazon ? '<div class="amazon-neon-sign">🚁 DRONE DELIVERY CAPABLE 🚁</div>' : '';

    // Get size directly from Size column
    const size = gift.Size || gift.size || '';
    const sizeHTML = size ? `<div class="gift-size">SIZE: ${size}</div>` : '';

    // Initial loading state
    card.innerHTML = `
        ${saleHTML}
        ${hotHTML}
        ${sizeHTML}
        <div class="gift-image-container">
            <div class="image-loader">LOADING...</div>
        </div>
        ${amazonHTML}
        <div class="gift-content">
            <h3 class="gift-name">Loading...</h3>
            <p class="gift-description">Fetching product details...</p>
            <div class="gift-meta">
                <span class="gift-price"></span>
            </div>
            <a href="${gift.Link || gift.link || '#'}" target="_blank" class="gift-link">ACCESS LINK</a>
        </div>
    `;

    container.appendChild(card);

    // Fetch metadata
    const url = gift.Link || gift.link;
    if (url) {
        const metadata = await fetchMetadata(url);

        if (metadata) {
            const imageContainer = card.querySelector('.gift-image-container');
            const nameElement = card.querySelector('.gift-name');
            const descElement = card.querySelector('.gift-description');
            const priceElement = card.querySelector('.gift-price');

            // Update image
            if (metadata.image) {
                imageContainer.innerHTML = `<img src="${metadata.image}" alt="${metadata.title}" class="gift-image" onerror="this.parentElement.innerHTML='<div class=\\'no-image\\'>IMAGE UNAVAILABLE</div>'">`;
            } else {
                imageContainer.innerHTML = `<div class="no-image">NO IMAGE</div>`;
            }

            // Update name - prioritize manual name from sheet, then metadata
            const manualName = gift.Name || gift.name || '';
            const metaTitle = metadata.title ? metadata.title.replace(' - Ubiquiti Store ', '').replace(' - Firearms Direct Club', '').trim() : '';
            // Use manual name if provided, or metadata if it's not just "Amazon.com"
            if (manualName) {
                nameElement.textContent = manualName;
            } else if (metaTitle && metaTitle !== 'Amazon.com') {
                nameElement.textContent = metaTitle;
            } else {
                // Fallback: try to extract ASIN for Amazon items
                const asinMatch = (gift.Link || gift.link || '').match(/\/dp\/([A-Z0-9]{10})/);
                nameElement.textContent = asinMatch ? `Amazon Product (${asinMatch[1]})` : 'View Product';
            }

            // Update description
            if (metadata.description) {
                descElement.textContent = metadata.description.substring(0, 200) + (metadata.description.length > 200 ? '...' : '');
            } else {
                descElement.textContent = '';
            }

            // Update price - prioritize manual price from sheet
            const manualPrice = gift.Price || gift.price || '';
            if (manualPrice) {
                priceElement.textContent = `💰 ${manualPrice}`;
            } else if (metadata.price) {
                priceElement.textContent = `💰 ${metadata.price}`;
            }

            card.classList.remove('loading-card');
        } else {
            // Metadata fetch failed
            const imageContainer = card.querySelector('.gift-image-container');
            const nameElement = card.querySelector('.gift-name');
            const descElement = card.querySelector('.gift-description');

            imageContainer.innerHTML = `<div class="no-image">UNABLE TO FETCH</div>`;
            nameElement.textContent = 'Unable to load product info';
            descElement.textContent = 'Click link to view product';
            card.classList.remove('loading-card');
        }
    }
}

// Get section from gift data
function getSection(gift) {
    const section = gift.Section || gift.section || '';
    // Normalize section names
    const normalized = section.toUpperCase().trim();

    // Map to grid IDs
    const sectionMap = {
        'ABILITY_POINT_ADDITIONS': 'ability',
        'HARDWARE_MATRIX': 'hardware',
        'BIOMECHANICAL_SHELL': 'biomech',
        'COMFORT_STATUS_UPGRADES': 'comfort'
    };

    return sectionMap[normalized] || 'hardware'; // Default to hardware if not specified
}

// Create accordion for a section
function createAccordion(sectionKey, subsectionData) {
    const accordionContainer = document.getElementById(`${sectionKey}-accordion`);
    if (!accordionContainer) return;

    accordionContainer.innerHTML = '';

    // Create accordion items for each subsection
    subsectionData.forEach(({ name, count }) => {
        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item';

        const header = document.createElement('div');
        header.className = 'accordion-header';
        header.innerHTML = `
            <div class="accordion-title">
                <span class="accordion-arrow">▶</span>
                <span>${SUBSECTION_NAMES[name] || name}</span>
            </div>
            <span class="accordion-count">[${count} ITEMS]</span>
        `;

        const content = document.createElement('div');
        content.className = 'accordion-content';
        content.innerHTML = `<div class="accordion-grid" data-subsection="${name}"></div>`;

        // Click handler for expand/collapse
        header.addEventListener('click', () => {
            const isActive = header.classList.contains('active');

            // Toggle this accordion
            header.classList.toggle('active');
            content.classList.toggle('active');
        });

        accordionItem.appendChild(header);
        accordionItem.appendChild(content);
        accordionContainer.appendChild(accordionItem);
    });
}

// Load gifts from Google Sheets
async function loadGifts() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');

    try {
        const response = await fetch(CONFIG.SHEET_URL);

        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }

        const csvText = await response.text();
        const gifts = parseCSV(csvText);

        loading.style.display = 'none';

        if (gifts.length === 0) {
            error.style.display = 'block';
            error.querySelector('.error-text').textContent = 'NO DATA FOUND';
            return;
        }

        error.style.display = 'none';

        // Filter valid gifts
        const validGifts = gifts.filter(gift => gift.Link || gift.link);

        // Group by section and subsection with counts
        const sectionData = {
            'ability': {},
            'hardware': {},
            'biomech': {},
            'comfort': {}
        };

        validGifts.forEach(gift => {
            const section = getSection(gift);
            const subsection = (gift.Subsection || gift.subsection || '').trim();
            if (subsection) {
                if (!sectionData[section][subsection]) {
                    sectionData[section][subsection] = [];
                }
                sectionData[section][subsection].push(gift);
            }
        });

        // Create accordions for each section
        Object.keys(sectionData).forEach(sectionKey => {
            const subsections = Object.keys(sectionData[sectionKey]);
            if (subsections.length > 0) {
                const subsectionData = subsections.sort().map(name => ({
                    name,
                    count: sectionData[sectionKey][name].length
                }));
                createAccordion(sectionKey, subsectionData);
            }
        });

        // Show loading progress
        loading.style.display = 'block';
        loading.querySelector('.loading-text').textContent = `LOADING 0/${validGifts.length} ITEMS...`;

        // Load all items at once - server-side caching handles rate limiting
        let completedCount = 0;
        const promises = validGifts.map(async (gift) => {
            const section = getSection(gift);
            const subsection = (gift.Subsection || gift.subsection || '').trim();

            // Find the correct accordion grid for this subsection
            const accordionContainer = document.getElementById(`${section}-accordion`);
            if (accordionContainer) {
                const targetGrid = accordionContainer.querySelector(`.accordion-grid[data-subsection="${subsection}"]`);
                if (targetGrid) {
                    await createGiftCard(gift, targetGrid);
                    completedCount++;
                    loading.querySelector('.loading-text').textContent = `LOADING ${completedCount}/${validGifts.length} ITEMS...`;
                }
            }
        });
        await Promise.all(promises);
        loading.style.display = 'none';

    } catch (err) {
        console.error('Error loading gifts:', err);
        loading.style.display = 'none';
        error.style.display = 'block';
        error.querySelector('.error-text').textContent = 'ERROR: CONNECTION FAILED - ' + err.message;
    }
}

// Check if metadata service is available
async function checkMetadataService() {
    try {
        const response = await fetch(`${CONFIG.METADATA_SERVICE}/api/health`);
        if (response.ok) {
            console.log('✅ Metadata service online');
            return true;
        }
    } catch (err) {
        console.warn('⚠️ Metadata service offline');
        return false;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkMetadataService();
    loadGifts();

    // Set up auto-refresh every hour
    setInterval(() => {
        console.log('Auto-refreshing gift list...');
        loadGifts();
    }, CONFIG.REFRESH_INTERVAL);
});
