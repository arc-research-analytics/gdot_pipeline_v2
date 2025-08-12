// AdditionalGeos.js
// Handles loading and displaying one optional auxiliary boundary layer at a time

// Determine base URL similar to other modules so paths work locally and in production
const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '../..'  // Local development (module is in js/modules → go up to project root)
  : '.';     // GitHub Pages or production

// Map dropdown values to file paths
const GEO_FILE_PATHS = {
  Workforce: `${BASE_URL}/data/Workforce/workforce.geojson`,
  Aging: `${BASE_URL}/data/AAA/aging.geojson`,
  RCs: `${BASE_URL}/data/RCs/RCs.geojson`,
  CIDs: `${BASE_URL}/data/CIDs/CIDs.geojson`,
  LCIs: `${BASE_URL}/data/LivableCenters/LCIs.geojson`,
};

// For label centroids, define the property that should be used as label text per dataset
const LABEL_FIELD_BY_DATASET = {
  Aging: 'Name',
  CIDs: 'Sh_Name',
  LCIs: 'LCI_Name',
  RCs: 'Name',
  Workforce: 'Name',
};

// IDs used for the dynamically added source/layers
const SOURCE_ID = 'additional-geo-source';
const FILL_LAYER_ID = 'additional-geo-fill';
const LABEL_SOURCE_ID = 'additional-geo-labels-source';
const LABEL_LAYER_ID = 'additional-geo-labels';

// Color palette for categorizing features (repeats every 8 features)
const COLOR_PALETTE = ['#1b9e77','#d95f02','#7570b3','#e7298a','#66a61e','#e6ab02','#a6761d','#666666'];

function removeAdditionalGeoLayers(map) {
  try { if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID); } catch {}
  try { if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID); } catch {}
  try { if (map.getSource(LABEL_SOURCE_ID)) map.removeSource(LABEL_SOURCE_ID); } catch {}
  try { if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID); } catch {}
}

function detectPrimaryGeometryType(geojson) {
  if (!geojson || !geojson.features || geojson.features.length === 0) return null;
  // Find the first feature with a geometry
  const feature = geojson.features.find(f => f && f.geometry && f.geometry.type);
  return feature ? feature.geometry.type : null;
}

function buildFillColorExpression() {
  // Build a Mapbox match expression mapping catIndex -> color
  // ['match', ['get','catIndex'], 0, '#e41a1c', 1, '#377eb8', ..., '#e41a1c']
  const expression = ['match', ['get', 'catIndex']];
  COLOR_PALETTE.forEach((color, idx) => {
    expression.push(idx, color);
  });
  // default fallback color
  expression.push(COLOR_PALETTE[0]);
  return expression;
}

function getBestKeyString(properties) {
  if (!properties) return null;
  const candidateKeys = [
    'NAME', 'Name', 'name',
    'Label', 'label', 'ShortLabel', 'ShortName',
    'RC', 'AAA', 'CID', 'LCI', 'Board', 'Jurisdiction', 'jurisdiction'
  ];
  for (const key of candidateKeys) {
    const value = properties[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  // Fallback: serialize all props to form a key
  try {
    return JSON.stringify(properties);
  } catch {
    return null;
  }
}

function hashStringToIndex(str, modulus) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit int
  }
  const idx = Math.abs(hash) % modulus;
  return idx;
}

function assignCategoryIndex(features) {
  if (!Array.isArray(features)) return;
  for (let i = 0; i < features.length; i++) {
    const feature = features[i] || {};
    feature.properties = feature.properties || {};
    const keyStr = getBestKeyString(feature.properties);
    if (keyStr) {
      feature.properties.catIndex = hashStringToIndex(keyStr, COLOR_PALETTE.length);
    } else {
      // Fallback to sequential index if no key found
      feature.properties.catIndex = i % COLOR_PALETTE.length;
    }
  }
}

function buildCategoryIndexMapping(features, preferredField) {
  const map = new Map();
  if (!Array.isArray(features)) return map;
  let nextIdx = 0;
  for (const f of features) {
    if (!f) continue;
    const props = f.properties || {};
    let keyStr = null;
    if (preferredField && props[preferredField] !== undefined && props[preferredField] !== null) {
      keyStr = String(props[preferredField]).trim();
    }
    if (!keyStr || keyStr.length === 0) {
      keyStr = getBestKeyString(props);
    }
    if (!keyStr) continue;
    if (!map.has(keyStr)) {
      map.set(keyStr, nextIdx % COLOR_PALETTE.length);
      nextIdx += 1;
    }
    // also write catIndex onto feature for immediate use
    f.properties = props;
    f.properties.catIndex = map.get(keyStr);
  }
  return map;
}

function addAdditionalGeoLayer(map, geojson) {
  // Add the source
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geojson,
  });

  const geometryType = detectPrimaryGeometryType(geojson);

  // Determine a before layer to ensure this draws beneath boundary and project layers
  let beforeLayerId = null;
  // Prefer to place beneath boundary layers if present
  if (map.getLayer('unselected-boundary')) {
    beforeLayerId = 'unselected-boundary';
  } else if (map.getLayer('projects-layer')) {
    beforeLayerId = 'projects-layer';
  } else {
    // As a fallback, place as the bottom-most overlay above the base raster
    const layers = map.getStyle().layers || [];
    const cartoIndex = layers.findIndex(l => l.id === 'carto-layer');
    if (cartoIndex >= 0 && layers[cartoIndex + 1]) {
      beforeLayerId = layers[cartoIndex + 1].id;
    }
  }

  // Only add fill for polygonal sources (expected for these datasets);
  // no stroke/outline per requirements, and faint, categorized fill
  if (geometryType && geometryType.includes('Polygon')) {
    const fillLayer = {
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': buildFillColorExpression(),
        'fill-opacity': 0.10,
      },
    };
    if (beforeLayerId) {
      map.addLayer(fillLayer, beforeLayerId);
    } else {
      map.addLayer(fillLayer);
    }
  } else {
    console.warn('⚠️ Additional geo is not polygonal; skipping fill since spec requires fill without stroke.');
  }
}

async function loadAdditionalGeo(map, key) {
  // Clean up any prior additional layer
  removeAdditionalGeoLayers(map);

  if (!key || key === 'None') {
    return;
  }

  const filePath = GEO_FILE_PATHS[key];
  if (!filePath) {
    console.warn(`⚠️ No file path mapped for key: ${key}`);
    return;
  }

  

  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${filePath}: ${response.status} ${response.statusText}`);
    }
    const geojson = await response.json();

    // Assign a stable category index per unique name across polygons, preferring dataset-specific label field
    const preferredPolyField = LABEL_FIELD_BY_DATASET[key];
    const categoryMap = buildCategoryIndexMapping(geojson.features, preferredPolyField);
    addAdditionalGeoLayer(map, geojson);

    // Attempt to load label (centroid) GeoJSON in same folder by filename convention
    const labelPath = filePath.replace(/\.geojson$/i, '_centroids.geojson');
    try {
      const labelResp = await fetch(labelPath);
      if (labelResp.ok) {
        const labelGeo = await labelResp.json();
        // Assign catIndex using the same mapping so colors align with polygons
        const labelField = LABEL_FIELD_BY_DATASET[key];
        if (Array.isArray(labelGeo.features)) {
          for (const lf of labelGeo.features) {
            const props = lf.properties || {};
            const labelKeyStr = props[labelField] !== undefined && props[labelField] !== null
              ? String(props[labelField]).trim()
              : getBestKeyString(props);
            let idx = undefined;
            if (labelKeyStr && categoryMap.has(labelKeyStr)) {
              idx = categoryMap.get(labelKeyStr);
            } else if (labelKeyStr) {
              // If centroid has a name unseen in polygons, allocate next available color
              idx = (categoryMap.size % COLOR_PALETTE.length);
              categoryMap.set(labelKeyStr, idx);
            } else {
              idx = 0;
            }
            lf.properties = props;
            lf.properties.catIndex = idx;
          }
        }

        // Add label source
        map.addSource(LABEL_SOURCE_ID, {
          type: 'geojson',
          data: labelGeo,
        });

        // Determine placement to keep these labels unobtrusive (below main boundary labels)
        let labelBefore = null;
        if (map.getLayer('boundary-labels-unselected')) {
          labelBefore = 'boundary-labels-unselected';
        } else if (map.getLayer('boundary-labels')) {
          labelBefore = 'boundary-labels';
        } else if (map.getLayer('projects-layer')) {
          labelBefore = 'projects-layer';
        }

        const textField = ['to-string', ['get', LABEL_FIELD_BY_DATASET[key] || 'Name']];

        const textColorExpr = buildFillColorExpression();

        // Zoom gating: too many CIDs/LCIs, show only when zoomed in
        let minZoom = undefined;
        if (key === 'CIDs') minZoom = 10;
        if (key === 'LCIs') minZoom = 11;

        const labelLayer = {
          id: LABEL_LAYER_ID,
          type: 'symbol',
          source: LABEL_SOURCE_ID,
          ...(minZoom !== undefined ? { minzoom: minZoom } : {}),
          layout: {
            'text-field': textField,
            'text-font': ['Roboto Regular', 'Arial Unicode MS Regular'],
            'text-size': 17,
            'text-allow-overlap': false,
            'text-ignore-placement': false,
          },
          paint: {
            'text-color': textColorExpr,
            'text-opacity': 0.55,
            'text-halo-color': 'rgba(255,255,255,0.7)',
            'text-halo-width': 1.25,
            'text-halo-blur': 0.25,
          },
        };

        if (labelBefore) {
          map.addLayer(labelLayer, labelBefore);
        } else {
          map.addLayer(labelLayer);
        }
      } else {
        console.warn(`⚠️ Label centroid file not found or not ok: ${labelPath}`);
      }
    } catch (labelErr) {
      console.warn('⚠️ Error loading additional geo label centroids:', labelErr);
    }
  } catch (err) {
    console.error('❌ Error loading additional geo:', err);
  }
}

export function setupAdditionalGeosListener(map) {
  const select = document.getElementById('additionalGeoSelect');
  if (!select) {
    console.warn('⚠️ additionalGeoSelect not found in DOM');
    return;
  }

  // On init, ensure state matches current value (default None)
  loadAdditionalGeo(map, select.value);

  // Listen for changes
  select.addEventListener('sl-change', (event) => {
    const value = event.target.value;
    loadAdditionalGeo(map, value);
  });
}


