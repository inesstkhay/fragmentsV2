
/***************************************************
 * backdoorurbanism — script.js
 ***************************************************/
/* ==================================================
   0) CONFIGURATION GÉNÉRALE
   Paramètres fixes du site :
   - coordonnées de départ
   - seuils de calcul
   - listes de critères
   - couleurs
   Ces valeurs peuvent être ajustées sans modifier
   la structure du reste du code.
================================================== */
/* ==================================================
   ÉTAT GLOBAL — VUES ET LOCALISATION
================================================== */


const montreuilView = [48.8710, 2.4330];
const montreuilZoom = 15;

const toulouseView = [43.5675824, 1.4000176];
const toulouseZoom = 15;


/* ==================================================
   PARAMÈTRES DU MOTEUR PATTERNS / AGENCEMENTS
================================================== */

let PERIMETER_DIAMETER_M = 100;
let AG_SIM_THRESHOLD = 0.60;

let MIN_AG_FRAGMENTS = 2;
let ALLOW_SINGLE_FRAGMENT_WITH_BUILDINGS = true;
let MIN_BUILDINGS_FOR_SINGLE_FRAGMENT = 1;
let MAX_AG_OVERLAP = 0.05;
let MIN_PATTERN_OCCURRENCES = 2;
let RARE_MOTIF_BOOST = 0.35;
let SHARED_NULL_WEIGHT = 1;
let COUNT_SHARED_NULL_IN_NUMERIC_SIM = true;

/* ==================================================
   PARAMÈTRES DE COMPARAISON temporalites
================================================== */

let AG_WEIGHT_SNUM = 0.20;
let AG_WEIGHT_SMOTIFS = 0.55;
let AG_WEIGHT_STEMPORALITES = 0.25;

let TEMPORAL_STATUS_PENALTY = 0.60;   // pénalité forte si statuts différents
let TEMPORAL_APP_DIS_STRICT = true;   // apparu ≠ disparu, toujours distincts
let TEMPORAL_MIN_MATCH_SCORE = 0.05;  // évite les appariements “zéro absolu”

/* ==================================================
   PARAMÈTRES DE COMPARAISON FUZZY
================================================== */

let SIM_THRESHOLD = 0.75;
let COMP_THRESHOLD = 0.60;

let MIN_COMMON_NON_NULL = 3;
let MAX_NULL_MISMATCH_RATIO = 0.20;

/* ==================================================
   COULEURS POUR LES FONCTIONS DE BÂTIMENTS
================================================== */

const BUILDING_FUNCTION_COLORS = {
  logement: 'rgba(255, 255, 255, 0.80)',
  commerce: 'rgba(255, 182, 182, 0.35)',
  équipement: 'rgba(183, 251, 208, 0.35)',
  associatif: 'rgba(141, 181, 250, 0.35)',
  santé: 'rgba(237, 250, 141, 0.35)',
  culte: 'rgba(235, 141, 250, 0.35)',
  parking: 'rgba(73, 73, 73, 0.42)',
  industriel: 'rgba(255, 190, 130, 0.35)',
  scolaire: 'rgba(230,200,255,0.35)',
  autre: 'rgba(210,210,210,0.28)',
  mixte: 'rgba(210,210,210,0.28)'
};


/* ==================================================
   CLES FUZZY ET TEXTUELLES
================================================== */

const ALL_FUZZY_KEYS = [
  // Pratiques actives
  "PA_P1_intensitesoin",
  "PA_P1_frequencegestes",
  "PA_P1_degrecooperation",

  "PA_P2_degretransformation",
  "PA_P2_perrenite",
  "PA_P2_autonomie",

  "PA_P3_intensiteusage",
  "PA_P3_frequenceusage",
  "PA_P3_diversitepublic",
  "PA_P3_conflitusage",

  // Dynamiques hybrides
  "DH_P1_degreinformalite",
  "DH_P1_echellepratique",
  "DH_P1_degremutualisation",

  "DH_P2_degréorganisation",
  "DH_P2_porteepolitique",
  "DH_P2_effetspatial",

  "DH_P3_attachement",
  "DH_P4_intensiteflux",

  // Forces structurantes
  "FS_P1_presenceinstitutionnelle",
  "FS_P1_intensitecontrole",
  "FS_P2_abandon",
  "FS_P3_pressionfonciere"
];

const TEXT_KEYS = [
  "usages",
  "acteur_actif",
  "initiateur",
  "elements_spatiaux"
];

const ALL_CRITERIA_KEYS = [
  ...ALL_FUZZY_KEYS,
  ...TEXT_KEYS
];


const FUZZY_GROUPS = {
  PA: [
    "PA_P1_intensitesoin",
    "PA_P1_frequencegestes",
    "PA_P1_degrecooperation",
    "PA_P2_degretransformation",
    "PA_P2_perrenite",
    "PA_P2_autonomie",
    "PA_P3_intensiteusage",
    "PA_P3_frequenceusage",
    "PA_P3_diversitepublic",
    "PA_P3_conflitusage"
  ],
  DH: [
    "DH_P1_degreinformalite",
    "DH_P1_echellepratique",
    "DH_P1_degremutualisation",
    "DH_P2_degréorganisation",
    "DH_P2_porteepolitique",
    "DH_P2_effetspatial",
    "DH_P3_attachement",
    "DH_P4_intensiteflux"
  ],
  FS: [
    "FS_P1_presenceinstitutionnelle",
    "FS_P1_intensitecontrole",
    "FS_P2_abandon",
    "FS_P3_pressionfonciere"
  ]
};


/* ==================================================
   SATURATION ET LUMINOSITÉ DES COULEURS DE PATTERNS
================================================== */

const SAT_SEQ = [95, 85, 90, 80];
const LIT_SEQ = [58, 70, 50, 64];




/* ==================================================
   1) ÉTAT GLOBAL DE L’APPLICATION
   Variables vivantes du site :
   - vue active
   - données chargées
   - résultats calculés
   - références de cartes, couches et modales
   Ce bloc centralise ce qui change pendant l’usage.
================================================== */

/* ==================================================
   ÉTAT GLOBAL — DONNÉES CALCULÉES
================================================== */


let currentView = 'map';
let currentLocation = 'montreuil';

let currentFragmentSub = 'map';
let currentUnitSub = 'map';

let SHOW_DIFFRACTIONS = false;

let agencements = [];
let agencementPatterns = {};
let fragmentToPatternIds = new Map();
let agencementsById = new Map();

let patterns = {};
let patternNames = {};
let combinedFeatures = [];

let allLayers = [];
let dataGeojson = [];
let datamGeojson = [];

let batimentsMontreuilGeojson = [];
let batimentsToulouseGeojson = [];

/* temporalités */

let dataGeojsonT1 = [];
let dataGeojsonT2 = [];
let datamGeojsonT1 = [];
let datamGeojsonT2 = [];

let currentFragmentTimeMode = 'T1';
let currentPatternGalleryTimeMode = 'T1';

let fragmentTemporalControl = null;
let fragmentTrajectoryLegend = null;

let fragmentLayersGroup = null;

let temporalFragmentIndex = {
  montreuil: new Map(),
  mirail: new Map()
};


/* ==================================================
   ÉTAT GLOBAL — BÂTIMENTS
================================================== */

let BUILDINGS_STYLE_MODE = 'etat';


let batimentsLayerMontreuil = null;
let batimentsLayerToulouse = null;
let patternBuildingsLayer = null;
let unitBuildingsLayer = null;


/* ==================================================
   ÉTAT GLOBAL — UNITÉ DE PROJET
================================================== */

let unitCreation = {
  active: false,
  mode: null,
  ringsVisible: true,
  mouseMoveHandler: null
};

let unitMap = null;
let unitLayerGroup = null;
let unitContextGroup = null;
let unitPatternGroup = null;
let unitContext = null;

let discoursLayer = null;

let patternMap = null;
let patternBaseLayer = null;        // fragments gris
let patternOverlayGroup = null;     // anneaux colorés
let patternPanes = new Map();       // pane par anneau

let activeViewer = null;
let activeFragmentId = null;


/* ========== MODALE UNITÉ (plein écran) ========== */
let unitModalState = {
  unit: null,
  singleViewer: null,
  v1Viewer: null,
  v2Viewer: null,
};


let __imgObserver = null;

/* ==================================================
   RÉFÉRENCES DOM FRÉQUENTES
================================================== */

const proxemicView = document.getElementById('proxemic-view');
const fragmentProxemicView = document.getElementById('fragment-proxemic-view');


/* ==================================================
   CARTE PRINCIPALE — INITIALISATION
================================================== */

let map = L.map('map').setView(montreuilView, montreuilZoom);
/* layer fragment pour la temporalité */
fragmentLayersGroup = L.layerGroup().addTo(map);

map.createPane('pane-discours');
map.getPane('pane-discours').style.zIndex = 650;

map.createPane('pane-batiments');
map.getPane('pane-batiments').style.zIndex = 300;

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap contributors, © CartoDB'
}).addTo(map);



/* ==================================================
   CRITÈRES — LISTES DE CLÉS
================================================== */


let ACTIVE_CRITERIA_KEYS = new Set(ALL_CRITERIA_KEYS);




/* ==================================================
   COULEURS DES PATTERNS
================================================== */


const PATTERN_COLORS = Object.fromEntries(
  Array.from({ length: 100 }, (_, i) => {
    const hue = Math.round((i * 137.508) % 360);
    const sat = SAT_SEQ[i % SAT_SEQ.length];
    const lit = LIT_SEQ[(Math.floor(i / 4)) % LIT_SEQ.length];
    return [`P${i + 1}`, `hsl(${hue}, ${sat}%, ${lit}%)`];
  })
);





/* ==================================================
   3) HELPERS GÉNÉRAUX
   Petites fonctions utilitaires réutilisées partout.
   Elles ne pilotent pas l’interface directement :
   elles transforment, calculent ou normalisent.
================================================== */

/* ==================================================
   HELPERS — TEXTE ET NORMALISATION
================================================== */

function normStr(v) {
  return String(v ?? '').trim().toLowerCase();
}

function normalizeToken(t) {
  return String(t || '')
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[’']/g, "'")
    .replace(/^\-+|\-+$/g, '');
}

function parseMultiText(v) {
  if (v === "-" || v === "" || v === null || v === undefined) return null;

  const raw = String(v)
    .split(/[;,]/)
    .map(s => normalizeToken(s))
    .filter(Boolean);

  if (!raw.length) return null;

  const banned = new Set(["aucun", "aucune", "none", "na", "n/a", "null"]);
  const cleaned = raw.filter(tok => !banned.has(tok));

  return cleaned.length ? cleaned : null;
}

function prettyKey(k) {
  return String(k).replace(/_/g, " ");
}

function fmtFuzzy(v) {
  return (v === null || v === undefined) ? "—" : Number(v).toFixed(2);
}

function fmtAny(v) {
  if (v === null || v === undefined) return "—";

  if (Array.isArray(v)) {
    if (v.length === 0) return "—";
    const short = v.slice(0, 4).join(", ");
    return (v.length > 4) ? (short + "…") : short;
  }

  return fmtFuzzy(v);
}


/* ==================================================
   HELPERS — FUZZY ET CRITÈRES
================================================== */

function parseFuzzy(v) {
  if (
    v === "-" ||
    v === "" ||
    v === null ||
    v === undefined ||
    v === "null" ||
    v === "NaN"
  ) {
    return null;
  }

  const num = parseFloat(String(v).replace(",", "."));
  if (!Number.isFinite(num)) return null;

  return num;
}

function isSharedNull(a, b) {
  return a === null && b === null;
}

function isNonNull(v) {
  return v !== null && v !== undefined;
}

function featureToVector(feature) {
  const props = feature.properties || {};

  return ALL_CRITERIA_KEYS.map(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return null;

    if (TEXT_KEYS.includes(k)) {
      return parseMultiText(props[k]);
    }

    return parseFuzzy(props[k]);
  });
}

function similarityFuzzy(vec1, vec2) {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < vec1.length; i++) {
    const a = vec1[i];
    const b = vec2[i];

    if (a === null && b === null) continue;

    let dist;

    if (a === null || b === null) {
      dist = 1;
    } else if (Array.isArray(a) && Array.isArray(b)) {
      const sim = jaccardSimilarity(a, b);
      dist = 1 - sim;
    } else {
      dist = Math.abs(a - b);
    }

    sum += dist;
    count++;
  }

  if (count === 0) return 0;
  return 1 - (sum / count);
}

function jaccardSimilarity(listA, listB) {
  const A = new Set(listA || []);
  const B = new Set(listB || []);
  if (!A.size && !B.size) return 0;

  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter++;
  }

  const uni = A.size + B.size - inter;
  return uni ? (inter / uni) : 0;
}

function comparabilityStats(vec1, vec2) {
  let inter = 0;
  let uni = 0;
  let mismatch = 0;

  for (let i = 0; i < vec1.length; i++) {
    const aNN = (vec1[i] !== null);
    const bNN = (vec2[i] !== null);

    if (aNN || bNN) uni++;
    if (aNN && bNN) inter++;
    if (aNN !== bNN) mismatch++;
  }

  return {
    inter,
    uni,
    mismatch,
    jaccard: (uni === 0) ? 0 : (inter / uni)
  };
}

function distanceCommonNonNull(vec1, vec2) {
  let sum = 0;
  let count = 0;

  for (let i = 0; i < vec1.length; i++) {
    const a = vec1[i];
    const b = vec2[i];
    if (a === null || b === null) continue;

    sum += Math.abs(a - b);
    count++;
  }

  return count ? (sum / count) : null;
}

function oppositionFuzzy(vec1, vec2) {
  const st = comparabilityStats(vec1, vec2);

  if (st.uni === 0) {
    return {
      valid: false,
      comparability: 0,
      opposition: null,
      common: 0,
      mismatch: 0
    };
  }

  if (st.jaccard < COMP_THRESHOLD) {
    return {
      valid: false,
      comparability: st.jaccard,
      opposition: null,
      common: st.inter,
      mismatch: st.mismatch
    };
  }

  if ((st.mismatch / st.uni) > MAX_NULL_MISMATCH_RATIO) {
    return {
      valid: false,
      comparability: st.jaccard,
      opposition: null,
      common: st.inter,
      mismatch: st.mismatch
    };
  }

  if (st.inter < MIN_COMMON_NON_NULL) {
    return {
      valid: false,
      comparability: st.jaccard,
      opposition: null,
      common: st.inter,
      mismatch: st.mismatch
    };
  }

  const dist = distanceCommonNonNull(vec1, vec2);
  if (dist === null) {
    return {
      valid: false,
      comparability: st.jaccard,
      opposition: null,
      common: st.inter,
      mismatch: st.mismatch
    };
  }

  return {
    valid: true,
    comparability: st.jaccard,
    opposition: dist,
    common: st.inter,
    mismatch: st.mismatch
  };
}

function topVectorDifferences(vecA, vecB, { topN = 3 } = {}) {
  const diffs = [];

  for (let i = 0; i < ALL_CRITERIA_KEYS.length; i++) {
    const k = ALL_CRITERIA_KEYS[i];
    const a = vecA[i];
    const b = vecB[i];

    if (a === null && b === null) continue;

    if (a === null || b === null) {
      diffs.push({
        key: k,
        a,
        b,
        diff: 1,
        kind: "mismatch"
      });
      continue;
    }

    if (Array.isArray(a) && Array.isArray(b)) {
      const sim = jaccardSimilarity(a, b);
      const d = 1 - sim;
      diffs.push({
        key: k,
        a,
        b,
        diff: d,
        kind: "text"
      });
      continue;
    }

    const d = Math.abs(a - b);
    diffs.push({
      key: k,
      a,
      b,
      diff: d,
      kind: "common"
    });
  }

  diffs.sort((x, y) => {
    if (y.diff !== x.diff) return y.diff - x.diff;

    if (x.kind !== y.kind) {
      if (x.kind === "mismatch") return -1;
      if (y.kind === "mismatch") return 1;
    }

    return x.key.localeCompare(y.key);
  });

  return diffs.slice(0, Math.max(1, topN));
}


/* ==================================================
   HELPERS — GÉOMÉTRIE
================================================== */

function getFeatureCenterLatLng(feature) {
  if (!feature) return null;
  if (feature.__centerLatLng) return feature.__centerLatLng;

  const geom = feature.geometry;
  if (!geom) return null;

  const t = geom.type;
  const c = geom.coordinates;

  if (t === "Point") {
    const ll = L.latLng(c[1], c[0]);
    feature.__centerLatLng = ll;
    return ll;
  }

  if (t === "MultiPoint") {
    const ll = centroidFromCoordList(c);
    feature.__centerLatLng = ll;
    return ll;
  }

  if (t === "LineString") {
    const ll = centroidFromCoordList(c);
    feature.__centerLatLng = ll;
    return ll;
  }

  if (t === "MultiLineString") {
    const flat = c.flat(1);
    const ll = centroidFromCoordList(flat);
    feature.__centerLatLng = ll;
    return ll;
  }

  if (t === "Polygon") {
    const ring = Array.isArray(c[0]) ? c[0] : [];
    const ll = centroidFromCoordList(ring);
    feature.__centerLatLng = ll;
    return ll;
  }

  if (t === "MultiPolygon") {
    const flat = [];
    for (const poly of c) {
      const ring = Array.isArray(poly?.[0]) ? poly[0] : [];
      for (const pt of ring) flat.push(pt);
    }
    const ll = centroidFromCoordList(flat);
    feature.__centerLatLng = ll;
    return ll;
  }

  return null;
}

function centroidFromCoordList(coordList) {
  if (!Array.isArray(coordList) || coordList.length === 0) return null;

  let sumLng = 0;
  let sumLat = 0;
  let n = 0;

  for (const pt of coordList) {
    if (!pt || pt.length < 2) continue;

    const lng = Number(pt[0]);
    const lat = Number(pt[1]);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;

    sumLng += lng;
    sumLat += lat;
    n++;
  }

  if (!n) return null;
  return L.latLng(sumLat / n, sumLng / n);
}

function distanceMeters(a, b) {
  if (!a || !b) return Infinity;

  try {
    if (map && typeof map.distance === "function") {
      return map.distance(a, b);
    }
  } catch (e) {}

  const R = 6371000;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;

  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(s));
}

function featureWithinRadius(feature, centerLatLng, radiusM) {
  const ll = getFeatureCenterLatLng(feature);
  if (!ll) return false;
  return distanceMeters(ll, centerLatLng) <= radiusM;
}

function getFeatureCenter(feature) {
  if (feature.geometry?.type === 'Point') {
    const c = feature.geometry.coordinates;
    return L.latLng(c[1], c[0]);
  }

  const tmp = L.geoJSON(feature);

  try {
    return tmp.getBounds().getCenter();
  } catch (e) {
    const c = (
      feature.geometry &&
      feature.geometry.coordinates &&
      feature.geometry.coordinates[0]
    ) || [0, 0];

    return L.latLng(c[1] || 0, c[0] || 0);
  }
}





/* ==================================================
   HELPERS — temporalités
================================================== */


function cleanFragmentId(id) {
  return String(id || '').trim().toUpperCase();
}

function getSiteColor(zone) {
  return zone === 'mirail' ? 'blue' : 'red';
}

function getTemporalDatasetsForCurrentMode() {
  if (currentFragmentTimeMode === 'T2') {
    return {
      montreuil: dataGeojsonT2,
      mirail: datamGeojsonT2
    };
  }

  return {
    montreuil: dataGeojsonT1,
    mirail: datamGeojsonT1
  };
}

function getCurrentFragmentDatasets() {
  return getTemporalDatasetsForCurrentMode();
}

function buildTemporalPairsForZone(zone) {
  const t1 = zone === 'montreuil' ? (dataGeojsonT1 || []) : (datamGeojsonT1 || []);
  const t2 = zone === 'montreuil' ? (dataGeojsonT2 || []) : (datamGeojsonT2 || []);

  const map1 = new Map(t1.map(f => [cleanFragmentId(f.properties?.id), f]));
  const map2 = new Map(t2.map(f => [cleanFragmentId(f.properties?.id), f]));

  const ids = new Set([...map1.keys(), ...map2.keys()]);
  const out = [];

  ids.forEach(id => {
    const f1 = map1.get(id) || null;
    const f2 = map2.get(id) || null;

    let status = 'identical';
    if (!f1 && f2) status = 'appeared';
    else if (f1 && !f2) status = 'disappeared';
    else if (f1 && f2) {
      const changed = hasFragmentChangedBetweenT1T2(f1, f2);
      status = changed ? 'modified' : 'identical';
    }

    out.push({ id, zone, t1: f1, t2: f2, status });
  });

  return out;
}

function hasFragmentChangedBetweenT1T2(f1, f2) {
  if (!f1 || !f2) return true;

  const p1 = f1.properties || {};
  const p2 = f2.properties || {};

  const keysToCompare = [
    'name',
    'description',
    'usages',
    'acteur_actif',
    'initiateur',
    'elements_spatiaux',
    ...ALL_FUZZY_KEYS
  ];

  for (const k of keysToCompare) {
    const a = String(p1[k] ?? '').trim();
    const b = String(p2[k] ?? '').trim();
    if (a !== b) return true;
  }

  return !areGeometriesEquivalent(f1.geometry, f2.geometry);
}

function areGeometriesEquivalent(g1, g2) {
  try {
    return JSON.stringify(g1 || null) === JSON.stringify(g2 || null);
  } catch (e) {
    return false;
  }
}



function getSiteTemporalPalette(zone) {
  if (zone === 'mirail') {
    return {
      pale: '#9ec5ff',
      base: '#0000ff',
      dark: '#000075'
    };
  }

  return {
    pale: '#ffb0b0',
    base: '#ff0000',
    dark: '#780101'
  };
}


function getTrajectoryStyle(status, zone) {
  const palette = getSiteTemporalPalette(zone);

  if (status === 'identical') {
    return {
      color: palette.base,
      weight: 1.2,
      opacity: 0.95,
      fillColor: palette.base,
      fillOpacity: 0.3,
      radius: 4
    };
  }

  if (status === 'modified') {
    return {
      color: palette.pale,
      weight: 1.2,
      opacity: 1,
      fillColor: palette.pale,
      fillOpacity: 0.5,
      radius: 4
    };
  }

  if (status === 'appeared') {
    return {
      color: palette.dark,
      weight: 1.5,
      opacity: 1,
      fillColor: palette.dark,
      fillOpacity: 0.88,
      radius: 4
    };
  }

  return {
    color: '#d9d9d9',
    weight: 1.1,
    opacity: 0.95,
    fillColor: '#d9d9d9',
    fillOpacity: 0.22,
    radius: 4
  };
}

function getGreyTrajectoryStyle(status) {
  if (status === 'identical' || status === 'stable') {
    return {
      color: '#8a8a8a',
      weight: 1,
      opacity: 0.9,
      fillColor: '#8a8a8a',
      fillOpacity: 0.18,
      radius: 4
    };
  }

  if (status === 'modified') {
    return {
      color: '#b0b0b0',
      weight: 1.1,
      opacity: 0.95,
      fillColor: '#b0b0b0',
      fillOpacity: 0.28,
      radius: 4
    };
  }

  if (status === 'appeared') {
    return {
      color: '#d8d8d8',
      weight: 1.1,
      opacity: 1,
      fillColor: '#d8d8d8',
      fillOpacity: 0.42,
      radius: 4
    };
  }

  return {
    color: '#5f5f5f',
    weight: 1,
    opacity: 0.85,
    fillColor: '#5f5f5f',
    fillOpacity: 0.10,
    radius: 4
  };
}


function getFragmentProxemicSourceFeatures(timeMode = 'T1') {
  if (timeMode === 'T2') {
    return [...(dataGeojsonT2 || []), ...(datamGeojsonT2 || [])];
  }

  if (timeMode === 'trajectories') {
    const out = [];

    ['montreuil', 'mirail'].forEach(zone => {
      const pairs = buildTemporalPairsForZone(zone);

      pairs.forEach(pair => {
        const feature = pair.t2 || pair.t1;
        if (!feature) return;

        out.push({
          ...feature,
          properties: {
            ...(feature.properties || {}),
            __trajectoryStatus: pair.status,
            __trajectoryPair: pair
          }
        });
      });
    });

    return out;
  }

  return [...(dataGeojsonT1 || []), ...(datamGeojsonT1 || [])];
}


function getZoneTemporalArrays(zone) {
  if (zone === 'mirail') {
    return {
      t1: datamGeojsonT1 || [],
      t2: datamGeojsonT2 || []
    };
  }

  return {
    t1: dataGeojsonT1 || [],
    t2: dataGeojsonT2 || []
  };
}

function getTemporalRepresentativeFeature(pair) {
  // choix simple et stable :
  // - si T2 existe, on prend T2 comme état représentatif
  // - sinon on garde T1
  return pair?.t2 || pair?.t1 || null;
}

function buildTemporalFragmentIndex() {
  const zones = ['montreuil', 'mirail'];
  const out = {
    montreuil: new Map(),
    mirail: new Map()
  };

  zones.forEach(zone => {
    const { t1, t2 } = getZoneTemporalArrays(zone);

    const map1 = new Map((t1 || []).map(f => [cleanFragmentId(f.properties?.id), f]));
    const map2 = new Map((t2 || []).map(f => [cleanFragmentId(f.properties?.id), f]));

    const ids = new Set([...map1.keys(), ...map2.keys()]);

    ids.forEach(id => {
      const f1 = map1.get(id) || null;
      const f2 = map2.get(id) || null;

      let status = 'stable';
      let delta = null;

      if (f1 && f2) {
        const vec1 = featureToVector(f1);
        const vec2 = featureToVector(f2);
        const sim = similarityFuzzy(vec1, vec2);
        delta = Math.max(0, 1 - sim);

        status = delta > 0 ? 'modified' : 'stable';
      } else if (f1 && !f2) {
        status = 'disappeared';
      } else if (!f1 && f2) {
        status = 'appeared';
      }

      out[zone].set(id, {
        id,
        zone,
        t1: f1,
        t2: f2,
        status,
        delta,
        representative: getTemporalRepresentativeFeature({ t1: f1, t2: f2 })
      });
    });
  });

  temporalFragmentIndex = out;
  return out;
}

function getTemporalInfoForFragmentId(fragmentId, zone) {
  const z = zone || 'montreuil';
  const id = cleanFragmentId(fragmentId);
  return temporalFragmentIndex?.[z]?.get(id) || null;
}

function getTemporalStatusSimilarity(statusA, statusB) {
  if (!statusA || !statusB) return 0;

  if (statusA === statusB) return 1;

  if (TEMPORAL_APP_DIS_STRICT) {
    if (
      (statusA === 'appeared' && statusB === 'disappeared') ||
      (statusA === 'disappeared' && statusB === 'appeared')
    ) {
      return 0;
    }
  }

  return Math.max(0, 1 - TEMPORAL_STATUS_PENALTY);
}

function getTemporalDeltaSimilarity(infoA, infoB) {
  if (!infoA || !infoB) return 0;

  const statusA = infoA.status;
  const statusB = infoB.status;

  // cas stricts sans delta numérique
  if (statusA === 'appeared' && statusB === 'appeared') return 1;
  if (statusA === 'disappeared' && statusB === 'disappeared') return 1;

  // apparu ≠ disparu : distincts
  if (
    (statusA === 'appeared' && statusB === 'disappeared') ||
    (statusA === 'disappeared' && statusB === 'appeared')
  ) {
    return 0;
  }

  // si statuts différents (ex stable vs modified)
  if (statusA !== statusB) {
    return Math.max(0, 1 - TEMPORAL_STATUS_PENALTY);
  }

  // stable/modifié avec delta numérique
  if (
    (statusA === 'stable' || statusA === 'modified') &&
    (statusB === 'stable' || statusB === 'modified')
  ) {
    const dA = Number.isFinite(infoA.delta) ? infoA.delta : 0;
    const dB = Number.isFinite(infoB.delta) ? infoB.delta : 0;
    return Math.max(0, 1 - Math.abs(dA - dB));
  }

  return 0;
}

function computeFragmentTemporalProfile(feature) {
  const props = feature?.properties || {};
  const id = cleanFragmentId(props.id);
  const zone = props.zone || 'montreuil';

  const info = getTemporalInfoForFragmentId(id, zone);

  return {
    id,
    zone,
    status: info?.status || 'stable',
    delta: info?.delta ?? null
  };
}

function buildTemporalProfilesForAgencement(fragmentsInCircle) {
  return (fragmentsInCircle || [])
    .map(f => computeFragmentTemporalProfile(f))
    .filter(p => p.id);
}

function computeTemporalFragmentPairScore(profileA, profileB) {
  if (!profileA || !profileB) return 0;

  const sStatus = getTemporalStatusSimilarity(profileA.status, profileB.status);
  const sDelta = getTemporalDeltaSimilarity(profileA, profileB);

  // si mêmes statuts "apparu/appa ru" ou "disparu/disparu", sDelta = 1
  // si stable/modified, sDelta compare les deltas
  // si statuts différents, sStatus porte la pénalité
  const score = Math.min(sStatus, sDelta);

  return Math.max(TEMPORAL_MIN_MATCH_SCORE, score);
}

function computeBestTemporalMatchScore(profileA, profilesB, usedIds = new Set()) {
  let bestScore = -1;
  let bestIdx = -1;

  profilesB.forEach((profileB, idx) => {
    if (usedIds.has(idx)) return;

    const s = computeTemporalFragmentPairScore(profileA, profileB);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = idx;
    }
  });

  return { bestScore, bestIdx };
}

function similarityTemporalAgencements(agA, agB) {
  const profilesA = agA?.temporalProfiles || [];
  const profilesB = agB?.temporalProfiles || [];

  if (!profilesA.length || !profilesB.length) return 0;

  // on apparie toujours la plus petite liste vers la plus grande
  const small = profilesA.length <= profilesB.length ? profilesA : profilesB;
  const large = profilesA.length <= profilesB.length ? profilesB : profilesA;

  const used = new Set();
  let sum = 0;
  let count = 0;

  small.forEach(profileA => {
    const { bestScore, bestIdx } = computeBestTemporalMatchScore(profileA, large, used);
    if (bestIdx >= 0) {
      used.add(bestIdx);
      sum += bestScore;
      count++;
    }
  });

  if (!count) return 0;

  // pénalité légère si les tailles diffèrent beaucoup
  const sizePenalty = Math.min(small.length, large.length) / Math.max(small.length, large.length);

  return (sum / count) * sizePenalty;
}



/* ==================================================
   HELPERS — IMAGES
================================================== */

function cleanPhotoUrl(u) {
  if (!u) return null;

  let s = String(u).trim().replace(/^http:\/\//i, 'https://');
  const m = s.match(/https?:\/\/[^\s"'<>]+/i);

  return m ? m[0] : null;
}

function normalizePhotos(p) {
  if (!p) return [];
  if (Array.isArray(p)) return p;

  if (typeof p === 'string') {
    return p.split(/[;,]\s*/).filter(Boolean);
  }

  return [];
}

function makeImg(src, alt = 'photo', { priority = 'low', lazy = true } = {}) {
  const url = cleanPhotoUrl(src);
  if (!url) return null;

  const img = document.createElement('img');
  img.alt = alt;
  img.decoding = 'async';
  img.referrerPolicy = 'no-referrer';
  img.onerror = () => {
    img.style.display = 'none';
  };

  img.setAttribute('fetchpriority', priority);
  img.fetchPriority = priority;

  if (lazy) img.loading = 'lazy';

  if (lazy && 'IntersectionObserver' in window) {
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    img.dataset.src = url;
    ensureImgObserver().observe(img);
  } else {
    img.src = url;
  }

  return img;
}



function ensureImgObserver() {
  if (__imgObserver) return __imgObserver;

  __imgObserver = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const img = entry.target;
      const real = img.dataset.src;

      if (real) {
        img.src = real;
        img.removeAttribute('data-src');
      }

      obs.unobserve(img);
    });
  }, {
    rootMargin: '800px 0px',
    threshold: 0.01
  });

  return __imgObserver;
}


/* ==================================================
   HELPERS — BÂTIMENTS
================================================== */

function getPropEtat(props) {
  const v = props?.['état'] ?? props?.['etat'] ?? 'inconnu';
  return normStr(v);
}

function getPropFonction(props) {
  const v = props?.['fonction'] ?? 'inconnu';
  return normStr(v);
}

function ensureBuildingHatchDefs(leafletMap) {
  const pane = leafletMap.getPanes().overlayPane;
  const svg = pane.querySelector('svg');
  if (!svg) return;

  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.insertBefore(defs, svg.firstChild);
  }

  if (defs.querySelector('#hatch-solid')) return;

  const p1 = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
  p1.setAttribute('id', 'hatch-solid');
  p1.setAttribute('patternUnits', 'userSpaceOnUse');
  p1.setAttribute('width', '8');
  p1.setAttribute('height', '8');
  p1.setAttribute('patternTransform', 'rotate(45)');

  const l1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l1.setAttribute('x1', '0');
  l1.setAttribute('y1', '0');
  l1.setAttribute('x2', '0');
  l1.setAttribute('y2', '8');
  l1.setAttribute('stroke', '#9a9a9a');
  l1.setAttribute('stroke-width', '2');
  p1.appendChild(l1);

  const p2 = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
  p2.setAttribute('id', 'hatch-light');
  p2.setAttribute('patternUnits', 'userSpaceOnUse');
  p2.setAttribute('width', '10');
  p2.setAttribute('height', '10');
  p2.setAttribute('patternTransform', 'rotate(45)');

  const l2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  l2.setAttribute('x1', '0');
  l2.setAttribute('y1', '0');
  l2.setAttribute('x2', '0');
  l2.setAttribute('y2', '10');
  l2.setAttribute('stroke', '#a8a8a8');
  l2.setAttribute('stroke-width', '1.5');
  p2.appendChild(l2);

  defs.appendChild(p1);
  defs.appendChild(p2);
}

function applyHatchToLeafletLayer(layer, hatchId, fallbackFill = 'none') {
  if (!layer || !layer._path) return;

  if (!hatchId) {
    layer._path.setAttribute('fill', fallbackFill);
    return;
  }

  layer._path.setAttribute('fill', `url(#${hatchId})`);
}

function computeBuildingStyle(props) {
  if (BUILDINGS_STYLE_MODE === 'fonction') {
    const fct = getPropFonction(props);

    if (fct === 'logement') {
      return {
        style: {
          stroke: false,
          fill: true,
          fillColor: '#ffffff',
          fillOpacity: 0.22
        },
        hatch: null
      };
    }

    const c = BUILDING_FUNCTION_COLORS[fct] || BUILDING_FUNCTION_COLORS.autre;

    return {
      style: {
        stroke: false,
        fill: true,
        fillColor: c,
        fillOpacity: 1
      },
      hatch: null
    };
  }

  const etat = getPropEtat(props);
  const GREY = '#8f8f8f';

  let style = {
    stroke: false,
    fill: true,
    fillColor: GREY,
    fillOpacity: 0.75
  };

  let hatch = null;

  if (etat === 'habité' || etat === 'inconnu') {
    style = {
      stroke: false,
      fill: true,
      fillColor: GREY,
      fillOpacity: 0.75
    };
  } else if (etat === 'démoli' || etat === 'demoli') {
    style = {
      stroke: true,
      color: GREY,
      weight: 1,
      dashArray: '4 4',
      fill: false,
      fillOpacity: 0
    };
  } else if (etat === 'vacant') {
    style = {
      stroke: true,
      color: GREY,
      weight: 1,
      dashArray: null,
      fill: false,
      fillOpacity: 0
    };
  } else if (etat === 'condamné' || etat === 'condamne') {
    style = {
      stroke: true,
      color: GREY,
      weight: 1,
      dashArray: null,
      fill: true,
      fillColor: GREY,
      fillOpacity: 0.6
    };
    hatch = 'hatch-solid';
  } else if (
    etat === 'en cours de démolition' ||
    etat === 'en cours de demoliton' ||
    etat === 'en cours de demolition'
  ) {
    style = {
      stroke: true,
      color: GREY,
      weight: 1,
      dashArray: '4 4',
      fill: true,
      fillColor: GREY,
      fillOpacity: 0.6
    };
    hatch = 'hatch-solid';
  } else if (
    etat === 'en cours de rénovation' ||
    etat === 'en cours de renovation'
  ) {
    style = {
      stroke: false,
      fill: true,
      fillColor: GREY,
      fillOpacity: 0.25
    };
  } else {
    style = {
      stroke: false,
      fill: true,
      fillColor: GREY,
      fillOpacity: 0.75
    };
  }

  return { style, hatch };
}

function restyleBuildingsOnFragmentsMap() {
  if (!map) return;

  ensureBuildingHatchDefs(map);

  const candidates = [
    batimentsLayerMontreuil,
    batimentsLayerToulouse
  ].filter(Boolean);

  candidates.forEach(geoLayer => {
    geoLayer.eachLayer(l => {
      const props = l?.feature?.properties || {};
      const { style, hatch } = computeBuildingStyle(props);

      if (l.setStyle) l.setStyle(style);

      requestAnimationFrame(() => {
        if (!l._path) return;

        if (hatch) {
          applyHatchToLeafletLayer(l, hatch);
          l._path.setAttribute('fill-opacity', String(style.fillOpacity ?? 1));
        } else {
          const fallback =
            (style.fill === false || style.fillOpacity === 0)
              ? 'none'
              : (style.fillColor || 'none');

          applyHatchToLeafletLayer(l, null, fallback);
          l._path.setAttribute('fill-opacity', String(style.fillOpacity ?? 1));
        }
      });
    });
  });
}


/* ==================================================
   HELPERS — PATTERNS ET AGENCEMENTS
================================================== */

function average(nums) {
  const vals = (nums || []).filter(v => Number.isFinite(v));
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function stdev(nums) {
  const vals = (nums || []).filter(v => Number.isFinite(v));
  if (vals.length < 2) return 0;

  const m = average(vals);
  const v = vals.reduce((acc, x) => acc + Math.pow(x - m, 2), 0) / vals.length;

  return Math.sqrt(v);
}

function normalizedValue(v) {
  const n = parseFuzzy(v);
  if (n === null) return null;
  return Math.max(0, Math.min(1, n));
}

function addCount(map, key, inc = 1) {
  map[key] = (map[key] || 0) + inc;
}

function overlapRatioByIds(idsA, idsB) {
  const A = new Set(idsA || []);
  const B = new Set(idsB || []);
  if (!A.size || !B.size) return 0;

  let inter = 0;
  for (const x of A) {
    if (B.has(x)) inter++;
  }

  return inter / Math.min(A.size, B.size);
}

function topEntries(obj, topN = 8) {
  return Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([label, count]) => ({ label, count }));
}

function getActiveCriteriaKeysArray() {
  return Array.from(ACTIVE_CRITERIA_KEYS || []);
}

function computeFragmentsUnionFromOccurrences(occIds) {
  const out = new Set();

  (occIds || []).forEach(oid => {
    const ag = agencementsById.get(oid);
    (ag?.fragmentIds || []).forEach(fid => out.add(String(fid).trim()));
  });

  return Array.from(out);
}

function getCurrentPatternParams() {
  return {
    perimeterDiameterM: PERIMETER_DIAMETER_M,
    agSimilarityThreshold: AG_SIM_THRESHOLD,
    zones: getActiveZones ? getActiveZones() : [],
    activeCriteriaKeys: getActiveCriteriaKeysArray()
  };
}





/* ==================================================
   NAVIGATION — CHANGEMENT DE TERRITOIRE
   Bascule la carte active entre Montreuil et Toulouse.
   La carte visée dépend de la vue ouverte :
   - carte fragments
   - carte patterns
   - carte unité
================================================== */
function toggleLocation() {
  const locationButton = document.getElementById('toggle-location-btn');
  let targetMap = map;

  if (currentView === 'patterns-map') {
    initPatternMapOnce();
    if (patternMap) targetMap = patternMap;
  } else if (currentView === 'unit' || currentView === 'unit-view') {
    ensureUnitMap();
    if (unitMap) targetMap = unitMap;
  }

  if (currentLocation === 'montreuil') {
    targetMap.setView(toulouseView, toulouseZoom);
    currentLocation = 'toulouse';
    if (locationButton) locationButton.textContent = 'Voir Montreuil';
  } else {
    targetMap.setView(montreuilView, montreuilZoom);
    currentLocation = 'montreuil';
    if (locationButton) locationButton.textContent = 'Voir Toulouse';
  }

  if (currentView === 'map') {
    restyleBuildingsOnFragmentsMap();
  }
}

/* ==================================================
   SIDEBAR — OUVERTURE D’UN PANNEAU
   Ouvre le bon onglet selon le type d’objet cliqué :
   fragment, bâtiment, discours ou pattern.
================================================== */

function openSidebar(el) {
  if (!el) return;
  el.style.display   = 'block';
  el.style.position  = 'fixed';
  el.style.top       = '90px';
  el.style.right     = '10px';
  el.style.maxHeight = 'calc(100vh - 120px)';
  el.style.overflowY = 'auto';
  el.style.zIndex    = '4001'; // au-dessus du footer & panes
}

// Ouvre le bon panneau selon le type d’objet cliqué
function showDetails(props) {
  clearAllTabbedTabs(); // exclusif : 1 clic = 1 set d’infos (fonction en Partie 2)

  if (props.isPattern) {
    const key = props.patternKey || 'Pattern';
    openTab({                         // openTab / renderPatternPanel en Partie 2
      id: `pattern-${key}`,
      title: key,
      kind: 'pattern',
      render: (panel) => renderPatternPanel(panel, key, patterns[key] || {})
    });
  } else if (props.isDiscourse) {
    openTab({                         // renderDiscoursePanel en Partie 2
      id: `disc-${props.id || Math.random().toString(36).slice(2)}`,
      title: props.id || 'Discours',
      kind: 'discourse',
      render: (panel) => renderDiscoursePanel(panel, props)
    });
 } else if (props.isBuilding) {
    const bid = props.id || Math.random().toString(36).slice(2);
    openTab({
      id: `bat-${bid}`,
      title: props.id || 'Bâtiment',
      kind: 'building',
      render: (panel) => renderBuildingPanel(panel, props)
    });
  } else {
    const fid = props.id || Math.random().toString(36).slice(2);
    openTab({                         // renderFragmentPanel en Partie 2
      id: `frag-${fid}`,
      title: props.id || 'Fragment',
      kind: 'fragment',
      render: (panel) => renderFragmentPanel(panel, props)
    });
  }

  // masque les anciennes sidebars (sécurité)
  const sb1 = document.getElementById('spatial-sidebar');
  const sb2 = document.getElementById('discourse-sidebar');
  if (sb1) sb1.style.display = 'none';
  if (sb2) sb2.style.display = 'none';
}

function closeSidebars() {
  const sb1 = document.getElementById('spatial-sidebar');
  const sb2 = document.getElementById('discourse-sidebar');
  if (sb1) sb1.style.display = 'none';
  if (sb2) sb2.style.display = 'none';
  clearAllTabbedTabs(); // (Partie 2)
}

/* ==================================================
   FILTRES — MISE À JOUR GLOBALE
   1) masque / affiche les couches selon les zones
   2) recalcule les agencements et patterns visibles
   3) rafraîchit la vue active
================================================== */

function applyFilters() {
  const showDiscourses = true;
  const activeZones = getActiveZones();

  allLayers.forEach(layer => {
    const props = layer?.feature?.properties || {};
    const isDiscourse = !!props.isDiscourse;
    const isBuilding = !!props.isBuilding;

    if (!isDiscourse && !isBuilding) return;

    const showLayer = isDiscourse ? showDiscourses : activeZones.includes(layer.zone);

    if (showLayer) {
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }
  });

  if (currentView === 'map') {
    renderFragmentsMapByTimeMode();
  }

  const { visibleFragments, visibleBuildings } = getVisibleSpatialFeaturesForPatterns();

  recomputeAgencementPatterns({
    fragments: visibleFragments,
    buildings: visibleBuildings
  });

  if (currentView === 'fragment-proxemic') {
    showFragmentProxemicView();
  } else if (currentView === 'proxemic') {
    showProxemicView();
  } else if (currentView === 'gallery') {
    showGalleryView();
  } else if (currentView === 'patterns-map') {
    renderPatternBaseGrey();
    refreshPatternsMap();
  }

  if (discoursLayer) discoursLayer.bringToFront();
}


function recomputeAgencementPatterns({ fragments, buildings }) {
  agencements = buildAgencements({
    fragments,
    buildings,
    diameterM: PERIMETER_DIAMETER_M
  });

  agencementsById = new Map((agencements || []).map(a => [a.id, a]));

  agencementPatterns = clusterAgencementsIntoPatterns(agencements, AG_SIM_THRESHOLD);
  patterns = agencementPatterns;

  fragmentToPatternIds = new Map();

  (agencements || []).forEach(ag => {
    const pList = ag.patternIds || [];
    if (!pList.length) return;

    (ag.fragmentIds || []).forEach(fid => {
      const id = String(fid).trim();
      if (!fragmentToPatternIds.has(id)) fragmentToPatternIds.set(id, []);
      fragmentToPatternIds.get(id).push(...pList);
    });
  });

  fragmentToPatternIds.forEach((arr, fid) => {
    const uniq = Array.from(new Set(arr));
    uniq.sort((a, b) => parseInt(a.replace('P', ''), 10) - parseInt(b.replace('P', ''), 10));
    fragmentToPatternIds.set(fid, uniq);
  });
}


/*---------------------------------------
  AGENCEMENTS (Étape 2) : construction des occurrences
---------------------------------------*/


function getActiveFuzzyValues(props) {
  const out = {};
  for (const k of ALL_FUZZY_KEYS) {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) continue;
    out[k] = normalizedValue(props?.[k]);
  }
  return out;
}

function computePoleScoresFromProps(props) {
  const groups = {
    PA: [],
    DH: [],
    FS: []
  };

  FUZZY_GROUPS.PA.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;
    const v = normalizedValue(props?.[k]);
    if (v !== null) groups.PA.push(v);
  });

  FUZZY_GROUPS.DH.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;
    const v = normalizedValue(props?.[k]);
    if (v !== null) groups.DH.push(v);
  });

  FUZZY_GROUPS.FS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;
    const v = normalizedValue(props?.[k]);
    if (v !== null) groups.FS.push(v);
  });

  return {
    PA: average(groups.PA),
    DH: average(groups.DH),
    FS: average(groups.FS)
  };
}

function getDominantPole(scores) {
  const entries = Object.entries(scores).filter(([, v]) => v !== null);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function getFragmentNodeProfile(feature) {
  const props = feature?.properties || {};
  const fuzzyVals = getActiveFuzzyValues(props);
  const poleScores = computePoleScoresFromProps(props);
  const dominantPole = getDominantPole(poleScores);
  const temporalProfile = computeFragmentTemporalProfile(feature);

  const textTokens = {};
  for (const k of TEXT_KEYS) {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) continue;
    textTokens[k] = parseMultiText(props?.[k]) || [];
  }

  return {
    id: String(props.id || '').trim(),
    center: getFeatureCenterLatLng(feature),
    fuzzyVals,
    poleScores,
    dominantPole,
    textTokens,
    temporalProfile
  };
}

function getBuildingsInSameAgencement(fragment, buildings) {
  const c = getFeatureCenterLatLng(fragment);
  if (!c) return [];

  const out = [];
  for (const b of (buildings || [])) {
    const bc = getFeatureCenterLatLng(b);
    if (!bc) continue;
    const d = distanceMeters(c, bc);
    out.push({ building: b, dist: d });
  }

  out.sort((a, b) => a.dist - b.dist);
  return out;
}

function computePairRelation(nodeA, nodeB) {
  const deltas = [];

  ["PA", "DH", "FS"].forEach(p => {
    const a = nodeA.poleScores[p];
    const b = nodeB.poleScores[p];
    if (a !== null && b !== null) deltas.push(Math.abs(a - b));
  });

  const poleGap = deltas.length ? average(deltas) : null;

  return {
    poleGap
  };
}

function computeAgencementRelationalSignature(fragmentsInCircle, buildingsInCircle, radiusM) {
  const nodeProfiles = fragmentsInCircle.map(getFragmentNodeProfile).filter(n => n.id && n.center);
  const temporalProfiles = nodeProfiles.map(n => n.temporalProfile).filter(Boolean);

  const nodeMotifs = {};
  const buildingMotifs = {};
  const rareMotifs = {};
  const numericMeans = {};
  const numericSpread = {};
  const textTokens = {};

  ALL_FUZZY_KEYS.forEach(k => {
    numericMeans[k] = null;
    numericSpread[k] = null;
  });
  TEXT_KEYS.forEach(k => {
    textTokens[k] = [];
  });

  if (!nodeProfiles.length) {
  return {
    nodeCount: 0,
    edgeCount: 0,
    density: 0,
    nodeMotifs,
    buildingMotifs,
    rareMotifs,
    numericMeans,
    numericSpread,
    textTokens,
    dominantPoleShares: {},
    buildingContextStats: {},
    internalContrast: 0,
    temporalProfiles: []
  };
}

  // 1) motifs de nœuds
  const dominantPoleCount = { PA: 0, DH: 0, FS: 0, unknown: 0 };

nodeProfiles.forEach(n => {
  const pole = n.dominantPole || "unknown";
  dominantPoleCount[pole] = (dominantPoleCount[pole] || 0) + 1;

  ALL_FUZZY_KEYS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;

    const v = n.fuzzyVals[k];

    if (v === null || v === undefined) {
      addCount(nodeMotifs, `node_${k}:__NULL__`, SHARED_NULL_WEIGHT);
      return;
    }

    const rounded = Math.round(v * 100) / 100;
    addCount(nodeMotifs, `node_${k}:${rounded.toFixed(2)}`, 1);
  });

  TEXT_KEYS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;

    const toks = n.textTokens[k] || [];
    if (!toks.length) {
      addCount(nodeMotifs, `node_${k}:__NULL__`, SHARED_NULL_WEIGHT);
      return;
    }

    toks.forEach(tok => addCount(nodeMotifs, `node_${k}:${tok}`, 1));
  });
});

  // 2) edges ouverts = voisinages spatiaux
  let edgeCount = 0;
  const pairDistances = [];
  const localDegrees = new Map(nodeProfiles.map(n => [n.id, 0]));
  const internalContrasts = [];

  for (let i = 0; i < nodeProfiles.length; i++) {
  for (let j = i + 1; j < nodeProfiles.length; j++) {
    const a = nodeProfiles[i];
    const b = nodeProfiles[j];
    const d = distanceMeters(a.center, b.center);

    edgeCount++;
    localDegrees.set(a.id, (localDegrees.get(a.id) || 0) + 1);
    localDegrees.set(b.id, (localDegrees.get(b.id) || 0) + 1);

    if (Number.isFinite(d)) {
      pairDistances.push(d);
    }

    const rel = computePairRelation(a, b);

    if (rel.poleGap !== null) {
      internalContrasts.push(rel.poleGap);
    }
  }
}

  // 3) relation fragments ↔ bâtiments proches
  const buildingDistances = [];
  const buildingStates = {};
  const buildingFunctions = {};

  (buildingsInCircle || []).forEach(b => {
    const p = b?.properties || {};
    const etat = getPropEtat(p) || "inconnu";
    const fonction = getPropFonction(p) || "inconnu";
    buildingStates[etat] = (buildingStates[etat] || 0) + 1;
    buildingFunctions[fonction] = (buildingFunctions[fonction] || 0) + 1;
  });

  nodeProfiles.forEach(n => {
    const frag = fragmentsInCircle.find(f => String(f?.properties?.id || '').trim() === n.id);
    const nearB = getBuildingsInSameAgencement(frag, buildingsInCircle);

    if (!nearB.length) {
      addCount(buildingMotifs, `frag_building:none`, 1);
      return;
    }

    const first = nearB[0];
    const bp = first.building?.properties || {};
    const etat = getPropEtat(bp) || "inconnu";
    const fonction = getPropFonction(bp) || "inconnu";
    const dist = first.dist;

    buildingDistances.push(dist);

    addCount(buildingMotifs, `frag_building_state:${etat}`, 1);
    addCount(buildingMotifs, `frag_building_function:${fonction}`, 1);

    const dbin =
  dist <= radiusM * 0.33 ? "near" :
  dist <= radiusM * 0.66 ? "mid" : "far";
addCount(buildingMotifs, `frag_building_dist:${dbin}`, 1);

    if (n.dominantPole) {
      addCount(buildingMotifs, `fragpole_buildingstate:${n.dominantPole}_${etat}`, 1);
      addCount(buildingMotifs, `fragpole_buildingfunction:${n.dominantPole}_${fonction}`, 1);
    }
  });

  // 4) stats numériques internes
  ALL_FUZZY_KEYS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;

    const vals = nodeProfiles
      .map(n => n.fuzzyVals[k])
      .filter(v => v !== null);

    numericMeans[k] = vals.length ? average(vals) : null;
    numericSpread[k] = vals.length ? stdev(vals) : null;
  });

  TEXT_KEYS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;
    const s = new Set();
    nodeProfiles.forEach(n => (n.textTokens[k] || []).forEach(tok => s.add(tok)));
    textTokens[k] = Array.from(s);
  });

  const possibleEdges = (nodeProfiles.length * (nodeProfiles.length - 1)) / 2;
  const density = possibleEdges > 0 ? edgeCount / possibleEdges : 0;

  const dominantPoleShares = {
    PA: (dominantPoleCount.PA || 0) / nodeProfiles.length,
    DH: (dominantPoleCount.DH || 0) / nodeProfiles.length,
    FS: (dominantPoleCount.FS || 0) / nodeProfiles.length
  };

  // 5) motifs rares
Object.entries(nodeMotifs).forEach(([k, v]) => {
  if (v <= 1) addCount(rareMotifs, k, 1);
});

Object.entries(buildingMotifs).forEach(([k, v]) => {
  if (v <= 1) addCount(rareMotifs, k, 1);
});

    return {
    nodeCount: nodeProfiles.length,
    edgeCount,
    density,
    avgPairDistance: pairDistances.length ? average(pairDistances) : null,
    avgLocalDegree: average(Array.from(localDegrees.values())),
    nodeMotifs,
    buildingMotifs,
    rareMotifs,
    numericMeans,
    numericSpread,
    textTokens,
    dominantPoleShares,
    buildingContextStats: {
      totalBuildings: (buildingsInCircle || []).length,
      avgBuildingDistance: buildingDistances.length ? average(buildingDistances) : null,
      stateCounts: buildingStates,
      functionCounts: buildingFunctions
    },
    internalContrast: internalContrasts.length ? average(internalContrasts) : 0,
    temporalProfiles
  };
}




function buildAgencements({ fragments, buildings, diameterM }) {
  const radiusM = Math.max(10, Number(diameterM) / 2);

  const frags = (fragments || []).filter(Boolean);
  const blds  = (buildings || []).filter(Boolean);

  const fragCenters = frags.map(f => getFeatureCenterLatLng(f));
  const bldCenters  = blds.map(b => getFeatureCenterLatLng(b));

  const uniq = new Map();
  const keptCenters = [];
  const SEED_SPACING_FACTOR = 0.55;
  const seedMinDist = radiusM * SEED_SPACING_FACTOR;

  let idx = 1;

  for (let i = 0; i < frags.length; i++) {
    const center = fragCenters[i];
    if (!center) continue;

    let tooClose = false;
    for (const c0 of keptCenters) {
      if (distanceMeters(c0, center) <= seedMinDist) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const fragmentsInCircle = [];
const fragmentIds = [];

for (let j = 0; j < frags.length; j++) {
  const ll = fragCenters[j];
  if (!ll) continue;
  if (distanceMeters(ll, center) <= radiusM) {
    fragmentsInCircle.push(frags[j]);
    fragmentIds.push(String(frags[j]?.properties?.id ?? `frag_${j}`).trim());
  }
}

const buildingsInCircle = [];
const buildingIds = [];

for (let k = 0; k < blds.length; k++) {
  const ll = bldCenters[k];
  if (!ll) continue;
  if (distanceMeters(ll, center) <= radiusM) {
    buildingsInCircle.push(blds[k]);
    buildingIds.push(String(blds[k]?.properties?.id ?? `bld_${k}`).trim());
  }
}

const fragCount = fragmentsInCircle.length;
const bldCount = buildingsInCircle.length;

const isValidAgencement =
  fragCount >= MIN_AG_FRAGMENTS ||
  (
    ALLOW_SINGLE_FRAGMENT_WITH_BUILDINGS &&
    fragCount === 1 &&
    bldCount >= MIN_BUILDINGS_FOR_SINGLE_FRAGMENT
  );

if (!isValidAgencement) continue;


    fragmentIds.sort();
    buildingIds.sort();

    // clé de dédup plus souple, centrée sur fragments + taille
    const key = [
      `F:${fragmentIds.join("|")}`,
      `B:${buildingIds.slice(0, 8).join("|")}`,
      `N:${fragmentIds.length}`
    ].join("::");

    if (uniq.has(key)) continue;

    const relational = computeAgencementRelationalSignature(
      fragmentsInCircle,
      buildingsInCircle,
      radiusM
    );

        uniq.set(key, {
      id: `A${idx++}`,
      center,
      radiusM,
      fragmentIds,
      buildingIds,
      fragmentsCount: fragmentsInCircle.length,
      buildingsCount: buildingsInCircle.length,
      fragmentsAgg: relational,   // on garde ce nom pour ne pas casser le reste
      buildingsAgg: relational.buildingContextStats,
      temporalProfiles: relational.temporalProfiles || [],
      patternIds: []
    });

    keptCenters.push(center);
  }

  return Array.from(uniq.values());
}

/*---------------------------------------
  AGENCEMENTS (Étape 3) : vectorisation + similarité + clustering
---------------------------------------*/



function canJoinCluster(candidate, clusterMembers, threshold) {
  for (const other of clusterMembers) {
    const ov = overlapRatioByIds(candidate.fragmentIds, other.fragmentIds);
    if (ov > MAX_AG_OVERLAP) return false;

    const sim = similarityAgencements(candidate, other);
    if (sim < threshold) return false;
  }
  return true;
}

function summarizePatternOccurrences(occurrences) {
  const signature = computePatternSignatureFromOccurrences(occurrences);

  return {
    numericMeans: signature.numericMeans,
    numericSpread: signature.numericSpread,
    textTokens: signature.textTokens,
    dominantPoleShares: signature.dominantPoleShares,
    internalContrast: signature.internalContrast,
    temporalStatusCounts: signature.temporalStatusCounts
  };
}

function clusterAgencementsIntoPatterns(ags, threshold) {
  const list = (ags || []).slice();
  if (list.length < 2) return {};

  list.forEach(a => { a.patternIds = []; });

  // tri par richesse descriptive de l’agencement
list.sort((a, b) => {
  const sa =
    Object.keys(a.fragmentsAgg?.nodeMotifs || {}).length +
    Object.keys(a.fragmentsAgg?.buildingMotifs || {}).length;

  const sb =
    Object.keys(b.fragmentsAgg?.nodeMotifs || {}).length +
    Object.keys(b.fragmentsAgg?.buildingMotifs || {}).length;

  return sb - sa;
});

  const clusters = [];

  list.forEach(ag => {
    let placed = false;

    for (const cluster of clusters) {
      if (canJoinCluster(ag, cluster.members, threshold)) {
        cluster.members.push(ag);
        placed = true;
        break;
      }
    }

    if (!placed) {
      clusters.push({ members: [ag] });
    }
  });

  const patternsObj = {};
  let pIndex = 1;

  clusters.forEach(cluster => {
    if (cluster.members.length < MIN_PATTERN_OCCURRENCES) return;

    const key = `P${pIndex++}`;
    const occIds = cluster.members.map(a => a.id);

    cluster.members.forEach(a => {
      a.patternIds = a.patternIds || [];
      a.patternIds.push(key);
    });

    patternsObj[key] = {
      name: key,
      occurrences: occIds,
      size: occIds.length,
      summary: summarizePatternOccurrences(cluster.members)
    };
  });

  return patternsObj;
}


function weightedCountSimilarity(countsA = {}, countsB = {}, rareA = {}, rareB = {}) {
  const keys = new Set([
    ...Object.keys(countsA || {}),
    ...Object.keys(countsB || {})
  ]);
  if (!keys.size) return 0;

  let inter = 0;
  let uni = 0;

  keys.forEach(k => {
    const a = countsA[k] || 0;
    const b = countsB[k] || 0;

    const rareBoost = (rareA[k] || rareB[k]) ? (1 + RARE_MOTIF_BOOST) : 1;

    inter += Math.min(a, b) * rareBoost;
    uni   += Math.max(a, b) * rareBoost;
  });

  return uni ? (inter / uni) : 0;
}

function similarityNumericStats(agA, agB) {
  let sum = 0;
  let count = 0;

  ALL_FUZZY_KEYS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;

    const aM = agA.fragmentsAgg?.numericMeans?.[k];
    const bM = agB.fragmentsAgg?.numericMeans?.[k];
    const aS = agA.fragmentsAgg?.numericSpread?.[k];
    const bS = agB.fragmentsAgg?.numericSpread?.[k];

    if (aM === null && bM === null) {
      if (COUNT_SHARED_NULL_IN_NUMERIC_SIM) {
        sum += SHARED_NULL_WEIGHT;
        count++;
      }
    } else if (aM !== null && bM !== null) {
      sum += (1 - Math.min(1, Math.abs(aM - bM)));
      count++;
    }

    if (aS === null && bS === null) {
      if (COUNT_SHARED_NULL_IN_NUMERIC_SIM) {
        sum += SHARED_NULL_WEIGHT;
        count++;
      }
    } else if (aS !== null && bS !== null) {
      sum += (1 - Math.min(1, Math.abs(aS - bS)));
      count++;
    }
  });

  return count ? (sum / count) : 0;
}


function similarityAgencements(agA, agB) {
  const sigA = agA.fragmentsAgg || {};
  const sigB = agB.fragmentsAgg || {};

  // 1) Similarité numérique existante
  const sNum = similarityNumericStats(agA, agB);

  // 2) Similarité de motifs existante
  const mergedMotifsA = {
    ...(sigA.nodeMotifs || {})
  };
  const mergedMotifsB = {
    ...(sigB.nodeMotifs || {})
  };

  Object.entries(sigA.buildingMotifs || {}).forEach(([k, v]) => {
    mergedMotifsA[k] = (mergedMotifsA[k] || 0) + v;
  });

  Object.entries(sigB.buildingMotifs || {}).forEach(([k, v]) => {
    mergedMotifsB[k] = (mergedMotifsB[k] || 0) + v;
  });

  const mergedRareA = {
    ...(sigA.rareMotifs || {})
  };
  const mergedRareB = {
    ...(sigB.rareMotifs || {})
  };

  const sMotifs = weightedCountSimilarity(
    mergedMotifsA,
    mergedMotifsB,
    mergedRareA,
    mergedRareB
  );

  // 3) Nouvelle similarité temporelle
  const sTemporalites = similarityTemporalAgencements(agA, agB);

  return (
    AG_WEIGHT_SNUM * sNum +
    AG_WEIGHT_SMOTIFS * sMotifs +
    AG_WEIGHT_STEMPORALITES * sTemporalites
  );
}



function computeInternalDiffractionEdges(patternsObj, byIdFeatureMap, { topK = 1 } = {}) {
  const out = [];
  if (!patternsObj) return out;

  for (const [pName, pData] of Object.entries(patternsObj)) {
    const occIds = (pData.occurrences || []).slice();
    if (occIds.length < 1) continue;

    const fragIds = computeFragmentsUnionFromOccurrences(occIds);
    if (fragIds.length < 2) continue;

    const vecById = new Map();
    fragIds.forEach(id => {
      const f = byIdFeatureMap.get(String(id).trim().toUpperCase());
      if (!f) return;
      vecById.set(String(id).trim().toUpperCase(), featureToVector(f));
    });

    const ids = Array.from(vecById.keys());
    const candidates = [];

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const va = vecById.get(a), vb = vecById.get(b);
        if (!va || !vb) continue;

        const res = oppositionFuzzy(va, vb);
        if (!res.valid) continue;

        candidates.push({
          pattern: pName,
          a, b,
          opposition: res.opposition,
          comparability: res.comparability,
          common: res.common,
          mismatch: res.mismatch
        });
      }
    }

    candidates.sort((x, y) => y.opposition - x.opposition);
    out.push(...candidates.slice(0, Math.max(1, topK)));
  }

  return out;
}


/* ==================================================
   6) CHARGEMENT DES DONNÉES GEOJSON
   - contour
   - fragments
   - discours
   - bâtiments
   Chaque chargement alimente les états globaux
   puis déclenche si nécessaire un recalcul / rerender.
================================================== */

// Contours (non interactifs)
fetch('data/contour.geojson')
  .then(r => r.json())
  .then(data => {
    L.geoJSON(data, {
      style: { color:'#919090', weight:2, opacity:0.8, fillOpacity:0 },
      interactive: false
    }).addTo(map);
  });

// Fragments Montreuil + Mirail aux deux temporalités distinctes
Promise.all([
  fetch('data/data.geojson').then(r => r.json()),
  fetch('data/data2.geojson').then(r => r.json()),
  fetch('data/datam.geojson').then(r => r.json()),
  fetch('data/datam2.geojson').then(r => r.json())
]).then(([dataT1, dataT2, dataMT1, dataMT2]) => {
  dataGeojsonT1  = dataT1.features || [];
  dataGeojsonT2  = dataT2.features || [];
  datamGeojsonT1 = dataMT1.features || [];
  datamGeojsonT2 = dataMT2.features || [];

  dataGeojsonT1.forEach(f => {
    f.properties = f.properties || {};
    f.properties.zone = 'montreuil';
    f.properties.__timeState = 'T1';
  });

  dataGeojsonT2.forEach(f => {
    f.properties = f.properties || {};
    f.properties.zone = 'montreuil';
    f.properties.__timeState = 'T2';
  });

  datamGeojsonT1.forEach(f => {
    f.properties = f.properties || {};
    f.properties.zone = 'mirail';
    f.properties.__timeState = 'T1';
  });

  datamGeojsonT2.forEach(f => {
    f.properties = f.properties || {};
    f.properties.zone = 'mirail';
    f.properties.__timeState = 'T2';
  });

  // temporalités pour calculer les patterns
   buildTemporalFragmentIndex();

  const canonicalMontreuil = [];
  temporalFragmentIndex.montreuil.forEach(info => {
    if (info.representative) canonicalMontreuil.push(info.representative);
  });

  const canonicalMirail = [];
  temporalFragmentIndex.mirail.forEach(info => {
    if (info.representative) canonicalMirail.push(info.representative);
  });

  // base canonique pour le moteur pattern :
  // T2 si existe, sinon T1
  dataGeojson = canonicalMontreuil;
  datamGeojson = canonicalMirail;

  combinedFeatures = [...dataGeojson, ...datamGeojson];

  renderFragmentsMapByTimeMode();

  const { visibleFragments, visibleBuildings } = getVisibleSpatialFeaturesForPatterns();
  recomputeAgencementPatterns({
    fragments: visibleFragments,
    buildings: visibleBuildings
  });

  if (currentView === 'patterns-map') {
    initPatternMapOnce();
    renderPatternBaseGrey();
    refreshPatternsMap();
  }
});

// Discours (pane dédié + grande zone cliquable transparente)
fetch('data/discours.geojson')
  .then(res => res.json())
  .then(data => {
    discoursLayer = L.geoJSON(data, {
      pane: 'pane-discours',
      pointToLayer: (feature, latlng) => {
        const visible = L.circleMarker(latlng, {
          radius: 5, fillColor: 'white', color: 'white', weight: 1, opacity: 1, fillOpacity: 0.8, pane: 'pane-discours'
        });
        const clickableArea = L.circle(latlng, {
          radius: 30, color: 'transparent', fillColor: 'transparent', weight: 0, fillOpacity: 0, pane: 'pane-discours'
        });
        clickableArea.on('click', () => showDetails(feature.properties));
        visible.on('click', () => showDetails(feature.properties));
        return L.layerGroup([clickableArea, visible]);
      },
      onEachFeature: (feature, layerGroup) => {
        allLayers.push(layerGroup);
        layerGroup.feature = feature;
      }
    });

    discoursLayer.addTo(map);
    applyFilters(); // pour respecter l’état des checkboxes
  });


  // Bâtiments Montreuil + Toulouse
Promise.all([
  fetch('data/batimentsmontreuil.geojson').then(r => r.json()),
  fetch('data/batimenttoulouse.geojson').then(r => r.json())
]).then(([bM, bT]) => {

  batimentsMontreuilGeojson = (bM && bM.features) ? bM.features : [];
  batimentsToulouseGeojson  = (bT && bT.features) ? bT.features : [];

  // IMPORTANT : on pose une "zone" dans les properties pour que les filtres marchent
  batimentsMontreuilGeojson.forEach(f => {
    f.properties = f.properties || {};
    f.properties.zone = 'montreuil';
    f.properties.isBuilding = true; // pour ne pas polluer les patterns pour l’instant
  });

  batimentsToulouseGeojson.forEach(f => {
    f.properties = f.properties || {};
    f.properties.zone = 'mirail';   // chez toi "Toulouse" est filtré via la checkbox "mirail"
    f.properties.isBuilding = true;
  });

  const buildingStyle = (feature) => {
    // style simple (tu pourras coder par état/fonction ensuite)
    return {
      color: '#ffffff',
      weight: 1,
      opacity: 0.8,
      fillColor: '#ffffff',
      fillOpacity: 0.08
    };
  };

  // Montreuil
  batimentsLayerMontreuil = L.geoJSON(
    { type: 'FeatureCollection', features: batimentsMontreuilGeojson },
    {
      pane: 'pane-batiments',
      style: buildingStyle,
      onEachFeature: (feature, layer) => {
        layer.zone = 'montreuil';       // cohérent avec applyFilters()
        layer.feature = feature;        // sécurité
        allLayers.push(layer);          // pour que applyFilters() masque/affiche
        layer.on('click', () => showDetails(feature.properties)); // ouvre un panneau simple
      }
    }
  ).addTo(map);
  restyleBuildingsOnFragmentsMap();


  // Toulouse/Mirail
  batimentsLayerToulouse = L.geoJSON(
    { type: 'FeatureCollection', features: batimentsToulouseGeojson },
    {
      pane: 'pane-batiments',
      style: buildingStyle,
      onEachFeature: (feature, layer) => {
        layer.zone = 'mirail';
        layer.feature = feature;
        allLayers.push(layer);
        layer.on('click', () => showDetails(feature.properties));
      }
    }
  ).addTo(map);
  restyleBuildingsOnFragmentsMap();


  // Applique l'état des checkboxes (zones)
  applyFilters();

}).catch(err => {
  console.error("Erreur chargement bâtiments:", err);
});




/*==================================================
=                SIDEBAR À ONGLETS                 =
==================================================*/
const Tabbed = {
  el: null, tabsBar: null, content: null,
  openTabs: new Map(),     // id -> {btn, panel, kind}
  activeId: null
};

function ensureTabbedSidebar() {
  if (Tabbed.el) return;
  Tabbed.el      = document.getElementById('tabbed-sidebar');
  Tabbed.tabsBar = document.getElementById('tabbed-sidebar-tabs');
  Tabbed.content = document.getElementById('tabbed-sidebar-content');
}

function showTabbedSidebar() {
  ensureTabbedSidebar();
  Tabbed.el.style.display = 'block';
}
function hideTabbedSidebarIfEmpty() {
  if (Tabbed.openTabs.size === 0) {
    Tabbed.el.style.display = 'none';
    Tabbed.activeId = null;
  }
}

function clearAllTabbedTabs() {
  ensureTabbedSidebar();
  Array.from(Tabbed.openTabs.keys()).forEach(id => closeTab(id));
  Tabbed.tabsBar.innerHTML = '';
  Tabbed.content.innerHTML = '';
  Tabbed.activeId = null;
  Tabbed.el.style.display = 'none';
}

function focusTab(id) {
  if (!Tabbed.openTabs.has(id)) return;
  Tabbed.activeId = id;
  Tabbed.openTabs.forEach((rec, key) => {
    rec.btn.style.background = (key === id) ? '#222' : '#000';
    rec.btn.style.color      = '#fff';
    rec.panel.style.display  = (key === id) ? 'block' : 'none';
  });
}

function closeTab(id) {
  const rec = Tabbed.openTabs.get(id);
  if (!rec) return;
  rec.btn.remove();
  rec.panel.remove();
  Tabbed.openTabs.delete(id);
  if (Tabbed.activeId === id) {
    const last = Array.from(Tabbed.openTabs.keys()).pop();
    if (last) focusTab(last);
  }
  hideTabbedSidebarIfEmpty();
}

function makeTabButton(title, id) {
  const btn = document.createElement('button');
  btn.textContent = title;
  btn.title = title;
  btn.style.cssText = 'border:1px solid #333; background:#000; color:#fff; padding:6px 8px; cursor:pointer; white-space:nowrap; display:flex; align-items:center; gap:6px; border-radius:4px;';
  btn.addEventListener('click', () => focusTab(id));

  const x = document.createElement('span');
  x.textContent = '×';
  x.style.cssText = 'display:inline-block; padding:0 4px; border-left:1px solid #333; cursor:pointer; opacity:.85;';
  x.addEventListener('click', (e) => { e.stopPropagation(); closeTab(id); });
  btn.appendChild(x);

  return btn;
}

function makePanelContainer(id) {
  const panel = document.createElement('div');
  panel.id = `panel-${id}`;
  panel.style.display = 'none';
  return panel;
}

function openTab({ id, title, kind, render }) {
  ensureTabbedSidebar();

  // Si onglet déjà ouvert → focus et sortir
  if (Tabbed.openTabs.has(id)) {
    focusTab(id);
    Tabbed.content.scrollTop = 0;
    return;
  }

  // Bouton onglet
  const btn   = makeTabButton(title, id);
  // Contenu
  const panel = makePanelContainer(id);

  // Injection dans le DOM
  Tabbed.tabsBar.appendChild(btn);
  Tabbed.content.appendChild(panel);

  // Rendu
  render(panel);

  // Enregistrement
  Tabbed.openTabs.set(id, { btn, panel, kind });

  // Afficher la sidebar si cachée
  showTabbedSidebar();

  // Focus sur l’onglet
  focusTab(id);
  Tabbed.content.scrollTop = 0;
}







/* ==================================================
   7) RENDU DES PANNEAUX LATÉRAUX
================================================== */
/*==================================================
=    MÉTADONNÉES LOCALES PAR FRAGMENT 
==================================================*/
function getFragMetaKey(id){ return `fragmeta:${id}`; }
function loadFragmentMeta(fragmentId) {
  try {
    return JSON.parse(localStorage.getItem(getFragMetaKey(fragmentId)) || 'null') || { usages: [], discours: [] };
  } catch(e) { return { usages: [], discours: [] }; }
}
function saveFragmentMeta(fragmentId, meta) {
  localStorage.setItem(getFragMetaKey(fragmentId), JSON.stringify(meta));
  window.dispatchEvent(new CustomEvent('fragmeta:updated', { detail: { fragmentId, meta } }));
}
function uid(){ return Math.random().toString(36).slice(2,9); }

/* Helpers de rendu pour les métadonnées des fragments */
function parseGeojsonList(str) {
  const out = [];
  if (str && typeof str === "string") {
    str.split(/[;,]/).forEach(x => {
      const t = x.trim();
      if (t && t !== "-") out.push(t);
    });
  }
  return out;
}

function appendMetaBox(panel, title, items, emptyText) {
  const box = document.createElement('div');
  box.className = 'meta-box';

  const head = document.createElement('div');
  head.className = 'meta-head';
  head.innerHTML = `<strong>${title}</strong>`;
  box.appendChild(head);

  const list = document.createElement('div');
  list.className = 'meta-list';

  if (items && items.length) {
    items.forEach(txt => {
      const row = document.createElement('div');
      row.className = 'meta-item';
      row.innerHTML = `<div class="meta-item-text">${txt}</div>`;
      list.appendChild(row);
    });
  } else {
    const empty = document.createElement('div');
    empty.className = 'meta-empty';
    empty.textContent = emptyText || "—";
    list.appendChild(empty);
  }

  box.appendChild(list);
  panel.appendChild(box);
}

/*==================================================
   PANNEAU BATIMENTS
==================================================*/
function renderBuildingPanel(panel, props) {
  panel.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = props.id || 'Bâtiment';

  const pId = document.createElement('p');
  pId.innerHTML = `<strong>ID :</strong> ${props.id || '—'}`;

  const pFonction = document.createElement('p');
  pFonction.innerHTML = `<strong>Fonction :</strong> ${props.fonction || '—'}`;

  // Attention : dans ton GeoJSON tu as "état" avec accent
  const etat = props['état'] || props.etat || '—';
  const pEtat = document.createElement('p');
  pEtat.innerHTML = `<strong>État :</strong> ${etat}`;

  panel.append(h2, pId, pFonction, pEtat);
}

/*==================================================
   PANNEAU FRAGMENT
==================================================*/
function renderFragmentPanel(panel, props) {
  panel.innerHTML = '';

  const fragId = props.id || '—';

  /* ------------------------------
     En-tête du fragment
  ------------------------------ */
  const h2 = document.createElement('h2');
  h2.textContent = props.name || fragId || 'Fragment';

  const pId = document.createElement('p');
  pId.innerHTML = `<strong>ID :</strong> ${fragId}`;

  const pDesc = document.createElement('p');
  pDesc.textContent = props.description || '';

  /* ------------------------------
     Photos
  ------------------------------ */
  const photos = document.createElement('div');
  const photoList = normalizePhotos(props.photos);
  if (photoList.length) {
    photoList.forEach(src => {
      const img = makeImg(src, props.name || fragId || 'photo');
      if (img) {
        img.style.width = '100%';
        img.style.marginBottom = '8px';
        photos.appendChild(img);
      }
    });
  }

  panel.append(h2, pId, pDesc, photos);

  /* ------------------------------
     Boutons 3D
  ------------------------------ */
  const actions = document.createElement('div');
  actions.className = 'btn-row';

  const btnOpen3D = document.createElement('button');
  btnOpen3D.className = 'tab-btn btn-sm primary';
  btnOpen3D.textContent = hasFragment3D(fragId) ? 'Voir la 3D' : 'Importer 3D';
  btnOpen3D.addEventListener('click', () => openThreeModalForFragment(fragId));
  actions.append(btnOpen3D);

  if (hasFragment3D(fragId)) {
    const btnImport3D = document.createElement('button');
    btnImport3D.className = 'tab-btn btn-sm';
    btnImport3D.textContent = 'Remplacer 3D';
    btnImport3D.addEventListener('click', () => promptImport3DForFragment(fragId, true));
    actions.append(btnImport3D);
  }

  panel.append(actions);

/* ======================================================
   1) MÉTADONNÉES issues du GeoJSON (listes)
   - Initiateur
   - Acteurs actifs
   - Usages issus du terrain
====================================================== */
const existingInitiateur = parseGeojsonList(props.initiateur);
const existingActeurs    = parseGeojsonList(props.acteur_actif);
const existingUsages     = parseGeojsonList(props.usages);
const existingElementsSpatiaux = parseGeojsonList(props.elements_spatiaux);

// ordre demandé
appendMetaBox(panel, "Initiateur", existingInitiateur, "— Aucun initiateur renseigné dans le GeoJSON.");
appendMetaBox(panel, "Acteurs actifs", existingActeurs, "— Aucun acteur actif renseigné dans le GeoJSON.");
appendMetaBox(panel, "Usages issus du terrain", existingUsages, "— Aucun usage renseigné dans le GeoJSON.");
appendMetaBox(panel, "Éléments spatiaux", existingElementsSpatiaux, "— Aucun élément spatial renseigné dans le GeoJSON.");


  /* ======================================================
     2) USAGES ajoutés localement par l’utilisateur
     ====================================================== */
  const meta = loadFragmentMeta(fragId);

  function makeEditorBlock(title, listKey, placeholder) {
    const box = document.createElement('div');
    box.className = 'meta-box';

    const head = document.createElement('div');
    head.className = 'meta-head';
    head.innerHTML = `<strong>${title}</strong>`;
    box.appendChild(head);

    const addRow = document.createElement('div');
    addRow.className = 'meta-add-row';

    const ta = document.createElement('textarea');
    ta.className = 'meta-ta';
    ta.rows = 3;
    ta.placeholder = placeholder;

    const addBtn = document.createElement('button');
    addBtn.className = 'tab-btn btn-sm';
    addBtn.textContent = 'Ajouter';

    addBtn.addEventListener('click', () => {
      const txt = ta.value.trim();
      if (!txt) return;
      meta[listKey].push({ id: uid(), text: txt });
      saveFragmentMeta(fragId, meta);
      ta.value = '';
      renderList();
    });

    addRow.append(ta, addBtn);
    box.appendChild(addRow);

    const list = document.createElement('div');
    list.className = 'meta-list';
    box.appendChild(list);

    function renderList() {
      list.innerHTML = '';
      meta[listKey].forEach(item => {
        const row = document.createElement('div');
        row.className = 'meta-item';

        const left = document.createElement('div');
        left.className = 'meta-item-left';

        const txt = document.createElement('div');
        txt.className = 'meta-item-text';
        txt.textContent = item.text;
        txt.title = 'Cliquer pour éditer';

        // Édition
        txt.addEventListener('click', () => {
          if (row.querySelector('textarea')) return;
          const editor = document.createElement('textarea');
          editor.className = 'meta-edit';
          editor.value = item.text;

          const saveBtn = document.createElement('button');
          saveBtn.className = 'tab-btn btn-xs primary';
          saveBtn.textContent = 'OK';

          const cancelBtn = document.createElement('button');
          cancelBtn.className = 'tab-btn btn-xs';
          cancelBtn.textContent = 'Annuler';

          const editRow = document.createElement('div');
          editRow.className = 'meta-edit-row';
          editRow.append(editor, saveBtn, cancelBtn);

          left.replaceChild(editRow, txt);

          saveBtn.addEventListener('click', () => {
            const newTxt = editor.value.trim();
            if (newTxt) {
              item.text = newTxt;
              saveFragmentMeta(fragId, meta);
            }
            renderList();
          });

          cancelBtn.addEventListener('click', renderList);
        });

        left.appendChild(txt);

        const right = document.createElement('div');
        right.className = 'meta-item-right';

        const delBtn = document.createElement('button');
        delBtn.className = 'tab-btn btn-xs danger';
        delBtn.textContent = 'Suppr.';

        delBtn.addEventListener('click', () => {
          meta[listKey] = meta[listKey].filter(x => x.id !== item.id);
          saveFragmentMeta(fragId, meta);
          renderList();
        });

        right.appendChild(delBtn);

        row.append(left, right);
        list.appendChild(row);
      });

      if (!meta[listKey].length) {
        const empty = document.createElement('div');
        empty.className = 'meta-empty';
        empty.textContent = '— Aucun élément pour le moment.';
        list.appendChild(empty);
      }
    }

    renderList();
    return box;
  }

  const usagesBlock = makeEditorBlock('Usages ajoutés', 'usages', 'Ex : « Lieu de réunion… »');
  const discoursBlock = makeEditorBlock('Discours', 'discours', 'Ex : « L’institution prévoit… »');

  panel.append(usagesBlock, discoursBlock);

  /* ======================================================
     3) CRITÈRES FUZZY
     ====================================================== */
  const fuzzyBlock = document.createElement('div');
  fuzzyBlock.className = 'fuzzy-criteria';

  const hFuzzy = document.createElement('h3');
  hFuzzy.textContent = "Critères";
  fuzzyBlock.appendChild(hFuzzy);

  ALL_FUZZY_KEYS.forEach(k => {
    const raw = props[k];
    const val = parseFuzzy(raw);

    const row = document.createElement('div');
    row.className = 'crit-line';

    const label = document.createElement('span');
    label.className = 'crit-label';
    label.textContent = k;

    const value = document.createElement('span');
    value.className = 'crit-value';
    value.textContent = (val !== null ? val : "—");

    row.append(label, value);
    fuzzyBlock.appendChild(row);
  });

  panel.append(fuzzyBlock);
}

/*==================================================
   PANNEAU PATTERN
==================================================*/
function renderPatternPanel(panel, patternKey, patternData) {
  panel.innerHTML = '';

  const occIds = (patternData?.occurrences || []).slice();
  const occs = occIds
    .map(id => agencementsById.get(id))
    .filter(Boolean)
    .sort((a, b) => parseInt(String(a.id).replace('A', ''), 10) - parseInt(String(b.id).replace('A', ''), 10));

  const h2 = document.createElement('h2');
  h2.textContent = patternKey;
  panel.appendChild(h2);

  const pMeta = document.createElement('p');
  pMeta.className = 'pattern-meta';
  pMeta.textContent = `${occs.length} occurrences`;
  panel.appendChild(pMeta);

  if (!occs.length) {
    const msg = document.createElement('div');
    msg.style.color = '#aaa';
    msg.style.padding = '8px 0';
    msg.textContent = "Aucune occurrence disponible.";
    panel.appendChild(msg);
    return;
  }

  const allFrags = [...(dataGeojson || []), ...(datamGeojson || [])]
    .filter(f => !f.properties?.isDiscourse && !f.properties?.isBuilding);

  const byFragId = new Map(
    allFrags.map(f => [String(f.properties?.id || '').trim(), f])
  );

  const allBlds = [...(batimentsMontreuilGeojson || []), ...(batimentsToulouseGeojson || [])];
  const byBldId = new Map(
    allBlds.map(b => [String(b.properties?.id || '').trim(), b])
  );

  const summary = computePatternPanelSummary(occs, byFragId);

  function makeListBlock(title, rows, formatter) {
    const box = document.createElement('div');
    box.className = 'pattern-crit-block';

    const h = document.createElement('h3');
    h.textContent = title;
    box.appendChild(h);

    if (!rows.length) {
      const none = document.createElement('div');
      none.style.color = '#aaa';
      none.textContent = '—';
      box.appendChild(none);
      return box;
    }

    rows.forEach(rowData => {
      const line = document.createElement('div');
      line.className = 'crit-line';

      const lab = document.createElement('span');
      lab.className = 'crit-label';
      lab.textContent = formatter(rowData).label;

      const val = document.createElement('span');
      val.className = 'crit-value';
      val.textContent = formatter(rowData).value;

      line.append(lab, val);
      box.appendChild(line);
    });

    return box;
  }

  panel.appendChild(
  makeListBlock(
    'Critères partagés',
    summary.sharedCriteria,
    item => {
      if (item.kind === 'shared-null') {
        return {
          label: `${prettyKey(item.key)} — absence partagée`,
          value: `${item.total}/${item.total}`
        };
      }

      if (item.kind === 'shared-zero') {
        return {
          label: `${prettyKey(item.key)} — nul partagé`,
          value: `${item.filledCount}/${item.total}`
        };
      }

      return {
        label: `${prettyKey(item.key)} : ${Number(item.mean).toFixed(2).replace('.', ',')} - `,
        value: `${item.positiveCount}/${item.total}`
      };
    }
  )
);


panel.appendChild(
  makeListBlock(
    'Critères nuls',
    summary.nullCriteria,
    item => ({
      label: `${prettyKey(item.key)} :`,
      value: `null ${item.count}/${item.total} `
    })
  )
);

  panel.appendChild(
    makeListBlock(
      'Usages / acteurs / initiateurs / éléments spatiaux',
      summary.textCriteria,
      item => ({
        label: `${prettyKey(item.key)} : ${item.token} : `,
        value: `${item.count}/${item.total}`
      })
    )
  );

  const contextBox = document.createElement('div');
  contextBox.className = 'pattern-crit-block';

  const hContext = document.createElement('h3');
  hContext.textContent = 'Contexte bâti';
  contextBox.appendChild(hContext);

  const contextRows = [
    {
      label: 'Fragments sans bâti proche : ',
      value: `${summary.buildingContext.noNearbyCount}/${summary.buildingContext.totalFragments}`
    },
    {
      label: 'Distance moyenne au bâti proche : ',
      value: summary.buildingContext.avgDistance !== null
        ? `${summary.buildingContext.avgDistance.toFixed(1)} m`
        : '—'
    }
  ];

  summary.buildingContext.topStates.forEach(item => {
    contextRows.push({
      label: `État bâti proche : ${item.label}`,
      value: `${item.count}`
    });
  });

  summary.buildingContext.topFunctions.forEach(item => {
    contextRows.push({
      label: `Fonction bâtie proche : ${item.label}`,
      value: `${item.count}`
    });
  });

  contextRows.forEach(item => {
    const line = document.createElement('div');
    line.className = 'crit-line';

    const lab = document.createElement('span');
    lab.className = 'crit-label';
    lab.textContent = item.label;

    const val = document.createElement('span');
    val.className = 'crit-value';
    val.textContent = item.value;

    line.append(lab, val);
    contextBox.appendChild(line);
  });

  panel.appendChild(contextBox);

  const list = document.createElement('div');
  list.className = 'pattern-members';

// temporalités — comparaison entre agencements
const temporalBox = document.createElement('div');
temporalBox.className = 'pattern-crit-block';

const hTemporal = document.createElement('h3');
hTemporal.textContent = 'Temporalités par agencement';
temporalBox.appendChild(hTemporal);

occs.forEach(ag => {
  const counts = {
    stable: 0,
    modified: 0,
    appeared: 0,
    disappeared: 0
  };

  const modifiedDeltas = [];

  (ag.temporalProfiles || []).forEach(tp => {
    if (!tp?.status) return;

    counts[tp.status] = (counts[tp.status] || 0) + 1;

    if (tp.status === 'modified' && Number.isFinite(tp.delta)) {
      modifiedDeltas.push(tp.delta);
    }
  });

  const modifiedText = modifiedDeltas.length
    ? `${counts.modified} modifiés (${modifiedDeltas.map(v => v.toFixed(2).replace('.', ',')).join(' ; ')})`
    : `${counts.modified} modifiés`;

  const line = document.createElement('div');
  line.className = 'crit-line';

  const lab = document.createElement('span');
  lab.className = 'crit-label';
  lab.textContent = `${ag.id} :`;

  const val = document.createElement('span');
  val.className = 'crit-value';
  val.textContent =
    `${counts.stable} stables • ${modifiedText} • ${counts.appeared} apparus • ${counts.disappeared} disparus`;

  line.append(lab, val);
  temporalBox.appendChild(line);
});

panel.appendChild(temporalBox);


  const hList = document.createElement('h3');
  hList.textContent = 'Occurrences';
  list.appendChild(hList);

  occs.forEach(ag => {
    const row = document.createElement('div');
    row.className = 'member-row';

    const thumb = document.createElement('div');
    thumb.className = 'member-thumb';

    let foundPhoto = null;
    for (const fid of (ag.fragmentIds || [])) {
      const f = byFragId.get(String(fid).trim());
      if (!f) continue;
      const p = normalizePhotos(f.properties?.photos)[0];
      if (p) {
        foundPhoto = p;
        break;
      }
    }
    if (foundPhoto) thumb.style.backgroundImage = `url("${foundPhoto}")`;

    const right = document.createElement('div');
    right.className = 'member-right';

    const title = document.createElement('div');
    title.className = 'member-title';
    title.textContent = `${ag.id} — ${ag.fragmentsCount} fragments • ${ag.buildingsCount} bâtiments`;

    const fragNames = (ag.fragmentIds || [])
      .map(fid => {
        const f = byFragId.get(String(fid).trim());
        return f ? (f.properties?.name || fid) : fid;
      })
      .slice(0, 6);

    const info = document.createElement('div');
    info.className = 'member-info';
    info.textContent = fragNames.join(' • ') + ((ag.fragmentIds || []).length > 6 ? ' …' : '');

    right.append(title, info);
    row.append(thumb, right);

    row.addEventListener('click', () => {
      openTab({
        id: `ag-${ag.id}`,
        title: ag.id,
        kind: 'agencement',
        render: (p) => renderAgencementPanel(p, ag, { byFragId, byBldId })
      });
    });

    list.appendChild(row);
  });

  panel.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'btn-row';

  const btnSave = document.createElement('button');
  btnSave.className = 'tab-btn btn-sm primary';
  btnSave.textContent = 'Enregistrer ce pattern';
  btnSave.onclick = () => {
    if (typeof openSavePatternModal === 'function') openSavePatternModal(patternKey, patternData);
    else alert("Fonction d’enregistrement non disponible pour l’instant.");
  };

  actions.appendChild(btnSave);
  panel.appendChild(actions);
}

// --- helpers pour le panel pattern
function computePatternSignatureFromOccurrences(occs) {
  const numericMeans = {};
  const numericSpread = {};
  const textTokens = {};
  const dominantPoleShares = { PA: [], DH: [], FS: [] };
  const internalContrastVals = [];
  const temporalStatusCounts = {
    stable: 0,
    modified: 0,
    appeared: 0,
    disappeared: 0
  };

  ALL_FUZZY_KEYS.forEach(k => {
    numericMeans[k] = null;
    numericSpread[k] = null;
  });
  TEXT_KEYS.forEach(k => {
    textTokens[k] = [];
  });

  ALL_FUZZY_KEYS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;

    const means = [];
    const spreads = [];

    occs.forEach(ag => {
      const m = ag?.fragmentsAgg?.numericMeans?.[k];
      const s = ag?.fragmentsAgg?.numericSpread?.[k];
      if (m !== null && m !== undefined) means.push(m);
      if (s !== null && s !== undefined) spreads.push(s);
    });

    numericMeans[k] = means.length ? average(means) : null;
    numericSpread[k] = spreads.length ? average(spreads) : null;
  });

  TEXT_KEYS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;
    const S = new Set();
    occs.forEach(ag => {
      const arr = ag?.fragmentsAgg?.textTokens?.[k] || [];
      arr.forEach(t => S.add(t));
    });
    textTokens[k] = Array.from(S);
  });

  occs.forEach(ag => {
    const shares = ag?.fragmentsAgg?.dominantPoleShares || {};
    ["PA", "DH", "FS"].forEach(p => {
      if (Number.isFinite(shares[p])) dominantPoleShares[p].push(shares[p]);
    });

    if (Number.isFinite(ag?.fragmentsAgg?.internalContrast)) {
      internalContrastVals.push(ag.fragmentsAgg.internalContrast);
    }
        (ag?.temporalProfiles || []).forEach(tp => {
      if (!tp?.status) return;
      temporalStatusCounts[tp.status] = (temporalStatusCounts[tp.status] || 0) + 1;
    });
  });

    return {
    numericMeans,
    numericSpread,
    textTokens,
    dominantPoleShares: {
      PA: average(dominantPoleShares.PA) || 0,
      DH: average(dominantPoleShares.DH) || 0,
      FS: average(dominantPoleShares.FS) || 0
    },
    internalContrast: average(internalContrastVals) || 0,
    temporalStatusCounts
  };
}


function getPatternFragmentInstances(occs, byFragId) {
  const out = [];

  (occs || []).forEach(ag => {
    (ag.fragmentIds || []).forEach(fid => {
      const f = byFragId.get(String(fid).trim());
      if (f) out.push(f);
    });
  });

  return out;
}

function computePatternPanelSummary(occs, byFragId) {
  const fragmentInstances = getPatternFragmentInstances(occs, byFragId);
  const total = fragmentInstances.length;

  const sharedCriteria = [];
  const nullCriteria = [];
  const textCounts = {};

  TEXT_KEYS.forEach(k => { textCounts[k] = {}; });

ALL_FUZZY_KEYS.forEach(k => {
  if (!ACTIVE_CRITERIA_KEYS.has(k)) return;

  let filledCount = 0;
  let positiveCount = 0;
  let nullCount = 0;
  const filledValues = [];

  fragmentInstances.forEach(f => {
    const v = parseFuzzy(f?.properties?.[k]);

    if (v === null) {
      nullCount++;
      return;
    }

    filledCount++;
    filledValues.push(v);

    if (v > 0) positiveCount++;
  });

  const mean = filledValues.length ? average(filledValues) : null;

  // critère partagé avec valeurs réellement renseignées
  if (filledCount > 0 && mean !== null) {
    sharedCriteria.push({
      key: k,
      mean,
      positiveCount,
      filledCount,
      total
    });
  }

  // critère null dans une partie ou dans la totalité des fragments
  if (nullCount > 0) {
    nullCriteria.push({
      key: k,
      kind: 'null',
      count: nullCount,
      total
    });
  }
});

  TEXT_KEYS.forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;

    fragmentInstances.forEach(f => {
      const arr = parseMultiText(f?.properties?.[k]) || [];
      arr.forEach(tok => {
        textCounts[k][tok] = (textCounts[k][tok] || 0) + 1;
      });
    });
  });

  const textCriteria = [];
  TEXT_KEYS.forEach(k => {
    Object.entries(textCounts[k]).forEach(([token, count]) => {
      textCriteria.push({ key: k, token, count, total });
    });
  });

  textCriteria.sort((a, b) => b.count - a.count);

  sharedCriteria.sort((a, b) => {
    if (b.positiveCount !== a.positiveCount) return b.positiveCount - a.positiveCount;
    return b.mean - a.mean;
  });

  nullCriteria.sort((a, b) => b.count - a.count);

  return {
    sharedCriteria: sharedCriteria.slice(0, 10),
    nullCriteria: nullCriteria.slice(0, 10),
    textCriteria: textCriteria.slice(0, 10),
    buildingContext: computeSimplePatternBuildingContext(occs)
  };
}

function computeSimplePatternBuildingContext(occs) {
  let noNearbyCount = 0;
  let totalFragments = 0;

  const stateCounts = {};
  const functionCounts = {};

  let weightedDistSum = 0;
  let weightedDistCount = 0;

  (occs || []).forEach(ag => {
    const fragCount = ag.fragmentsCount || 0;
    totalFragments += fragCount;

    const motifs = ag?.fragmentsAgg?.buildingMotifs || {};
    const stats = ag?.fragmentsAgg?.buildingContextStats || {};

    const noHere = motifs['frag_building:none'] || 0;
    noNearbyCount += noHere;

    Object.entries(motifs).forEach(([k, v]) => {
      if (k.startsWith('frag_building_state:')) {
        const label = k.replace('frag_building_state:', '');
        stateCounts[label] = (stateCounts[label] || 0) + v;
      }

      if (k.startsWith('frag_building_function:')) {
        const label = k.replace('frag_building_function:', '');
        functionCounts[label] = (functionCounts[label] || 0) + v;
      }
    });

    const linkedFragments = Math.max(0, fragCount - noHere);
    if (stats.avgBuildingDistance !== null && stats.avgBuildingDistance !== undefined && linkedFragments > 0) {
      weightedDistSum += stats.avgBuildingDistance * linkedFragments;
      weightedDistCount += linkedFragments;
    }
  });

  return {
    totalFragments,
    noNearbyCount,
    avgDistance: weightedDistCount ? (weightedDistSum / weightedDistCount) : null,
    topStates: topEntries(stateCounts, 3),
    topFunctions: topEntries(functionCounts, 3)
  };
}

/*==================================================
=                PANNEAU AGENCEMENT                =
==================================================*/

function renderAgencementPanel(panel, ag, { byFragId, byBldId } = {}) {
  panel.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.textContent = ag.id;
  panel.appendChild(h2);

  const meta = document.createElement('p');
  meta.innerHTML = `<strong>${ag.fragmentsCount}</strong> fragments • <strong>${ag.buildingsCount}</strong> bâtiments • rayon ${(ag.radiusM || 0).toFixed(0)} m`;
  panel.appendChild(meta);

  // Patterns
  const pP = document.createElement('p');
  const pList = (ag.patternIds || []).slice().sort((a,b)=>parseInt(a.replace('P',''),10)-parseInt(b.replace('P',''),10));
  pP.innerHTML = `<strong>Patterns :</strong> ${pList.length ? pList.join(', ') : '—'}`;
  panel.appendChild(pP);

  // Fragments
  const hF = document.createElement('h3');
  hF.textContent = 'Fragments inclus';
  panel.appendChild(hF);

  const fragBox = document.createElement('div');
  (ag.fragmentIds || []).forEach(fid => {
    const f = byFragId?.get(String(fid).trim());
    const row = document.createElement('div');
    row.className = 'member-row';

    const thumb = document.createElement('div');
    thumb.className = 'member-thumb';
    const photoUrl = f ? normalizePhotos(f.properties?.photos)[0] : null;
    if (photoUrl) thumb.style.backgroundImage = `url("${photoUrl}")`;

    const right = document.createElement('div');
    right.className = 'member-right';

    const title = document.createElement('div');
    title.className = 'member-title';
    title.textContent = f ? (f.properties?.name || fid) : fid;

    const info = document.createElement('div');
    info.className = 'member-info';
    info.textContent = f ? (f.properties?.id || fid) : fid;

    right.append(title, info);
    row.append(thumb, right);

    row.addEventListener('click', () => {
      if (f) openFragmentWithPatternsTabs(f.properties);
    });

    fragBox.appendChild(row);
  });
  panel.appendChild(fragBox);

  // Bâtiments (liste simple)
  const hB = document.createElement('h3');
  hB.textContent = 'Bâtiments inclus';
  panel.appendChild(hB);

  const bBox = document.createElement('div');
  const bIds = (ag.buildingIds || []);
  if (!bIds.length) {
    const none = document.createElement('div');
    none.style.color = '#aaa';
    none.textContent = '— Aucun bâtiment dans ce périmètre.';
    bBox.appendChild(none);
  } else {
    bIds.slice(0, 30).forEach(bid => {
      const b = byBldId?.get(String(bid).trim());
      const props = b?.properties || {};
      const line = document.createElement('div');
      line.style.color = '#ddd';
      line.style.fontSize = '12px';
      line.style.padding = '2px 0';
      line.textContent = `${bid} — ${props.fonction || props.fonction === '' ? props.fonction : (props['fonction'] || '—')} — ${props['état'] || props.etat || '—'}`;
      bBox.appendChild(line);
    });

    if (bIds.length > 30) {
      const more = document.createElement('div');
      more.style.color = '#aaa';
      more.textContent = `… +${bIds.length - 30} autres`;
      bBox.appendChild(more);
    }
  }
  panel.appendChild(bBox);

  // Signature de l’agencement (déjà calculée)
const hS = document.createElement('h3');
hS.textContent = 'Signature relationnelle';
  panel.appendChild(hS);

  const sBox = document.createElement('div');
  sBox.className = 'pattern-crit-block';

  const relBox = document.createElement('div');
relBox.className = 'pattern-crit-block';
relBox.style.marginTop = '10px';


const relTitle = document.createElement('h3');
relTitle.textContent = 'Structure interne';
relBox.appendChild(relTitle);

const relInfo = document.createElement('div');
relInfo.style.fontSize = '12px';
relInfo.style.color = '#ccc';

const sig = ag.fragmentsAgg || {};
const shares = sig.dominantPoleShares || {};

relInfo.innerHTML = `
  <div><strong>Densité relationnelle :</strong> ${Number(sig.density || 0).toFixed(2)}</div>
  <div><strong>Contraste interne :</strong> ${Number(sig.internalContrast || 0).toFixed(2)}</div>
  <div><strong>Distance moyenne entre voisins :</strong> ${sig.avgPairDistance !== null ? Number(sig.avgPairDistance).toFixed(1) + ' m' : '—'}</div>
  <div><strong>Degré local moyen :</strong> ${sig.avgLocalDegree !== null ? Number(sig.avgLocalDegree).toFixed(2) : '—'}</div>
  <div><strong>Pôles dominants :</strong> PA ${Number(shares.PA || 0).toFixed(2)} • DH ${Number(shares.DH || 0).toFixed(2)} • FS ${Number(shares.FS || 0).toFixed(2)}</div>
`;

relBox.appendChild(relInfo);
panel.appendChild(relBox);

// Temporalités

const temporalBox = document.createElement('div');
temporalBox.className = 'pattern-crit-block';
temporalBox.style.marginTop = '10px';

const temporalTitle = document.createElement('h3');
temporalTitle.textContent = 'Composition temporelle';
temporalBox.appendChild(temporalTitle);

const tProfiles = ag.temporalProfiles || [];

const tCounts = {
  stable: 0,
  modified: 0,
  appeared: 0,
  disappeared: 0
};

tProfiles.forEach(tp => {
  if (!tp?.status) return;
  tCounts[tp.status] = (tCounts[tp.status] || 0) + 1;
});

[
  ['Stables', tCounts.stable],
  ['Modifiés', tCounts.modified],
  ['Apparus', tCounts.appeared],
  ['Disparus', tCounts.disappeared]
].forEach(([labelText, valText]) => {
  const line = document.createElement('div');
  line.className = 'crit-line';

  const lab = document.createElement('span');
  lab.className = 'crit-label';
  lab.textContent = labelText + ' :';

  const val = document.createElement('span');
  val.className = 'crit-value';
  val.textContent = String(valText);

  line.append(lab, val);
  temporalBox.appendChild(line);
});

panel.appendChild(temporalBox);

  (ALL_FUZZY_KEYS || []).forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;
    const v = ag?.fragmentsAgg?.numericMeans?.[k];
    if (v === null || v === undefined) return;

    const line = document.createElement('div');
    line.className = 'crit-line';

    const lab = document.createElement('span');
    lab.className = 'crit-label';
    lab.textContent = k.replace(/_/g, ' ');

    const val = document.createElement('span');
    val.className = 'crit-value';
    val.textContent = '\u00A0' + Number(v).toFixed(2);

    line.append(lab, val);
    sBox.appendChild(line);
  });

  (TEXT_KEYS || []).forEach(k => {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) return;
    const arr = ag?.fragmentsAgg?.textTokens?.[k] || [];
    if (!arr.length) return;

    const line = document.createElement('div');
    line.className = 'crit-line';

    const lab = document.createElement('span');
    lab.className = 'crit-label';
    lab.textContent = k.replace(/_/g, ' ');

    const val = document.createElement('span');
    val.className = 'crit-value';
    val.textContent = '\u00A0' + arr.slice(0, 10).join(', ') + (arr.length > 10 ? '…' : '');

    line.append(lab, val);
    sBox.appendChild(line);
  });

  if (!sBox.childNodes.length) {
    const none = document.createElement('div');
    none.style.color = '#aaa';
    none.textContent = '— Rien à afficher.';
    panel.appendChild(none);
  } else {
    panel.appendChild(sBox);
  }
}

/*==================================================
=                PANNEAU DISCOURS                  =
==================================================*/
function renderDiscoursePanel(panel, props) {
  panel.innerHTML = '';
  const h2 = document.createElement('h2'); h2.textContent = props.id || 'Discours';
  const pA = document.createElement('p'); pA.innerHTML = `<strong>Auteur :</strong> ${props.auteur || ''}`;
  const pD = document.createElement('p'); pD.innerHTML = `<strong>Date :</strong> ${props.date || ''}`;
  const pS = document.createElement('p');
  const src = props.source || '';
  pS.innerHTML = `<strong>Source :</strong> ${ src && String(src).startsWith('http') ? `<a href="${src}" target="_blank">${src}</a>` : src }`;
  const pT = document.createElement('p'); pT.textContent = props.contenu || '';
  panel.append(h2, pA, pD, pS, pT);
}


/* ==================================================
   8) VUES PRINCIPALES
================================================== */

/***************************************************
=                  VUE CARTE FRAGMENTS TEMPORALITES            =
***************************************************/

function renderFragmentsMapByTimeMode() {
  if (!fragmentLayersGroup) return;

  fragmentLayersGroup.clearLayers();
  allLayers = allLayers.filter(layer => {
    return !(layer && layer.__isFragmentLayer);
  });

  const activeZones = getActiveZones ? getActiveZones() : ['montreuil', 'mirail'];

  if (currentFragmentTimeMode === 'trajectories') {
    ['montreuil', 'mirail'].forEach(zone => {
      if (!activeZones.includes(zone)) return;

      const pairs = buildTemporalPairsForZone(zone);

      pairs.forEach(pair => {
        const featureForDisplay = pair.t2 || pair.t1;
        if (!featureForDisplay) return;

        const styleObj = getTrajectoryStyle(pair.status, zone);

        const layer = L.geoJSON(featureForDisplay, {
          pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
            radius: styleObj.radius,
            color: styleObj.color,
            weight: styleObj.weight,
            opacity: styleObj.opacity,
            fillColor: styleObj.fillColor,
            fillOpacity: styleObj.fillOpacity
          }),
          style: () => ({
            color: styleObj.color,
            weight: styleObj.weight,
            opacity: styleObj.opacity,
            fillColor: styleObj.fillColor,
            fillOpacity: styleObj.fillOpacity
          }),
          onEachFeature: (_feature, sublayer) => {
            sublayer.zone = zone;
            sublayer.__isFragmentLayer = true;
            sublayer.feature = featureForDisplay;

            allLayers.push(sublayer);

            sublayer.on('click', () => {
              openTrajectoryFragmentTabs(pair);
            });
          }
        });

        layer.eachLayer(l => fragmentLayersGroup.addLayer(l));
      });
    });
  } else {
    const datasets = getCurrentFragmentDatasets();

    ['montreuil', 'mirail'].forEach(zone => {
      if (!activeZones.includes(zone)) return;

      const features = zone === 'montreuil' ? datasets.montreuil : datasets.mirail;
      const color = getSiteColor(zone);

      const layer = L.geoJSON({ type: 'FeatureCollection', features }, {
        pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
          radius: 4,
          color,
          weight: 1,
          opacity: 1,
          fillColor: color,
          fillOpacity: 0.8
        }),
        style: () => ({
          color,
          weight: 0.9,
          fillOpacity: 0.3
        }),
        onEachFeature: (feature, sublayer) => {
          sublayer.zone = zone;
          sublayer.__isFragmentLayer = true;
          allLayers.push(sublayer);
          sublayer.on('click', () => showDetails(feature.properties));
        }
      });

      layer.eachLayer(l => fragmentLayersGroup.addLayer(l));
    });
  }
}




/***************************************************
=                  VUE GALERIE            =
***************************************************/

function getAgencementFragments(ag, byFragId) {
  return (ag?.fragmentIds || [])
    .map(fid => byFragId.get(String(fid).trim()))
    .filter(Boolean);
}

function getAgencementBuildings(ag, byBldId) {
  return (ag?.buildingIds || [])
    .map(bid => byBldId.get(String(bid).trim()))
    .filter(Boolean);
}

function buildGalleryFragmentCard(f, ag, byFragId, byBldId) {
  const card = document.createElement('div');
  card.className = 'gallery-fragment-card';

  const photos = normalizePhotos(f?.properties?.photos);
  const firstPhoto = photos[0] || null;

  const media = document.createElement('div');
  media.className = 'gallery-fragment-media';

  if (firstPhoto) {
    const img = makeImg(firstPhoto, f?.properties?.name || f?.properties?.id || 'fragment');
    if (img) media.appendChild(img);
  } else {
    media.classList.add('is-empty');
    media.textContent = 'Sans image';
  }

  const caption = document.createElement('div');
  caption.className = 'gallery-fragment-caption';

  const fragTitle = document.createElement('div');
  fragTitle.className = 'gallery-fragment-title';
  fragTitle.textContent = f?.properties?.id || 'Fragment';

  const fragName = document.createElement('div');
  fragName.className = 'gallery-fragment-name';
  fragName.textContent = f?.properties?.name || '';

  caption.append(fragTitle, fragName);
  card.append(media, caption);

  card.addEventListener('click', () => {
    openTab({
      id: `ag-${ag.id}`,
      title: ag.id,
      kind: 'agencement',
      render: (p) => renderAgencementPanel(p, ag, { byFragId, byBldId })
    });
  });

  return card;
}

function buildGalleryBuildingsCell(ag, byBldId) {
  const cell = document.createElement('div');
  cell.className = 'gallery-buildings-cell';

  const title = document.createElement('div');
  title.className = 'gallery-buildings-title';
  title.textContent = 'Bâtiments';

  const list = document.createElement('div');
  list.className = 'gallery-buildings-list';

  const buildings = getAgencementBuildings(ag, byBldId);

  if (!buildings.length) {
    const empty = document.createElement('div');
    empty.className = 'gallery-building-line is-empty';
    empty.textContent = '— Aucun bâtiment';
    list.appendChild(empty);
  } else {
    buildings.forEach(b => {
      const props = b?.properties || {};
      const line = document.createElement('div');
      line.className = 'gallery-building-line';

      const bid = props.id || '—';
      const fonction = props.fonction || props['fonction'] || '—';
      const etat = props['état'] || props.etat || '—';

      line.textContent = `${bid} — ${fonction} — ${etat}`;
      list.appendChild(line);
    });
  }

  cell.append(title, list);
  return cell;
}

function getFragmentSimilarityScore(fa, fb) {
  if (!fa || !fb) return -1;
  const va = featureToVector(fa);
  const vb = featureToVector(fb);
  return similarityFuzzy(va, vb);
}

function orderFragmentsByReference(referenceFrags, candidateFrags) {
  const remaining = [...candidateFrags];
  const ordered = [];

  // 1) on aligne d'abord sur les fragments de référence
  referenceFrags.forEach(refFrag => {
    if (!remaining.length) {
      ordered.push(null);
      return;
    }

    let bestIdx = -1;
    let bestScore = -1;

    remaining.forEach((candFrag, idx) => {
      const s = getFragmentSimilarityScore(refFrag, candFrag);
      if (s > bestScore) {
        bestScore = s;
        bestIdx = idx;
      }
    });

    if (bestIdx >= 0) {
      ordered.push(remaining[bestIdx]);
      remaining.splice(bestIdx, 1);
    } else {
      ordered.push(null);
    }
  });

  // 2) puis on ajoute les fragments restants à la fin
  return ordered.concat(remaining);
}

function buildAlignedFragmentsByAgencement(occs, byFragId) {
  const rawLists = occs.map(ag => getAgencementFragments(ag, byFragId));

  if (!rawLists.length) return [];

  // colonne de référence = premier agencement du pattern
  const reference = rawLists[0] || [];

  return rawLists.map((fragList, idx) => {
    if (idx === 0) return [...fragList]; // la référence garde son ordre
    return orderFragmentsByReference(reference, fragList);
  });
}


function getPatternGalleryDatasets() {
  if (currentPatternGalleryTimeMode === 'T2') {
    return {
      montreuil: dataGeojsonT2 || [],
      mirail: datamGeojsonT2 || []
    };
  }

  return {
    montreuil: dataGeojsonT1 || [],
    mirail: datamGeojsonT1 || []
  };
}



function showGalleryView() {
  const gallery = document.getElementById('gallery-view');
  gallery.innerHTML = '';

  const wrapper = document.createElement('div');
  wrapper.className = 'gallery-wrapper';
  gallery.appendChild(wrapper);

  const patternsEntries = Object.entries(patterns || {});
  if (!patternsEntries.length) {
    const msg = document.createElement('div');
    msg.style.color = '#aaa';
    msg.style.padding = '10px';
    msg.textContent = "Aucun pattern trouvé avec le seuil de similarité actuel.";
    gallery.appendChild(msg);
    return;
  }

  const galleryDatasets = getPatternGalleryDatasets();

  const allFrags = [
    ...(galleryDatasets.montreuil || []),
    ...(galleryDatasets.mirail || [])
  ].filter(f => !f.properties?.isDiscourse && !f.properties?.isBuilding);

  const byFragId = new Map(
    allFrags.map(f => [String(f.properties?.id || '').trim(), f])
  );

  const allBlds = [...(batimentsMontreuilGeojson || []), ...(batimentsToulouseGeojson || [])];
  const byBldId = new Map(
    allBlds.map(b => [String(b.properties?.id || '').trim(), b])
  );

  patternsEntries.forEach(([pKey, pData]) => {
    const occIds = (pData?.occurrences || []).slice();
    const occs = occIds
      .map(id => agencementsById.get(id))
      .filter(Boolean)
      .sort((a, b) => parseInt(String(a.id).replace('A', ''), 10) - parseInt(String(b.id).replace('A', ''), 10));

    if (!occs.length) return;

    const block = document.createElement('section');
    block.className = 'pattern-block';

    const title = document.createElement('h3');
    title.className = 'pattern-title';
    title.textContent = `${pKey} — ${occs.length} agencements`;

    const table = document.createElement('div');
    table.className = 'gallery-table';

    // En-tête colonnes
    const head = document.createElement('div');
    head.className = 'gallery-head';

    occs.forEach(ag => {
      const headCell = document.createElement('div');
      headCell.className = 'gallery-head-cell';
      headCell.innerHTML = `<strong>${ag.id}</strong><br>${ag.fragmentsCount} fragments`;
      head.appendChild(headCell);
    });

    table.appendChild(head);

    // Prépare fragments par agencement
 const fragmentsByAg = buildAlignedFragmentsByAgencement(occs, byFragId);
const maxRows = Math.max(...fragmentsByAg.map(arr => arr.filter(Boolean).length), 0);

const colTemplate = `repeat(${occs.length}, minmax(240px, 320px))`;
head.style.gridTemplateColumns = colTemplate;

const body = document.createElement('div');
body.className = 'gallery-body';

for (let rowIndex = 0; rowIndex < maxRows; rowIndex++) {
  const row = document.createElement('div');
  row.className = 'gallery-row';
  row.style.gridTemplateColumns = colTemplate;

  occs.forEach((ag, colIndex) => {
    const cell = document.createElement('div');
    cell.className = 'gallery-cell';

    const frag = fragmentsByAg[colIndex][rowIndex];

    if (frag) {
      cell.appendChild(buildGalleryFragmentCard(frag, ag, byFragId, byBldId));
    } else {
      cell.classList.add('is-empty');
    }

    row.appendChild(cell);
  });

  body.appendChild(row);
}

table.appendChild(body);

// Ligne bâtiments
const buildingsRow = document.createElement('div');
buildingsRow.className = 'gallery-buildings-row';
buildingsRow.style.gridTemplateColumns = colTemplate;

occs.forEach(ag => {
  const bCellWrap = document.createElement('div');
  bCellWrap.className = 'gallery-buildings-wrap';
  bCellWrap.appendChild(buildGalleryBuildingsCell(ag, byBldId));
  buildingsRow.appendChild(bCellWrap);
});

table.appendChild(buildingsRow);

    block.append(title, table);
    wrapper.appendChild(block);
  });
}



/*==================================================
=                  VUE PROXÉMIQUE                  =
==================================================*/


/***************************************************
 *  PROXÉMIE DES FRAGMENTS
 ***************************************************/

function showFragmentProxemicView() {
  fragmentProxemicView.innerHTML = "";

  const rect = fragmentProxemicView.getBoundingClientRect();

  const layout = buildFragmentProxemicLayoutData({
    width: rect.width,
    height: rect.height,
    timeMode: currentFragmentTimeMode
  });

  const {
    data: proxData,
    W, H, CX, CY, R_BASE,
    config
  } = layout;

  const { SUB_ORDER, SUB_LABELS, SECTORS } = config;

  if (!proxData.length) {
    fragmentProxemicView.innerHTML = "<div style='color:#aaa;padding:10px'>Aucun fragment.</div>";
    return;
  }

  function angleForSub(cat, sub) {
    const order = SUB_ORDER[cat];
    const idx = order.indexOf(sub);

    if (idx === -1) {
      const s = SECTORS[cat].start;
      const e = SECTORS[cat].end;
      return (s + e) / 2;
    }

    const s = SECTORS[cat].start;
    const e = SECTORS[cat].end;
    const slice = (e - s) / order.length;
    const subStart = s + idx * slice;
    const subEnd = subStart + slice;

    return (subStart + subEnd) / 2;
  }

  function getProxemicNodeStyle(d) {
    if (currentFragmentTimeMode !== 'trajectories') {
      return {
        fill: '#fff',
        fillOpacity: 1,
        stroke: '#222',
        strokeOpacity: 1
      };
    }

    const zone = d?.feature?.properties?.zone || d?.trajectoryPair?.zone || 'montreuil';
    const status = d?.trajectoryStatus || 'identical';
    const style = getTrajectoryStyle(status, zone);

    return {
      fill: style.fillColor,
      fillOpacity: style.fillOpacity,
      stroke: style.color,
      strokeOpacity: style.opacity
    };
  }

  const svg = d3.select("#fragment-proxemic-view")
    .append("svg")
    .attr("width", W)
    .attr("height", H);

  const world = svg.append("g");
  const slicesLayer = world.append("g");
  const trajectoryLayer = world.append("g");
  const nodesLayer = world.append("g");
  const labelsLayer = world.append("g");

  svg.call(
    d3.zoom()
      .scaleExtent([0.4, 4])
      .on("zoom", ev => world.attr("transform", ev.transform))
  );

  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(R_BASE);

  const sectors = [
    { key: "PA", label: "Pratiques actives" },
    { key: "FS", label: "Forces structurantes" },
    { key: "DH", label: "Dynamiques hybrides" }
  ];

  slicesLayer.selectAll("path.sector")
    .data(sectors)
    .join("path")
    .attr("class", "sector")
    .attr("d", d => arc({
      startAngle: SECTORS[d.key].start + Math.PI / 2,
      endAngle: SECTORS[d.key].end + Math.PI / 2
    }))
    .attr("transform", `translate(${CX},${CY})`)
    .style("fill", "none")
    .style("stroke", "rgba(255,255,255,0.45)")
    .style("stroke-width", 2);

  sectors.forEach(s => {
    const cat = s.key;
    const list = SUB_ORDER[cat];
    if (!list) return;

    const slice = (SECTORS[cat].end - SECTORS[cat].start) / list.length;

    for (let i = 1; i < list.length; i++) {
      const ang = SECTORS[cat].start + i * slice;

      slicesLayer.append("line")
        .attr("x1", CX)
        .attr("y1", CY)
        .attr("x2", CX + R_BASE * Math.cos(ang))
        .attr("y2", CY + R_BASE * Math.sin(ang))
        .style("stroke", "rgba(255,255,255,0.25)")
        .style("stroke-width", 1);
    }
  });

  const R_LABEL = R_BASE * 1.12;
  const R_LABEL_MAIN = R_BASE * 1.32;

  sectors.forEach(s => {
    const ang = (SECTORS[s.key].start + SECTORS[s.key].end) / 2;
    const x = CX + R_LABEL_MAIN * Math.cos(ang);
    const y = CY + R_LABEL_MAIN * Math.sin(ang);

    let deg = (ang * 180 / Math.PI) + 90;
    if (deg > 90 && deg < 270) deg += 180;

    labelsLayer.append("text")
      .attr("x", x)
      .attr("y", y)
      .attr("transform", `rotate(${deg}, ${x}, ${y})`)
      .text(s.label)
      .style("fill", "#fff")
      .style("font-size", "22px")
      .style("font-weight", "900")
      .style("text-anchor", "middle")
      .style("pointer-events", "none");
  });

  Object.entries(SUB_ORDER).forEach(([cat, subs]) => {
    subs.forEach(sub => {
      const ang = angleForSub(cat, sub);
      const x = CX + R_LABEL * Math.cos(ang);
      const y = CY + R_LABEL * Math.sin(ang);

      let deg = (ang * 180 / Math.PI) + 90;
      if (deg > 90 && deg < 270) deg += 180;

      labelsLayer.append("text")
        .attr("x", x)
        .attr("y", y)
        .attr("transform", `rotate(${deg}, ${x}, ${y})`)
        .text(SUB_LABELS[sub] || sub)
        .style("fill", "#fff")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("text-anchor", "middle")
        .style("pointer-events", "none");
    });
  });

  if (currentFragmentTimeMode === 'trajectories') {
    const ghostData = proxData.filter(d => d.hasGhost);

    trajectoryLayer.selectAll("line.fragment-trajectory")
      .data(ghostData)
      .join("line")
      .attr("class", "fragment-trajectory")
      .attr("x1", d => d.ghostX)
      .attr("y1", d => d.ghostY)
      .attr("x2", d => d.x)
      .attr("y2", d => d.y)
      .style("stroke", d => {
        const zone = d?.feature?.properties?.zone || 'montreuil';
        return getTrajectoryStyle('modified', zone).color;
      })
      .style("stroke-width", 1.5)
      .style("stroke-dasharray", "4 4")
      .style("opacity", 0.9)
      .style("pointer-events", "none");

    trajectoryLayer.selectAll("circle.fragment-ghost")
      .data(ghostData)
      .join("circle")
      .attr("class", "fragment-ghost")
      .attr("cx", d => d.ghostX)
      .attr("cy", d => d.ghostY)
      .attr("r", 8)
      .style("fill", "none")
      .style("stroke", d => {
        const zone = d?.feature?.properties?.zone || 'montreuil';
        return getTrajectoryStyle('modified', zone).color;
      })
      .style("stroke-width", 1.4)
      .style("stroke-opacity", 0.65)
      .style("pointer-events", "none");
  }

  const nodes = nodesLayer.selectAll("g.node")
    .data(proxData)
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`);

  nodes.append("circle")
    .attr("r", 8)
    .style("fill", d => getProxemicNodeStyle(d).fill)
    .style("fill-opacity", d => getProxemicNodeStyle(d).fillOpacity)
    .style("stroke", d => getProxemicNodeStyle(d).stroke)
    .style("stroke-opacity", d => getProxemicNodeStyle(d).strokeOpacity)
    .style("stroke-width", 1.2)
    .style("cursor", "pointer");

  nodes.append("text")
    .text(d => d.id)
    .attr("dy", "0.35em")
    .style("text-anchor", "middle")
    .style("font-size", "7px")
    .style("font-weight", "bold")
    .style("pointer-events", "none");

  let selected = null;

  function highlight(id) {
    nodes.style("opacity", n => n.id === id ? 1 : 0.15);

    if (currentFragmentTimeMode === 'trajectories') {
      trajectoryLayer.selectAll("line.fragment-trajectory, circle.fragment-ghost")
        .style("opacity", d => d.id === id ? 1 : 0.12);
    }
  }

  function reset() {
    if (selected) return;
    nodes.style("opacity", 1);

    if (currentFragmentTimeMode === 'trajectories') {
      trajectoryLayer.selectAll("line.fragment-trajectory")
        .style("opacity", 0.9);

      trajectoryLayer.selectAll("circle.fragment-ghost")
        .style("opacity", 1);
    }
  }

  nodes
    .on("mouseenter", function(ev, d) {
      if (selected) return;
      highlight(d.id);
    })
    .on("mouseleave", function() {
      if (selected) return;
      reset();
    })
    .on("click", (ev, d) => {
      ev.stopPropagation();

      if (unitCreation.active && unitCreation.mode === 'proxemic') {
        const fragId = d?.feature?.properties?.id || d?.id;
        const list = d?.patterns?.length ? d.patterns : getPatternsForFragment(fragId);

        const chosen = choosePatternKeyFromList(
          list,
          'Choisis le pattern à isoler dans Unité de projet :'
        );

        if (!chosen) return;

        handleUnitSelection(d.feature, chosen);
        return;
      }

      if (selected === d.id) {
        selected = null;
        reset();
      } else {
        selected = d.id;
        highlight(d.id);
      }

      if (currentFragmentTimeMode === 'trajectories' && d.trajectoryPair) {
        openTrajectoryFragmentTabs(d.trajectoryPair);
      } else {
        openFragmentWithPatternsTabs(d.feature.properties);
      }
    });

  svg.on("click", () => {
    selected = null;
    reset();
  });
}


/***************************************************
 *  PROXÉMIE 
 ***************************************************/

// Ouvre l’onglet fragment + tous ses patterns associés
function openFragmentWithPatternsTabs(fProps) {
  if (!fProps) return;

  clearAllTabbedTabs();
  closeSidebars();

  const fragId = fProps.id || Math.random().toString(36).slice(2);
  const fragTabId = `frag-${fragId}`;

  // 1) Onglet fragment
  openTab({
    id: fragTabId,
    title: fProps.id || 'Fragment',
    kind: 'fragment',
    render: (panel) => renderFragmentPanel(panel, fProps)
  });

  // 2) Onglets patterns associés
  const pList = getPatternsForFragment(fragId);
  pList.forEach(pName => {
    const pData = patterns[pName];
    if (!pData) return;
    openTab({
      id: `pattern-${pName}`,
      title: pName,
      kind: 'pattern',
      render: (panel) => renderPatternPanel(panel, pName, pData)
    });
  });

  // 3) On remet le focus sur le fragment
  focusTab(fragTabId);
}


// Ouvre l’onglet fragment t1 et/ou t2 d’une paire temporelle
function openTrajectoryFragmentTabs(pair) {
  if (!pair) return;

  clearAllTabbedTabs();
  closeSidebars();

  if (pair.t1) {
    openTab({
      id: `frag-${pair.id}-T1`,
      title: `${pair.id} · T1`,
      kind: 'fragment',
      render: (panel) => renderFragmentPanel(panel, pair.t1.properties)
    });
  }

  if (pair.t2) {
    openTab({
      id: `frag-${pair.id}-T2`,
      title: `${pair.id} · T2`,
      kind: 'fragment',
      render: (panel) => renderFragmentPanel(panel, pair.t2.properties)
    });
  }

  if (pair.t1) focusTab(`frag-${pair.id}-T1`);
  else if (pair.t2) focusTab(`frag-${pair.id}-T2`);
}


function getFragmentProxemicConfig() {
  const TWO_PI = Math.PI * 2;

  const GROUP_DETAILS = {
    PA: {
      entretien: [
        "PA_P1_intensitesoin", "PA_P1_frequencegestes", "PA_P1_degrecooperation"
      ],
      appr_spatiale: [
        "PA_P2_degretransformation", "PA_P2_perrenite", "PA_P2_autonomie"
      ],
      appr_sociale: [
        "PA_P3_intensiteusage", "PA_P3_frequenceusage", "PA_P3_diversitepublic", "PA_P3_conflitusage"
      ]
    },
    DH: {
      econ_subs: [
        "DH_P1_degreinformalite", "DH_P1_echellepratique", "DH_P1_degremutualisation"
      ],
      contest: [
        "DH_P2_degréorganisation", "DH_P2_porteepolitique", "DH_P2_effetspatial"
      ],
      symbolique: [
        "DH_P3_attachement"
      ],
      mobilites: [
        "DH_P4_intensiteflux"
      ]
    },
    FS: {
      gouvernance: [
        "FS_P1_presenceinstitutionnelle", "FS_P1_intensitecontrole"
      ],
      vacance: [
        "FS_P2_abandon"
      ],
      marche: [
        "FS_P3_pressionfonciere"
      ]
    }
  };

  const SUB_ORDER = {
    PA: ["entretien", "appr_spatiale", "appr_sociale"],
    DH: ["econ_subs", "contest", "symbolique", "mobilites"],
    FS: ["gouvernance", "vacance", "marche"]
  };

  const SUB_LABELS = {
    entretien: "Entretien / care",
    appr_spatiale: "Appropriation spatiale",
    appr_sociale: "Appropriation sociale",
    econ_subs: "Éco. de subsistance",
    contest: "Contestation / militantisme",
    symbolique: "Symbolique",
    mobilites: "Mobilités",
    gouvernance: "Cadres de gouvernance",
    vacance: "Vacance",
    marche: "Économie de marché"
  };

  const SECTORS = {
    PA: { start: -Math.PI / 2, end: -Math.PI / 2 + TWO_PI / 3 },
    FS: { start: -Math.PI / 2 + TWO_PI / 3, end: -Math.PI / 2 + 2 * TWO_PI / 3 },
    DH: { start: -Math.PI / 2 + 2 * TWO_PI / 3, end: -Math.PI / 2 + TWO_PI }
  };

  return {
    GROUP_DETAILS,
    SUB_ORDER,
    SUB_LABELS,
    SECTORS,
    TWO_PI
  };
}

function buildFragmentProxemicLayoutData({
  width,
  height,
  timeMode = currentFragmentTimeMode
}) {
  const {
    GROUP_DETAILS,
    SUB_ORDER,
    SECTORS
  } = getFragmentProxemicConfig();

  const W = width;
  const H = height;

  const CX = W * 0.50;
  const CY = H * 0.53;

  const R_BASE  = Math.min(W, H) * 0.42;
  const R_INNER = R_BASE * 0.15;
  const R_OUTER = R_BASE * 0.95;

  function cleanId(id) {
    return id ? String(id).trim().toUpperCase() : "";
  }

  function poleCategory(sub) {
    if (SUB_ORDER.PA.includes(sub)) return "PA";
    if (SUB_ORDER.FS.includes(sub)) return "FS";
    if (SUB_ORDER.DH.includes(sub)) return "DH";
    return null;
  }

  function computeSubScores(feature) {
    const scores = {};

    for (const [, subs] of Object.entries(GROUP_DETAILS)) {
      for (const [subName, keys] of Object.entries(subs)) {
        let sum = 0;
        let n = 0;

        for (const k of keys) {
          if (!ACTIVE_CRITERIA_KEYS.has(k)) continue;
          const v = parseFuzzy(feature.properties?.[k]);
          if (v !== null) {
            sum += v;
            n++;
          }
        }

        scores[subName] = n ? (sum / n) : null;
      }
    }

    return scores;
  }

  function hasAnyActiveCriterion(feature) {
    for (const k of ALL_FUZZY_KEYS) {
      if (!ACTIVE_CRITERIA_KEYS.has(k)) continue;
      if (parseFuzzy(feature.properties?.[k]) !== null) return true;
    }
    return false;
  }

  function getBestSubInfo(feature) {
    if (!feature || !feature.properties) return null;

    const subScores = computeSubScores(feature);

    let bestSub = null;
    let bestScore = -Infinity;

    Object.entries(subScores).forEach(([sub, val]) => {
      if (val !== null && val > bestScore) {
        bestScore = val;
        bestSub = sub;
      }
    });

    if (!bestSub) return null;

    const cat = poleCategory(bestSub);
    if (!cat) return null;

    return {
      bestSub,
      bestScore,
      category: cat
    };
  }

  function angleForSub(cat, sub) {
    const order = SUB_ORDER[cat];
    const idx = order.indexOf(sub);

    if (idx === -1) {
      const s = SECTORS[cat].start;
      const e = SECTORS[cat].end;
      return (s + e) / 2;
    }

    const s = SECTORS[cat].start;
    const e = SECTORS[cat].end;
    const slice = (e - s) / order.length;
    const subStart = s + idx * slice;
    const subEnd = subStart + slice;

    return (subStart + subEnd) / 2;
  }

 let raw = getFragmentProxemicSourceFeatures(timeMode);

  const zonesActive = getActiveZones ? getActiveZones() : ["mirail", "montreuil"];

  let features = raw
    .filter(f => f.properties && f.properties.id)
    .filter(f => !f.properties.isDiscourse && !f.properties.isBuilding)
    .map(f => {
      f.properties.id = cleanId(f.properties.id);
      return f;
    });

  if (zonesActive.length) {
    features = features.filter(f => {
      const id = f.properties.id;
      if (id.startsWith("M")) return zonesActive.includes("mirail");
      if (id.startsWith("N")) return zonesActive.includes("montreuil");
      return true;
    });
  }

  features = features.filter(f => hasAnyActiveCriterion(f));

  if (!features.length) {
    return {
      data: [],
      W, H, CX, CY, R_BASE, R_INNER, R_OUTER,
      minScore: 0,
      maxScore: 1,
      config: getFragmentProxemicConfig()
    };
  }

  const proxData = [];
  let minScore = Infinity;
  let maxScore = -Infinity;

  features.forEach(f => {
    const bestInfo = getBestSubInfo(f);
    if (!bestInfo) return;

    minScore = Math.min(minScore, bestInfo.bestScore);
    maxScore = Math.max(maxScore, bestInfo.bestScore);

    proxData.push({
      id: f.properties.id,
      feature: f,
      bestSub: bestInfo.bestSub,
      bestScore: bestInfo.bestScore,
      category: bestInfo.category,
      trajectoryStatus: f.properties?.__trajectoryStatus || null,
      trajectoryPair: f.properties?.__trajectoryPair || null
    });
  });

  if (!proxData.length) {
    return {
      data: [],
      W, H, CX, CY, R_BASE, R_INNER, R_OUTER,
      minScore: 0,
      maxScore: 1,
      config: getFragmentProxemicConfig()
    };
  }

  if (minScore === maxScore) minScore = maxScore - 1;

  proxData.forEach(d => {
    const n = (d.bestScore - minScore) / (maxScore - minScore || 1);
    const radius = R_INNER + n * (R_OUTER - R_INNER);
    const theta = angleForSub(d.category, d.bestSub);

    d.targetRadius = radius;
    d.targetTheta = theta;
    d.x = CX + radius * Math.cos(theta);
    d.y = CY + radius * Math.sin(theta);
  });

  const sim = d3.forceSimulation(proxData)
    .force("x", d3.forceX(d => d.x).strength(1))
    .force("y", d3.forceY(d => d.y).strength(1))
    .force("collide", d3.forceCollide(15))
    .stop();

  for (let i = 0; i < 200; i++) sim.tick();

  proxData.forEach(d => {
    d.x = d.x + (d.vx || 0);
    d.y = d.y + (d.vy || 0);
  });

  if (timeMode === 'trajectories') {
    proxData.forEach(d => {
      if (d.trajectoryStatus !== 'modified') return;

      const pair = d.trajectoryPair;
      const f1 = pair?.t1 || null;
      if (!f1 || !hasAnyActiveCriterion(f1)) return;

      const bestInfoT1 = getBestSubInfo(f1);
      if (!bestInfoT1) return;

      const n1 = (bestInfoT1.bestScore - minScore) / (maxScore - minScore || 1);
      const radius1 = R_INNER + n1 * (R_OUTER - R_INNER);
      const theta1 = angleForSub(bestInfoT1.category, bestInfoT1.bestSub);

      d.ghostX = CX + radius1 * Math.cos(theta1);
      d.ghostY = CY + radius1 * Math.sin(theta1);
      d.hasGhost = true;
    });
  }

  return {
    data: proxData,
    W, H, CX, CY, R_BASE, R_INNER, R_OUTER,
    minScore,
    maxScore,
    config: getFragmentProxemicConfig()
  };
}


function showProxemicView() {

  /* -----------------------------------------------------------
   * 0) RESET + DIMENSIONS
   * ----------------------------------------------------------- */
  proxemicView.innerHTML = "";

  const rect = proxemicView.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  // IMPORTANT :
  // la proxémie patterns est TOUJOURS construite sur la vue trajectoires,
  // sans jamais dépendre du mode T1 / T2 / trajectoires choisi côté fragments.
  const layout = buildFragmentProxemicLayoutData({
    width: W,
    height: H,
    timeMode: 'trajectories'
  });

  const {
    data: proxDataBase,
    CX, CY, R_BASE,
    config
  } = layout;

  const { SUB_ORDER, SUB_LABELS, SECTORS } = config;

  if (!proxDataBase.length) {
    proxemicView.innerHTML = "<div style='color:#aaa;padding:10px'>Aucun fragment.</div>";
    return;
  }

  /* -----------------------------------------------------------
   * 1) HELPERS LOCAUX
   * ----------------------------------------------------------- */
  function angleForSub(cat, sub) {
    const order = SUB_ORDER[cat];
    const idx = order.indexOf(sub);

    if (idx === -1) {
      const s = SECTORS[cat].start;
      const e = SECTORS[cat].end;
      return (s + e) / 2;
    }

    const s = SECTORS[cat].start;
    const e = SECTORS[cat].end;
    const slice = (e - s) / order.length;
    const subStart = s + idx * slice;
    const subEnd = subStart + slice;

    return (subStart + subEnd) / 2;
  }

  // IMPORTANT :
  // les bulles centrales de la vue patterns sont TOUJOURS blanches.
  function getPatternNodeBaseStyle() {
    return {
      fill: '#ffffff',
      fillOpacity: 1,
      stroke: '#222222',
      strokeOpacity: 1
    };
  }

  proxemicView.style.position = proxemicView.style.position || "relative";

  const diffTip = d3.select(proxemicView)
    .append("div")
    .attr("class", "diff-tooltip")
    .style("position", "absolute")
    .style("display", "none")
    .style("pointer-events", "none")
    .style("z-index", "9999");

  function moveDiffTip(ev) {
    const rect = proxemicView.getBoundingClientRect();
    let x = (ev.clientX - rect.left) + 12;
    let y = (ev.clientY - rect.top) + 12;

    const maxX = rect.width - 340;
    if (x > maxX) x = Math.max(8, maxX);

    diffTip.style("left", x + "px").style("top", y + "px");
  }

  const TOOLTIP_MIN_DIVERGENCE = 0.20;

  function showDiffTip(ev, d) {
    const aId = d.source?.id || "—";
    const bId = d.target?.id || "—";

    const diffs = (d.topDiffs || []).filter(item => {
      const delta = (item.delta != null)
        ? item.delta
        : (() => {
            if (item.a == null && item.b == null) return 0;
            if (item.a == null || item.b == null) return 1;

            if (Array.isArray(item.a) && Array.isArray(item.b)) {
              return 1 - jaccardSimilarity(item.a, item.b);
            }

            return Math.abs(item.a - item.b);
          })();

      return delta >= TOOLTIP_MIN_DIVERGENCE;
    });

    const listHtml = diffs.map(item => {
      const label = prettyKey(item.key);
      const a = fmtAny(item.a);
      const b = fmtAny(item.b);
      return `<li><span class="k">${label}</span> : <span class="v">${a}</span> vs <span class="v">${b}</span></li>`;
    }).join("");

    diffTip.html(`
      <div class="dt-title">Diffraction : ${aId} ↔ ${bId}</div>
      <div class="dt-sub">Pattern ${d.pattern || "—"}</div>
      <ul class="dt-list">${listHtml || "<li>—</li>"}</ul>
    `);

    diffTip.style("display", "block");
    moveDiffTip(ev);
  }

  function hideDiffTip() {
    diffTip.style("display", "none");
  }

  /* -----------------------------------------------------------
   * 2) SVG + GROUPES
   * ----------------------------------------------------------- */
  const svg = d3.select("#proxemic-view")
    .append("svg")
    .attr("width", W)
    .attr("height", H);

  const world = svg.append("g");
  const slicesLayer = world.append("g");
  const trajectoryLayer = world.append("g");
  const linksLayer = world.append("g");
  const nodesLayer = world.append("g");
  const labelsLayer = world.append("g");

  svg.call(
    d3.zoom()
      .scaleExtent([0.4, 4])
      .on("zoom", ev => world.attr("transform", ev.transform))
  );

  /* -----------------------------------------------------------
   * 3) DONUT / SECTEURS
   * ----------------------------------------------------------- */
  const arc = d3.arc()
    .innerRadius(0)
    .outerRadius(R_BASE);

  const sectors = [
    { key: "PA", label: "Pratiques actives" },
    { key: "FS", label: "Forces structurantes" },
    { key: "DH", label: "Dynamiques hybrides" }
  ];

  slicesLayer.selectAll("path.sector")
    .data(sectors)
    .join("path")
    .attr("class", "sector")
    .attr("d", d => arc({
      startAngle: SECTORS[d.key].start + Math.PI / 2,
      endAngle: SECTORS[d.key].end + Math.PI / 2
    }))
    .attr("transform", `translate(${CX},${CY})`)
    .style("fill", "none")
    .style("stroke", "rgba(255,255,255,0.45)")
    .style("stroke-width", 2);

  sectors.forEach(s => {
    const cat = s.key;
    const list = SUB_ORDER[cat];
    if (!list) return;

    const slice = (SECTORS[cat].end - SECTORS[cat].start) / list.length;

    for (let i = 1; i < list.length; i++) {
      const ang = SECTORS[cat].start + i * slice;

      slicesLayer.append("line")
        .attr("x1", CX)
        .attr("y1", CY)
        .attr("x2", CX + R_BASE * Math.cos(ang))
        .attr("y2", CY + R_BASE * Math.sin(ang))
        .style("stroke", "rgba(255,255,255,0.25)")
        .style("stroke-width", 1);
    }
  });

  /* -----------------------------------------------------------
   * 4) LABELS
   * ----------------------------------------------------------- */
  const R_LABEL = R_BASE * 1.12;
  const R_LABEL_MAIN = R_BASE * 1.32;

  sectors.forEach(s => {
    const ang = (SECTORS[s.key].start + SECTORS[s.key].end) / 2;

    const x = CX + R_LABEL_MAIN * Math.cos(ang);
    const y = CY + R_LABEL_MAIN * Math.sin(ang);

    let deg = (ang * 180 / Math.PI) + 90;
    if (deg > 90 && deg < 270) deg += 180;

    labelsLayer.append("text")
      .attr("x", x)
      .attr("y", y)
      .attr("transform", `rotate(${deg}, ${x}, ${y})`)
      .text(s.label)
      .style("fill", "#fff")
      .style("font-size", "22px")
      .style("font-weight", "900")
      .style("text-anchor", "middle")
      .style("pointer-events", "none");
  });

  Object.entries(SUB_ORDER).forEach(([cat, subs]) => {
    subs.forEach(sub => {
      const ang = angleForSub(cat, sub);
      const x = CX + R_LABEL * Math.cos(ang);
      const y = CY + R_LABEL * Math.sin(ang);

      let deg = (ang * 180 / Math.PI) + 90;
      if (deg > 90 && deg < 270) deg += 180;

      labelsLayer.append("text")
        .attr("x", x)
        .attr("y", y)
        .attr("transform", `rotate(${deg}, ${x}, ${y})`)
        .text(SUB_LABELS[sub] || sub)
        .style("fill", "#fff")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("text-anchor", "middle")
        .style("pointer-events", "none");
    });
  });

  /* -----------------------------------------------------------
   * 5) BASE UNIQUE = TRAJECTOIRES (FORCÉ)
   * ----------------------------------------------------------- */
  const proxData = proxDataBase.map(d => ({
    ...d,
    patterns: getPatternsForFragment ? getPatternsForFragment(d.id) : []
  }));

  const ghostData = proxData.filter(d => d.hasGhost);

  // trajectoires grises
  trajectoryLayer.selectAll("line.fragment-trajectory")
    .data(ghostData)
    .join("line")
    .attr("class", "fragment-trajectory")
    .attr("x1", d => d.ghostX)
    .attr("y1", d => d.ghostY)
    .attr("x2", d => d.x)
    .attr("y2", d => d.y)
    .style("stroke", "#8e8e8e")
    .style("stroke-width", 1.2)
    .style("stroke-dasharray", "4 4")
    .style("opacity", 0.45)
    .style("pointer-events", "none");

  trajectoryLayer.selectAll("circle.fragment-ghost")
    .data(ghostData)
    .join("circle")
    .attr("class", "fragment-ghost")
    .attr("cx", d => d.ghostX)
    .attr("cy", d => d.ghostY)
    .attr("r", 7)
    .style("fill", "none")
    .style("stroke", "#8e8e8e")
    .style("stroke-width", 1.2)
    .style("stroke-opacity", 0.45)
    .style("pointer-events", "none");

  /* -----------------------------------------------------------
   * 6) LIENS ENTRE FRAGMENTS
   * ----------------------------------------------------------- */
  const linksData = [];

  for (let i = 0; i < proxData.length; i++) {
    for (let j = i + 1; j < proxData.length; j++) {
      const A = proxData[i];
      const B = proxData[j];
      const common = (A.patterns || []).filter(p => (B.patterns || []).includes(p));
      if (!common.length) continue;

      linksData.push({
        source: A,
        target: B,
        color: colorForPattern ? colorForPattern(common[0]) : "#888",
        dashed: false,
        opacity: 0.25
      });
    }
  }

  if (SHOW_DIFFRACTIONS) {
    const all = [...(dataGeojson || []), ...(datamGeojson || [])];
    const byId = new Map(all.map(f => [String(f.properties.id).trim().toUpperCase(), f]));
    const byIdNode = new Map(proxData.map(n => [n.id, n]));

    const diffEdges = computeInternalDiffractionEdges(patterns, byId, { topK: 1 });

    diffEdges.forEach(e => {
      const A = byIdNode.get(e.a);
      const B = byIdNode.get(e.b);
      if (!A || !B) return;

      const vecA = featureToVector(A.feature);
      const vecB = featureToVector(B.feature);

      const topDiffs = topVectorDifferences(vecA, vecB, { topN: 3 });

      linksData.push({
        source: A,
        target: B,
        color: colorForPattern ? colorForPattern(e.pattern) : "#fff",
        dashed: true,
        opacity: 0.45,
        pattern: e.pattern,
        opposition: e.opposition,
        comparability: e.comparability,
        common: e.common,
        mismatch: e.mismatch,
        topDiffs
      });
    });
  }

  const HIT_WIDTH_DASHED = 14;
  const HIT_WIDTH_NORMAL = 0;

  const hitSel = linksLayer.selectAll("line.link-hit")
    .data(linksData)
    .join("line")
    .attr("class", "link-hit")
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y)
    .style("stroke", "transparent")
    .style("stroke-width", d => d.dashed ? HIT_WIDTH_DASHED : HIT_WIDTH_NORMAL)
    .style("pointer-events", d => d.dashed ? "stroke" : "none");

  linksLayer.selectAll("line.link")
    .data(linksData)
    .join("line")
    .attr("class", "link")
    .attr("x1", d => d.source.x)
    .attr("y1", d => d.source.y)
    .attr("x2", d => d.target.x)
    .attr("y2", d => d.target.y)
    .style("stroke", d => d.color)
    .style("stroke-width", d => d.dashed ? 2.5 : 2)
    .style("opacity", d => (d.opacity != null ? d.opacity : 0.25))
    .style("stroke-dasharray", d => d.dashed ? "6 6" : null)
    .style("pointer-events", "none");

  hitSel
    .on("mouseenter", (ev, d) => {
      if (!SHOW_DIFFRACTIONS || !d.dashed) return;
      showDiffTip(ev, d);
    })
    .on("mousemove", (ev, d) => {
      if (!SHOW_DIFFRACTIONS || !d.dashed) return;
      moveDiffTip(ev);
    })
    .on("mouseleave", (ev, d) => {
      if (!d.dashed) return;
      hideDiffTip();
    });

  /* -----------------------------------------------------------
   * 7) NŒUDS = BASE TRAJECTOIRE + ANNEAUX DE PATTERNS
   * ----------------------------------------------------------- */
  const nodes = nodesLayer.selectAll("g.node")
    .data(proxData)
    .join("g")
    .attr("class", "node")
    .attr("transform", d => `translate(${d.x},${d.y})`);

  // anneaux colorés de patterns
  nodes.each(function(d) {
    if (!d.patterns) return;

    d.patterns.slice()
      .sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10))
      .forEach((p, i) => {
        d3.select(this).append("circle")
          .attr("r", 11 + i * 3)
          .style("fill", "none")
          .style("stroke", colorForPattern ? colorForPattern(p) : "#999")
          .style("stroke-width", 2)
          .style("pointer-events", "none");
      });
  });

  // bulle centrale blanche
  nodes.append("circle")
    .attr("r", 8)
    .style("fill", d => getPatternNodeBaseStyle(d).fill)
    .style("fill-opacity", d => getPatternNodeBaseStyle(d).fillOpacity)
    .style("stroke", d => getPatternNodeBaseStyle(d).stroke)
    .style("stroke-opacity", d => getPatternNodeBaseStyle(d).strokeOpacity)
    .style("stroke-width", 1.2)
    .style("cursor", "pointer");

  nodes.append("text")
    .text(d => d.id)
    .attr("dy", "0.35em")
    .style("text-anchor", "middle")
    .style("font-size", "7px")
    .style("font-weight", "bold")
    .style("pointer-events", "none");

  /* -----------------------------------------------------------
   * 8) INTERACTIONS
   * ----------------------------------------------------------- */
  let selected = null;

  function highlight(id) {
    linksLayer.selectAll("line.link")
      .style("opacity", d => (d.source.id === id || d.target.id === id) ? 0.9 : 0.05);

    trajectoryLayer.selectAll("line.fragment-trajectory, circle.fragment-ghost")
      .style("opacity", d => d.id === id ? 1 : 0.10);

    const connected = new Set([id]);
    linksData.forEach(L => {
      if (L.source.id === id) connected.add(L.target.id);
      if (L.target.id === id) connected.add(L.source.id);
    });

    nodes.style("opacity", n => connected.has(n.id) ? 1 : 0.10);
  }

  function reset() {
    if (selected) return;

    nodes.style("opacity", 1);

    linksLayer.selectAll("line.link")
      .style("opacity", 0.25);

    trajectoryLayer.selectAll("line.fragment-trajectory")
      .style("opacity", 0.45);

    trajectoryLayer.selectAll("circle.fragment-ghost")
      .style("opacity", 1);
  }

  nodes
    .on("mouseenter", function(ev, d) {
      if (selected) return;
      highlight(d.id);
    })
    .on("mouseleave", function() {
      if (selected) return;
      reset();
    })
    .on("click", function(ev, d) {
      ev.stopPropagation();

      if (selected === d.id) {
        selected = null;
        reset();
      } else {
        selected = d.id;
        highlight(d.id);
      }

      if (d.trajectoryPair) {
        openTrajectoryFragmentTabs(d.trajectoryPair);
      } else {
        openFragmentWithPatternsTabs(d.feature.properties);
      }
    });

  svg.on("click", () => {
    selected = null;
    reset();
  });
}

function choosePatternKeyFromList(list, messagePrefix = 'Ce fragment appartient à plusieurs patterns :') {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0];

  const msg = messagePrefix + '\n' + list.map((p,i)=>`${i+1}) ${p}`).join('\n') + '\nTape le numéro :';
  const ans = window.prompt(msg, '1');
  const idx = parseInt(ans, 10);
  if (!Number.isFinite(idx) || idx < 1 || idx > list.length) return null;
  return list[idx - 1];
}


/* ==================================================
   9) CARTES PATTERNS ET UNITÉS
================================================== */
/*==================================================
=        CARTE PATTERNS : INIT + COULEURS          =
==================================================*/

function colorForPattern(pName) {
  const key = String(pName || '').trim().toUpperCase();

  // 1) Couleur explicitement déclarée (prioritaire)
  if (PATTERN_COLORS[key]) return PATTERN_COLORS[key];

  // 2) Support P12 / D12 (numérique stable)
  const m = key.match(/^([PD])(\d+)$/);
  if (m) {
    const prefix = m[1];              // 'P' ou 'D'
    const n = parseInt(m[2], 10);     // numéro
    if (Number.isFinite(n)) {
      // Option A (recommandée) : décaler D pour ne pas réutiliser exactement les mêmes couleurs que P
      const offset = (prefix === 'D') ? 50 : 0;  // ajuste 50 si tu veux plus/moins d’écart
      const idx = (((n - 1 + offset) % 100) + 1);
      const pKey = `P${idx}`; // on réutilise le nuancier P existant
      return PATTERN_COLORS[pKey] || `hsl(${(idx * 37) % 360}, 90%, 55%)`;
    }
  }

  // 3) Fallback hash (stable)
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h}, 90%, 55%)`;
}
window.colorForPattern = colorForPattern;

function labelColorForPattern(pName) {
  const hsl = colorForPattern(pName);
  const m = hsl.match(/hsl\(\s*\d+,\s*\d+%?,\s*(\d+)%\s*\)/);
  const L = m ? parseInt(m[1], 10) : 55;
  return (L >= 62) ? '#000' : '#fff';
}

/* Zones actives (Montreuil/Mirail) */
function getActiveZones() {
  return Array.from(document.querySelectorAll('.filter-zone:checked')).map(cb => cb.value);
}
function isFeatureInActiveZones(f) {
  const zones = getActiveZones();
  const zone = f.properties?.zone || f.zone || null;
  if (!zone) return true; // fallback

  return zones.includes(zone);
}

function featureHasAnyActiveCriterion(feature) {
  if (!feature?.properties) return false;

  // fuzzy
  for (const k of ALL_FUZZY_KEYS) {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) continue;
    if (parseFuzzy(feature.properties[k]) !== null) return true;
  }

  // texte
  for (const k of TEXT_KEYS) {
    if (!ACTIVE_CRITERIA_KEYS.has(k)) continue;
    if ((parseMultiText(feature.properties[k]) || []).length) return true;
  }

  return false;
}

function getVisibleSpatialFeaturesForPatterns() {
  const allSpatial = [
    ...(dataGeojson || []),
    ...(datamGeojson || []),
    ...(batimentsMontreuilGeojson || []),
    ...(batimentsToulouseGeojson || [])
  ].filter(f => {
    const props = f?.properties || {};
    if (props.isDiscourse) return false;
    if (!isFeatureInActiveZones(f)) return false;
    return true;
  });

  const visibleFragments = allSpatial.filter(f => {
    const props = f.properties || {};
    return !props.isBuilding && featureHasAnyActiveCriterion(f);
  });

  const visibleBuildings = allSpatial.filter(f => {
    const props = f.properties || {};
    return !!props.isBuilding;
  });

  return { visibleFragments, visibleBuildings };
}

/* Patterns auxquels appartient un fragment */
function getPatternsForFragment(fragmentId) {
  const id = String(fragmentId || '').trim();
  return fragmentToPatternIds.get(id) || [];
}


/* Init carte patterns */
function initPatternMapOnce() {
  if (patternMap) return;
  patternMap = L.map('patterns-map', { zoomControl: true, attributionControl: true })
    .setView(montreuilView, montreuilZoom);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors, © CartoDB'
  }).addTo(patternMap);

  patternBaseLayer = L.layerGroup().addTo(patternMap);
  patternOverlayGroup = L.layerGroup().addTo(patternMap);
  patternBuildingsLayer = L.layerGroup().addTo(patternMap);


  fetch('data/contour.geojson')
    .then(r => r.json())
    .then(contour => {
      L.geoJSON(contour, {
        style: { color: '#919090', weight: 2, opacity: 0.8, fillOpacity: 0 }
      }).addTo(patternMap);
    });
}

/* Pane par anneau (zIndex différent) */
function ensureRingPane(ringIndex) {
  const paneId = `pane-ring-${ringIndex}`;
  if (patternPanes.has(paneId)) return paneId;
  patternMap.createPane(paneId);
  patternMap.getPane(paneId).style.zIndex = 600 + ringIndex;
  patternPanes.set(paneId, paneId);
  return paneId;
}


function getPatternTrajectoryBaseFeatures() {
  const activeZones = getActiveZones ? getActiveZones() : ['montreuil', 'mirail'];
  const out = [];

  ['montreuil', 'mirail'].forEach(zone => {
    if (!activeZones.includes(zone)) return;

    const pairs = buildTemporalPairsForZone(zone);

    pairs.forEach(pair => {
      const feature = pair.t2 || pair.t1;
      if (!feature) return;

      out.push({
        ...feature,
        properties: {
          ...(feature.properties || {}),
          zone,
          __trajectoryStatus: pair.status,
          __trajectoryPair: pair
        }
      });
    });
  });

  return out;
}




/* Fond gris : fragments visibles */
function renderPatternBaseGrey() {
  if (!patternMap) return;
  patternBaseLayer.clearLayers();
  if (patternBuildingsLayer) patternBuildingsLayer.clearLayers();


  const baseFeatures = getPatternTrajectoryBaseFeatures();

  L.geoJSON(
    { type: 'FeatureCollection', features: baseFeatures },
    {
      filter: feat => isFeatureInActiveZones(feat) && !feat.properties?.isDiscourse,
      pointToLayer: (feature, latlng) => {
        const styleObj = getGreyTrajectoryStyle(feature.properties?.__trajectoryStatus);
        return L.circleMarker(latlng, {
          radius: styleObj.radius,
          color: styleObj.color,
          weight: styleObj.weight,
          opacity: styleObj.opacity,
          fillColor: styleObj.fillColor,
          fillOpacity: styleObj.fillOpacity
        });
      },
      style: feature => {
        const styleObj = getGreyTrajectoryStyle(feature.properties?.__trajectoryStatus);
        return {
          color: styleObj.color,
          weight: styleObj.weight,
          opacity: styleObj.opacity,
          fillColor: styleObj.fillColor,
          fillOpacity: styleObj.fillOpacity
        };
      },
      onEachFeature: (feature, layer) => {
        const pair = feature.properties?.__trajectoryPair || null;

        layer.on('click', () => {
          if (pair) openTrajectoryFragmentTabs(pair);
          else onPatternsMapFragmentClick(feature);
        });
      }
    }
  ).addTo(patternBaseLayer);

 const bStyle = {
  stroke: false,        
  fill: true,
  fillColor: '#b5b5b5', 
  fillOpacity: 0.20     
};


  const buildingsVisible = [
    ...(batimentsMontreuilGeojson || []),
    ...(batimentsToulouseGeojson  || [])
  ].filter(f => isFeatureInActiveZones(f));

  if (patternBuildingsLayer && buildingsVisible.length) {
    L.geoJSON(
      { type:'FeatureCollection', features: buildingsVisible },
      {
        style: () => bStyle,
        interactive: false
      }
    ).addTo(patternBuildingsLayer);
  }


}

/* Rafraîchit les anneaux colorés (patterns) */
function refreshPatternsMap() {
  if (!patternMap) return;
  patternOverlayGroup.clearLayers();

  const zones = getActiveZones();

  function agencementZone(ag) {
    const allFrags = [...(dataGeojson || []), ...(datamGeojson || [])];
    const byId = new Map(allFrags.map(f => [f.properties?.id, f]));
    for (const id of (ag.fragmentIds || [])) {
      const f = byId.get(id);
      if (f?.properties?.zone) return f.properties.zone;
    }
    return null;
  }

  const baseStyle = {
    color: '#9a9a9a',
    weight: 1,
    opacity: 0.25,
    fill: false
  };

  const RING_SPACING_M = 12;   // anneaux espacés de 12m (lisible)
  const RING_WEIGHT = 3;

  (agencements || []).forEach(ag => {
    const z = agencementZone(ag);
    if (z && !zones.includes(z)) return;

    const c = ag.center;
    if (!c) return;

    // 1) périmètre gris
    L.circle(c, { ...baseStyle, radius: ag.radiusM })
      .addTo(patternOverlayGroup);

    const pList = (ag.patternIds || []).slice();
    if (!pList.length) return;

    // tri P1,P2...
    pList.sort((a,b) => parseInt(a.replace('P',''),10) - parseInt(b.replace('P',''),10));

    // tooltip
    const tipHtml = `
      <div class="pt-title"><strong>${ag.id}</strong></div>
      <div>${ag.fragmentsCount} fragments • ${ag.buildingsCount} bâtiments</div>
      <div style="margin-top:6px">Patterns : ${pList.join(', ')}</div>
    `;

    // 2) anneaux colorés (autour du périmètre)
    pList.forEach((pName, idx) => {
      const color = colorForPattern(pName);
      const ring = L.circle(c, {
        radius: ag.radiusM + idx * RING_SPACING_M,
        color,
        weight: RING_WEIGHT,
        opacity: 0.95,
        fill: false
      });

      ring.on('mouseover', function () {
        if (!this._tooltip) {
          this.bindTooltip(tipHtml, {
            className: 'pattern-tip',
            direction: 'top',
            sticky: true,
            opacity: 1
          }).openTooltip();
        } else {
          this.openTooltip();
        }
      });

      ring.on('mouseout', function () { this.closeTooltip(); });

      ring.addTo(patternOverlayGroup);
    });
  });
}

function onPatternsMapFragmentClick(feature, patternKey) {
  if (unitCreation.active) {
    handleUnitSelection(feature, patternKey);
    return;
  }
  openFragmentWithPatternsTabs(feature.properties || {});
}

/* ==================================================
   9BIS) UNITES DE PROJET
================================================== */

unitCreation.mode = null; // 'map' | 'proxemic'

function startUnitCreationMap() {
  unitCreation.mode = 'map';

  setTopTab('patterns');
  setSubTab('patterns-map');
  initPatternMapOnce();

  if (unitCreation.active) return;
  unitCreation.active = true;

  // (ton code existant)
  if (patternOverlayGroup && patternMap.hasLayer(patternOverlayGroup)) {
    patternMap.removeLayer(patternOverlayGroup);
    unitCreation.ringsVisible = false;
  }

  const btn = document.getElementById('create-unit-btn');
  if (btn) { btn.textContent = 'Annuler la création'; btn.classList.add('is-armed'); btn.setAttribute('aria-pressed','true'); }

  const cont = patternMap.getContainer();
  cont.classList.add('patterns-creating');

  const hint = document.getElementById('unit-hint');
  if (hint) {
    hint.textContent = 'Clique un fragment sur la carte (Patterns) pour créer une unité';
    hint.style.display = 'block';
    unitCreation.mouseMoveHandler = (e) => { hint.style.left = e.clientX + 'px'; hint.style.top = e.clientY + 'px'; };
    window.addEventListener('mousemove', unitCreation.mouseMoveHandler);
  }
}

function startUnitCreationProxemic() {
  unitCreation.mode = 'proxemic';

  setTopTab('patterns');
  setSubTab('proxemic'); // on reste en proxémie

  if (unitCreation.active) return;
  unitCreation.active = true;

  const btn = document.getElementById('create-unit-btn');
  if (btn) { btn.textContent = 'Annuler la création'; btn.classList.add('is-armed'); btn.setAttribute('aria-pressed','true'); }

  // pas de "patterns-creating" ici (pas de patternMap)
  const hint = document.getElementById('unit-hint');
  if (hint) {
    hint.textContent = 'Clique un fragment dans la proxémie pour choisir un pattern';
    hint.style.display = 'block';
    unitCreation.mouseMoveHandler = (e) => { hint.style.left = e.clientX + 'px'; hint.style.top = e.clientY + 'px'; };
    window.addEventListener('mousemove', unitCreation.mouseMoveHandler);
  }
}



function stopUnitCreation() {
  if (!unitCreation.active) return;

  unitCreation.active = false;

  if (unitCreation.mode === 'map') {
    if (!unitCreation.ringsVisible && patternOverlayGroup) {
      patternOverlayGroup.addTo(patternMap);
      unitCreation.ringsVisible = true;
    }
    const cont = patternMap.getContainer();
    cont.classList.remove('patterns-creating');
  }

  unitCreation.mode = null;

  const btn = document.getElementById('create-unit-btn');
  if (btn) { btn.textContent = 'Créer une Unité de Projet'; btn.classList.remove('is-armed'); btn.setAttribute('aria-pressed','false'); }

  const hint = document.getElementById('unit-hint');
  if (hint) hint.style.display = 'none';

  if (unitCreation.mouseMoveHandler) {
    window.removeEventListener('mousemove', unitCreation.mouseMoveHandler);
    unitCreation.mouseMoveHandler = null;
  }
}


document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && unitCreation.active) stopUnitCreation(); });

// Bouton toggle création UP
const createUnitBtn = document.getElementById('create-unit-btn');

if (createUnitBtn) createUnitBtn.addEventListener('click', () => {
  if (unitCreation.active) { stopUnitCreation(); return; }

  const sub = document.querySelector('.sub-tab.active')?.dataset.sub || 'proxemic';

  if (sub === 'proxemic') startUnitCreationProxemic();
  else startUnitCreationMap(); // patterns-map ou autre
});

// Sélection d’un fragment ⇒ création UP locale
function handleUnitSelection(feature, patternKey) {
  stopUnitCreation();

  const srcId = feature?.properties?.id || 'UNK';

  // déterminer patternKey si pas fourni
  if (!patternKey) {
    const list = getPatternsForFragment(srcId);
    patternKey = choosePatternKeyFromList(list, 'Choisis le pattern à utiliser pour cette unité :');
    if (!patternKey) return;
  }

  let unitId = `UP-${srcId}`;
  const exists = loadUnitsLocal().some(u => u.id === unitId);
  if (exists) unitId = `UP-${srcId}-${Date.now().toString().slice(-4)}`;

  const unit = {
    id: unitId,
    sourceFragmentId: srcId,
    geometry: feature.geometry,
    patternKey,                    // ✅ nouveau
    props: { name: unitId },
    createdAt: new Date().toISOString()
  };

  saveUnitLocal(unit);

  // ✅ contexte "pattern isolé" pour l'onglet unité
  unitContext = { patternKey, sourceFragmentId: srcId };

  setTopTab('unit');
  showView('unit-view');

  // Par défaut, ouvre la carte unité et affiche le pattern
  setUnitSubTab('map');
  setTimeout(() => {
    renderUnitPatternContextOnUnitMap(patternKey, srcId);
  }, 0);
}


function getCombinedFeatureById(id) {
  // combinedFeatures est déjà utilisé dans ta carte patterns (si accessible globalement)
  if (typeof combinedFeatures !== 'undefined' && Array.isArray(combinedFeatures)) {
    return combinedFeatures.find(f => f?.properties?.id === id);
  }
  return null;
}

function renderUnitPatternContextOnUnitMap(patternKey, sourceId) {
  const mapU = ensureUnitMap();

  if (!unitPatternGroup) unitPatternGroup = L.layerGroup().addTo(mapU);
  unitPatternGroup.clearLayers();

  const occIds = patterns?.[patternKey]?.occurrences || [];
  if (!occIds.length) return;

  let bounds = null;

  occIds.forEach(oid => {
    const ag = agencementsById.get(oid);
    if (!ag?.center) return;

    const isSourceInside = (ag.fragmentIds || []).includes(sourceId);

    const mk = L.circleMarker(ag.center, {
      radius: isSourceInside ? 9 : 7,
      color: isSourceInside ? '#fff' : '#888',
      weight: isSourceInside ? 3 : 2,
      fillColor: isSourceInside ? '#fff' : '#888',
      fillOpacity: isSourceInside ? 0.22 : 0.12
    });

    mk.on('click', () => {
      // ouvre l’agencement panel
      const allFrags = [...(dataGeojson || []), ...(datamGeojson || [])]
        .filter(f => !f.properties?.isDiscourse && !f.properties?.isBuilding);
      const byFragId = new Map(allFrags.map(f => [String(f.properties?.id||'').trim(), f]));

      const allBlds = [...(batimentsMontreuilGeojson || []), ...(batimentsToulouseGeojson || [])];
      const byBldId = new Map(allBlds.map(b => [String(b.properties?.id||'').trim(), b]));

      openTab({
        id: `ag-${ag.id}`,
        title: ag.id,
        kind: 'agencement',
        render: (p) => renderAgencementPanel(p, ag, { byFragId, byBldId })
      });
    });

    mk.addTo(unitPatternGroup);
    bounds = bounds ? bounds.extend(ag.center) : L.latLngBounds([ag.center, ag.center]);
  });

  if (bounds && bounds.isValid()) mapU.fitBounds(bounds.pad(0.25));
}


function renderUnitProxemicPattern(patternKey, sourceId) {
  const host = document.getElementById('unit-proxemic');
  if (!host) return;

  host.innerHTML = '';

  const occIds = patterns?.[patternKey]?.occurrences || [];
  if (!occIds.length) {
    host.textContent = 'Aucun fragment dans ce pattern.';
    return;
  }

  const ids = computeFragmentsUnionFromOccurrences(occIds);
  if (!ids.length) {
    host.textContent = 'Aucun fragment dans ce pattern.';
    return;
  }

  const w = host.clientWidth || window.innerWidth;
  const h = host.clientHeight || window.innerHeight;

  const svg = d3.select(host).append('svg')
    .attr('width', w)
    .attr('height', h);

  const centerNode = { id: `PATTERN:${patternKey}`, isPattern: true, label: patternKey };
  const fragNodes = ids.map(fid => {
    const feat = getCombinedFeatureById(fid);
    return {
      id: fid,
      isPattern: false,
      isSource: fid === sourceId,
      feature: feat
    };
  }).filter(n => !!n.feature);

  const nodes = [centerNode, ...fragNodes];
  const links = fragNodes.map(n => ({ source: centerNode.id, target: n.id }));

  const link = svg.append('g')
    .selectAll('line')
    .data(links)
    .enter().append('line')
    .attr('stroke', '#666')
    .attr('stroke-width', 1)
    .attr('stroke-dasharray', '4,4')
    .attr('opacity', 0.8);

  const node = svg.append('g')
    .selectAll('circle')
    .data(nodes)
    .enter().append('circle')
    .attr('r', d => d.isPattern ? 22 : (d.isSource ? 10 : 8))
    .attr('fill', d => d.isPattern ? 'none' : (d.isSource ? '#fff' : '#777'))
    .attr('stroke', d => d.isPattern ? '#fff' : '#111')
    .attr('stroke-width', d => d.isPattern ? 2 : 1)
    .style('cursor', d => d.isPattern ? 'default' : 'pointer')
    .on('click', (ev, d) => {
      if (d.isPattern) return;
      openFragmentWithPatternsTabs(d.feature?.properties || {});
    });

  const label = svg.append('g')
    .selectAll('text')
    .data(nodes)
    .enter().append('text')
    .text(d => d.isPattern ? d.label : d.id)
    .attr('font-size', d => d.isPattern ? 13 : 10)
    .attr('fill', '#fff')
    .attr('text-anchor', 'middle');

  const sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d => d.id).distance(140).strength(0.7))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(w / 2, h / 2))
    .force('collide', d3.forceCollide().radius(d => d.isPattern ? 32 : 16))
    .on('tick', () => {
      link
        .attr('x1', d => d.source.x).attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x).attr('y2', d => d.target.y);

      node.attr('cx', d => d.x).attr('cy', d => d.y);
      label.attr('x', d => d.x).attr('y', d => d.y + (d.isPattern ? 40 : 22));
    });
}


function saveUnitLocal(unit) {
  try {
    const key = 'units'; const arr = JSON.parse(localStorage.getItem(key) || '[]'); arr.push(unit);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch (e) { console.warn('Impossible d’enregistrer localement l’unité :', e); }
}
function loadUnitsLocal() {
  try { return JSON.parse(localStorage.getItem('units') || '[]'); }
  catch(e) { return []; }
}

function ensureUnitMap() {
  // 1) Si déjà créée : juste resize et retour
  if (unitMap) {
    setTimeout(() => unitMap.invalidateSize(), 0);
    return unitMap;
  }

  // 2) Créer la carte UNE SEULE FOIS
  unitMap = L.map('unit-map', { zoomControl: true, attributionControl: true })
    .setView(montreuilView, montreuilZoom);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors, © CartoDB'
  }).addTo(unitMap);

  // Groupes (toujours créés ici)
  unitContextGroup = L.layerGroup().addTo(unitMap);
  unitLayerGroup   = L.layerGroup().addTo(unitMap);
  unitBuildingsLayer = L.layerGroup().addTo(unitMap);


  // Contour non interactif
  fetch('data/contour.geojson')
    .then(r => r.json())
    .then(contour => {
      const contourLayer = L.geoJSON(contour, {
        style: { color: '#919090', weight: 2, opacity: 0.8, fillOpacity: 0 },
        interactive: false
      }).addTo(unitContextGroup);
      contourLayer.bringToBack();
    });


  // Bâtiments (contexte visuel)
  unitBuildingsLayer.clearLayers();
  const bStyle = {
  stroke: false,        
  fill: true,
  fillColor: '#b5b5b5', 
  fillOpacity: 0.20    
};

  const buildingsVisible = [
    ...(batimentsMontreuilGeojson || []),
    ...(batimentsToulouseGeojson  || [])
  ].filter(f => isFeatureInActiveZones(f));

  if (buildingsVisible.length) {
    L.geoJSON(
      { type:'FeatureCollection', features: buildingsVisible },
      { style: () => bStyle, interactive:false }
    ).addTo(unitBuildingsLayer);
  }


  return unitMap;
}



function renderAllUnits() {
  const mapU = ensureUnitMap();
  unitLayerGroup.clearLayers();
  const whiteStyle = { color:'#fff', weight:2, opacity:1, fillColor:'#fff', fillOpacity:0.25 };
  const units = loadUnitsLocal();
  let unionBounds = null;


  units.forEach(u => {
    const gj = L.geoJSON({ type:'Feature', geometry:u.geometry, properties:u.props }, {
      pointToLayer: (_f, latlng) => L.circleMarker(latlng, { ...whiteStyle, radius: 6 }),
      style: () => whiteStyle
    }).addTo(unitLayerGroup);

    // >>> clic fiable sur chaque géométrie de l'unité
    gj.eachLayer(layer => {
  layer.on('click', () => {
    openUnitModal(u);   // ✨ nouvelle modale au lieu du panneau
  });
});


    if (gj.getBounds) {
      const b = gj.getBounds();
      unionBounds = unionBounds ? unionBounds.extend(b) : b;
    }
  });

  if (unionBounds && unionBounds.isValid && unionBounds.isValid()) mapU.fitBounds(unionBounds.pad(0.3));
}


function zoomToUnit(unit) {
  const mapU = ensureUnitMap();
  try {
    const tmp = L.geoJSON({ type:'Feature', geometry:unit.geometry });
    const b = tmp.getBounds?.();
    if (b && b.isValid && b.isValid()) { mapU.fitBounds(b.pad(0.3)); return; }
  } catch(e) {}
  const center = getFeatureCenter({ geometry: unit.geometry }); if (center) mapU.setView(center, 17);
}
function showUnitOnMap(unit) {
  const mapU = ensureUnitMap();
  const whiteStyle = { color:'#fff', weight:2, opacity:1, fillColor:'#fff', fillOpacity:0.25 };
  const layer = L.geoJSON({ type:'Feature', geometry:unit.geometry, properties:unit.props }, {
    pointToLayer: (_f, latlng) => L.circleMarker(latlng, { ...whiteStyle, radius: 6 }),
    style: () => whiteStyle
  }).addTo(unitLayerGroup);
  try {
    const b = layer.getBounds?.();
    if (b && b.isValid && b.isValid()) mapU.fitBounds(b.pad(0.3));
    else { const center = getFeatureCenter({ geometry: unit.geometry }); if (center) mapU.setView(center, 17); }
  } catch(e) { console.warn('Fit bounds unité :', e); }
}


/* ==================================================
   10/MODALES 3D ET STOCKAGE LOCAL
================================================== */



function openUnitModal(unit) {
  unitModalState.unit = unit;

  const modal   = document.getElementById('unit-modal');
  const titleEl = document.getElementById('unit-title');
  const btnV1   = document.getElementById('unit-btn-v1');
  const btnV2   = document.getElementById('unit-btn-v2');
  const btnCmp  = document.getElementById('unit-btn-compare');
  const btnX    = document.getElementById('unit-close');

  // titre = ID de l'unité
  titleEl.textContent = unit.props?.name || unit.id;

  // fragment source de l'unité (là où vit la V1)
  const fragId = unit.sourceFragmentId || null;
  const hasV1  = fragId ? hasFragment3D(fragId) : false;

  // --- Bouton V1 : soit "V1" (affiche), soit "Importer V1" (ouvre le file picker)
  if (hasV1) {
    btnV1.textContent = 'V1';
    btnV1.onclick = async () => {
      disposeUnitCompare();
      showUnitSingle();
      await renderUnitV1Into(document.getElementById('unit-single-host'));
    };
  } else {
    btnV1.textContent = 'Importer V1';
    btnV1.onclick = () => {
      promptImportV1ForSourceFragment(fragId, async () => {
        // une fois importée : on passe le bouton en "V1" et on affiche
        btnV1.textContent = 'V1';
        disposeUnitCompare();
        showUnitSingle();
        await renderUnitV1Into(document.getElementById('unit-single-host'));
      });
    };
  }

  // --- Bouton V2 : inchangé (import si pas encore là)
  btnV2.textContent = hasUnit3D(unit.id) ? 'V2' : 'Importer V2';
  btnV2.onclick = async () => {
    if (!hasUnit3D(unit.id)) {
      promptImport3DForUnit(unit.id, async () => {
        btnV2.textContent = 'V2';
        disposeUnitCompare();
        showUnitSingle();
        await renderUnitV2Into(document.getElementById('unit-single-host'));
      });
      return;
    }
    disposeUnitCompare();
    showUnitSingle();
    await renderUnitV2Into(document.getElementById('unit-single-host'));
  };

  // --- Bouton Comparer : inchangé (demande une V2, la V1 est lue sur le fragment)
  btnCmp.onclick = async () => {
    if (!hasUnit3D(unit.id)) {
      promptImport3DForUnit(unit.id, async () => {
        btnV2.textContent = 'V2';
        await doUnitCompare();
      });
    } else {
      await doUnitCompare();
    }
  };

  // fermeture
  document.getElementById('unit-backdrop').onclick = closeUnitModal;
  btnX.onclick = closeUnitModal;

  // on écoute les MAJ des métadonnées du fragment (labels 3D)
  function onMetaUpdated(e) {
    if (e.detail?.fragmentId !== fragId) return;
    const meta = e.detail.meta || { usages:[], discours:[] };
    unitModalState.singleViewer?.setLabelsFromMeta?.(meta);
    unitModalState.v1Viewer?.setLabelsFromMeta?.(meta);
    unitModalState.v2Viewer?.setLabelsFromMeta?.(meta);
  }
  window.addEventListener('fragmeta:updated', onMetaUpdated);
  modal.__cleanupMetaListener = onMetaUpdated;

  // afficher la modale
  modal.style.display = 'block';

  // Démarrage :
  // - si V1 existe déjà → on l’affiche
  // - sinon → on reste en vue simple, en attendant que l’utilisateur clique "Importer V1"
  showUnitSingle();
  if (hasV1) btnV1.click();
}


function closeUnitModal() {
  const modal = document.getElementById('unit-modal');
  modal.style.display = 'none';

  disposeUnitSingle();
  disposeUnitCompare();

  // nettoie l'écouteur meta
  if (modal.__cleanupMetaListener) {
    window.removeEventListener('fragmeta:updated', modal.__cleanupMetaListener);
    modal.__cleanupMetaListener = null;
  }

  unitModalState.unit = null;
}

function showUnitSingle() {
  document.getElementById('unit-single-host').style.display   = 'block';
  document.getElementById('unit-compare-host').style.display  = 'none';
}

function showUnitCompare() {
  document.getElementById('unit-single-host').style.display   = 'none';
  document.getElementById('unit-compare-host').style.display  = 'flex';
}

function disposeUnitSingle() {
  if (unitModalState.singleViewer) {
    unitModalState.singleViewer.dispose?.();
    unitModalState.singleViewer = null;
  }
}

function disposeUnitCompare() {
  if (unitModalState.v1Viewer) { unitModalState.v1Viewer.dispose?.(); unitModalState.v1Viewer = null; }
  if (unitModalState.v2Viewer) { unitModalState.v2Viewer.dispose?.(); unitModalState.v2Viewer = null; }
}

/* Renderers (réutilisent la logique existante) */
async function renderUnitV1Into(container) {
  if (!window.__ThreeFactory__) { console.error('Viewer 3D non chargé.'); return null; }
  container.innerHTML = ''; 
  const { unit } = unitModalState;
  const fragId = unit.sourceFragmentId || null;

  const viewer = window.__ThreeFactory__.createThreeViewer(container);
  const rec = fragId ? loadFragment3D(fragId) : null;
  if (rec?.dataUrl) {
    const blob = dataURLtoBlob(rec.dataUrl);
    await viewer.showBlob(blob);
  }
  const meta = fragId ? loadFragmentMeta(fragId) : { usages:[], discours:[] };
  viewer.setLabelsFromMeta?.(meta);

  unitModalState.singleViewer = viewer;
  return viewer;
}

async function renderUnitV2Into(container) {
  if (!window.__ThreeFactory__) { console.error('Viewer 3D non chargé.'); return null; }
  container.innerHTML = '';   
  const { unit } = unitModalState;

  const viewer = window.__ThreeFactory__.createThreeViewer(container);
  const rec = loadUnit3D(unit.id);
  if (rec?.dataUrl) {
    const blob = dataURLtoBlob(rec.dataUrl);
    await viewer.showBlob(blob);
  }
  const meta = unit.sourceFragmentId ? loadFragmentMeta(unit.sourceFragmentId) : { usages:[], discours:[] };
  viewer.setLabelsFromMeta?.(meta);

  unitModalState.singleViewer = viewer;
  return viewer;
}

async function doUnitCompare() {
  disposeUnitSingle();
  showUnitCompare();

  const v1 = await (async () => {
    const c = document.getElementById('unit-v1-host');
    if (!window.__ThreeFactory__) return null;
    const v = window.__ThreeFactory__.createThreeViewer(c);
    const fragId = unitModalState.unit.sourceFragmentId || null;
    const rec = fragId ? loadFragment3D(fragId) : null;
    if (rec?.dataUrl) await v.showBlob(dataURLtoBlob(rec.dataUrl));
    const meta = fragId ? loadFragmentMeta(fragId) : { usages:[], discours:[] };
    v.setLabelsFromMeta?.(meta);
    return v;
  })();

  const v2 = await (async () => {
    const c = document.getElementById('unit-v2-host');
    if (!window.__ThreeFactory__) return null;
    const v = window.__ThreeFactory__.createThreeViewer(c);
    const rec = loadUnit3D(unitModalState.unit.id);
    if (rec?.dataUrl) await v.showBlob(dataURLtoBlob(rec.dataUrl));
    const meta = unitModalState.unit.sourceFragmentId ? loadFragmentMeta(unitModalState.unit.sourceFragmentId) : { usages:[], discours:[] };
    v.setLabelsFromMeta?.(meta);
    return v;
  })();

  unitModalState.v1Viewer = v1;
  unitModalState.v2Viewer = v2;
}


/*---------------------------------------
STOCKAGE LOCAL 3D (helpers)
  (appelé par la modale 3D)
---------------------------------------*/
function saveFragment3D(fragmentId, fileName, mime, dataUrl) {
  localStorage.setItem(`frag3d:${fragmentId}`, JSON.stringify({ fileName, mime, dataUrl, savedAt: Date.now() }));
}
function loadFragment3D(fragmentId) {
  try { return JSON.parse(localStorage.getItem(`frag3d:${fragmentId}`) || 'null'); }
  catch(e){ return null; }
}
function hasFragment3D(fragmentId) { return !!localStorage.getItem(`frag3d:${fragmentId}`); }

/*==================================================
=       STOCKAGE LOCAL 3D — V2 (par Unité)         =
==================================================*/
function saveUnit3D(unitId, fileName, mime, dataUrl) {
  localStorage.setItem(`unit3dV2:${unitId}`, JSON.stringify({
    fileName, mime, dataUrl, savedAt: Date.now()
  }));
}
function loadUnit3D(unitId) {
  try { return JSON.parse(localStorage.getItem(`unit3dV2:${unitId}`) || 'null'); }
  catch(e){ return null; }
}
function hasUnit3D(unitId) { return !!localStorage.getItem(`unit3dV2:${unitId}`); }

function promptImport3DForUnit(unitId, onLoaded) {
  const input = document.getElementById('three-file-input');
  input.value = '';
  input.onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
    });
    saveUnit3D(unitId, file.name, file.type || 'model/gltf-binary', dataUrl);
    if (typeof onLoaded === 'function') onLoaded(dataUrl);
  };
  input.click();
}

/* ==================================================
   11/ PATTERNS SAUVEGARDES 
================================================== */



/*==================================================
=               GESTION DES VUES (UI)              =
==================================================*/

function updateInterfaceElements(viewId) {
  const legendBtn   = document.getElementById('toggle-legend-btn');
  const locationBtn = document.getElementById('toggle-location-btn');


const diffToggleBtn = document.getElementById('toggle-diffractions-btn');
if (diffToggleBtn) diffToggleBtn.style.display = (viewId === 'proxemic') ? 'block' : 'none';


  //  1) Affichage du contrôle bâtiments UNIQUEMENT sur Fragments (carte)
  const buildingsBox = document.getElementById('buildings-style-box');
  if (buildingsBox) {
    buildingsBox.style.display = (viewId === 'map') ? 'block' : 'none';
  }

  // ✅ bouton "Critères actifs" visible sur : Carte (patterns-map), Proxémie, Galerie
const wantsLegend =
  viewId === 'fragment-proxemic' ||
  viewId === 'proxemic' ||
  viewId === 'gallery'  ||
  viewId === 'patterns-map';

  legendBtn.style.display   = wantsLegend ? 'block' : 'none';
  locationBtn.style.display = (viewId === 'map' || viewId === 'patterns-map' || viewId === 'unit') ? 'block' : 'none';


  // Slider agencements visible UNIQUEMENT sur la carte patterns-map
const agCtrls = document.getElementById('agencement-controls');
if (agCtrls) {
  agCtrls.style.display = (viewId === 'patterns-map') ? 'block' : 'none';
}

const fragmentTimeBox = document.getElementById('fragment-time-controls');
const fragmentTimeLegend = document.getElementById('fragment-time-legend');

const showFragmentTimeControls =
  viewId === 'map' || viewId === 'fragment-proxemic';

if (fragmentTimeBox) {
  fragmentTimeBox.style.display = showFragmentTimeControls ? 'flex' : 'none';
}

if (fragmentTimeLegend) {
  fragmentTimeLegend.style.display =
    (showFragmentTimeControls && currentFragmentTimeMode === 'trajectories') ? 'block' : 'none';
}

const patternGalleryTimeBox = document.getElementById('pattern-gallery-time-controls');
if (patternGalleryTimeBox) {
  patternGalleryTimeBox.style.display = (viewId === 'gallery') ? 'flex' : 'none';
}

}




(function initBuildingsStyleRadiosOnce(){
  const radios = document.querySelectorAll('input[name="buildings-style"]');
  if (!radios.length) return;

  radios.forEach(r => {
    r.addEventListener('change', () => {
      BUILDINGS_STYLE_MODE = r.value;
      restyleBuildingsOnFragmentsMap();
    });
  });
})();




const topTabs = document.querySelectorAll('.top-tab');
const subnav = document.getElementById('subnav-patterns');
const subnavUnit = document.getElementById('subnav-unit');
const subnavFragments = document.getElementById('subnav-fragments');
const subTabs = document.querySelectorAll('.sub-tab');
const fragmentSubTabs = document.querySelectorAll('.sub-tab-fragment');

const VIEWS = {
  fragments: {
    map: 'map',
    proxemic: 'fragment-proxemic-view'
  },
  unit: 'unit-view',
  sub: {
    'patterns-map': 'patterns-map',
    'proxemic': 'proxemic-view',
    'gallery': 'gallery-view',
  }
};

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => {
    if (!v) return;
    v.style.display = 'none';
    v.classList.remove('active');
  });

  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
  }

  if (viewId === 'map' && map?.invalidateSize) {
    setTimeout(() => map.invalidateSize(), 0);
  }

  if (viewId === 'patterns-map' && patternMap?.invalidateSize) {
    setTimeout(() => patternMap.invalidateSize(), 0);
  }

  if (viewId === 'unit-view' && unitMap?.invalidateSize) {
    setTimeout(() => unitMap.invalidateSize(), 0);
  }
}


function setFragmentSubTab(name) {
  currentFragmentSub = name;

  fragmentSubTabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fragmentSub === name);
  });

  if (name === 'map') {
    currentView = 'map';
    showView(VIEWS.fragments.map);
  } else if (name === 'proxemic') {
    currentView = 'fragment-proxemic';
    showView(VIEWS.fragments.proxemic);
    showFragmentProxemicView();
  }

  updateInterfaceElements(currentView);
}


function setTopTab(name) {
  topTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.top === name));

  if (subnavFragments) {
    subnavFragments.classList.toggle('subnav--inactive', name !== 'fragments');
  }

  if (name === 'fragments') {
    subnav.classList.add('subnav--inactive');
    if (subnavUnit) subnavUnit.classList.add('subnav--inactive');

    subTabs.forEach(btn => btn.classList.remove('active'));

    setFragmentSubTab(currentFragmentSub || 'map');
  }

  else if (name === 'patterns') {
    subnav.classList.remove('subnav--inactive');
    if (subnavUnit) subnavUnit.classList.add('subnav--inactive');
    if (subnavFragments) subnavFragments.classList.add('subnav--inactive');

    const currentActiveSub =
      document.querySelector('.sub-tab.active')?.dataset.sub || 'proxemic';

    setSubTab(currentActiveSub);
  }

  else if (name === 'unit') {
    subnav.classList.add('subnav--inactive');
    if (subnavFragments) subnavFragments.classList.add('subnav--inactive');
    if (subnavUnit) subnavUnit.classList.remove('subnav--inactive');

    subTabs.forEach(btn => btn.classList.remove('active'));

    currentView = 'unit';
    showView(VIEWS.unit);
    ensureUnitMap();

    if (!unitContext) renderAllUnits();

    setUnitSubTab(currentUnitSub);
    updateInterfaceElements(currentView);
  }

  if (unitCreation.active && name !== 'patterns') stopUnitCreation();
}


function setSubTab(subName) {
  if (unitCreation.active) {
  const ok =
    (unitCreation.mode === 'map' && subName === 'patterns-map') ||
    (unitCreation.mode === 'proxemic' && subName === 'proxemic');

  if (!ok) stopUnitCreation();
}

  if (subName === 'proxemic') currentView = 'proxemic';
  else if (subName === 'gallery') currentView = 'gallery';
  else if (subName === 'patterns-map') currentView = 'patterns-map';

  subTabs.forEach(btn => btn.classList.toggle('active', btn.dataset.sub === subName));
  const viewId = VIEWS.sub[subName]; showView(viewId);

  if (subName === 'patterns-map') {
    initPatternMapOnce();
    setTimeout(() => patternMap.invalidateSize(), 0);
    renderPatternBaseGrey();
    refreshPatternsMap();
  }
  if (subName === 'proxemic') showProxemicView();
  else if (subName === 'gallery') showGalleryView();

  updateInterfaceElements(currentView);
}

function setUnitSubTab(name) {
  currentUnitSub = name;

  const subBtns = document.querySelectorAll('.sub-tab-unit');
  subBtns.forEach(b => b.classList.toggle('active', b.dataset.unitSub === name));

  const elMap = document.getElementById('unit-map');
  const elProx = document.getElementById('unit-proxemic');

  if (!elMap || !elProx) return;

  elMap.style.display = (name === 'map') ? 'block' : 'none';
  elProx.style.display = (name === 'proxemic') ? 'block' : 'none';

  if (name === 'map') {
    ensureUnitMap();
    setTimeout(() => unitMap?.invalidateSize?.(), 0);
    // si on a un contexte, on le (re)rend
    if (unitContext) renderUnitPatternContextOnUnitMap(unitContext.patternKey, unitContext.sourceFragmentId);
  } else {
    if (unitContext) renderUnitProxemicPattern(unitContext.patternKey, unitContext.sourceFragmentId);
  }
}

// listeners (à faire une fois)
(function initUnitSubnavOnce(){
  const subnavUnit = document.getElementById('subnav-unit');
  if (!subnavUnit) return;

  subnavUnit.querySelectorAll('.sub-tab-unit').forEach(btn => {
    btn.addEventListener('click', () => setUnitSubTab(btn.dataset.unitSub));
  });
})();



// Listeners onglets
topTabs.forEach(btn => btn.addEventListener('click', () => setTopTab(btn.dataset.top)));
subTabs.forEach(btn => btn.addEventListener('click', () => setSubTab(btn.dataset.sub)));
fragmentSubTabs.forEach(btn => {
  btn.addEventListener('click', () => setFragmentSubTab(btn.dataset.fragmentSub));
});

// État initial
setTopTab('fragments');
setFragmentSubTab('map');
restyleBuildingsOnFragmentsMap();


/*==================================================
=                 DOM                 =
==================================================*/
document.addEventListener('DOMContentLoaded', () => {
  const infoBtn = document.getElementById('info-btn');
  const aboutBox = document.getElementById('about');

  function toggleAbout() {
    const isOpen = aboutBox.style.display === 'block';
    aboutBox.style.display = isOpen ? 'none' : 'block';
    if (infoBtn) {
      infoBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    }
  }

  if (infoBtn) {
    infoBtn.addEventListener('click', toggleAbout);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && aboutBox.style.display === 'block') {
      toggleAbout();
    }
  });

  document.querySelectorAll('.filter-zone').forEach(cb => {
    cb.checked = true;
  });

  document.querySelectorAll('.crit-key').forEach(cb => {
    cb.checked = true;
  });

  ACTIVE_CRITERIA_KEYS = new Set(ALL_CRITERIA_KEYS);
  applyFilters();
});


/***************************************************
=          SLIDER SEUIL DE SIMILARITÉ (FUZZY)      =
***************************************************/

function debounce(fn, delay = 160) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

const sliderEl = document.getElementById('similarity-slider');
const sliderValueEl = document.getElementById('slider-value');

if (sliderEl && sliderValueEl) {
  // Valeur initiale (75 → 0.75 par défaut)
  const initial = parseInt(sliderEl.value, 10) / 100;
  AG_SIM_THRESHOLD = initial;
sliderValueEl.textContent = initial.toFixed(2);

  sliderEl.addEventListener('input', debounce(e => {
  const v = parseInt(e.target.value, 10);
  AG_SIM_THRESHOLD = v / 100;
  sliderValueEl.textContent = AG_SIM_THRESHOLD.toFixed(2);

  // Recalcule sur zones actives (fragments + bâtiments)
const { visibleFragments, visibleBuildings } = getVisibleSpatialFeaturesForPatterns();
recomputeAgencementPatterns({ fragments: visibleFragments, buildings: visibleBuildings });

  if (currentView === 'patterns-map') {
    renderPatternBaseGrey();
    refreshPatternsMap();
  }
}, 160));
}

/***************************************************
=          SLIDER PERIMETRE     =
***************************************************/


const perimeterEl = document.getElementById('perimeter-slider');
const perimeterValueEl = document.getElementById('perimeter-value');

if (perimeterEl && perimeterValueEl) {
  // init depuis l’attribut value HTML
  PERIMETER_DIAMETER_M = parseInt(perimeterEl.value, 10) || PERIMETER_DIAMETER_M;
  perimeterValueEl.textContent = String(PERIMETER_DIAMETER_M);

  perimeterEl.addEventListener('input', debounce(e => {
    const v = parseInt(e.target.value, 10);
    if (!Number.isFinite(v)) return;

    PERIMETER_DIAMETER_M = v;
    perimeterValueEl.textContent = String(PERIMETER_DIAMETER_M);

    // Recalcule sur zones actives (fragments + bâtiments)
const { visibleFragments, visibleBuildings } = getVisibleSpatialFeaturesForPatterns();
recomputeAgencementPatterns({ fragments: visibleFragments, buildings: visibleBuildings });

    if (currentView === 'patterns-map') {
      renderPatternBaseGrey();
      refreshPatternsMap();
    }
  }, 160));
}

function refreshProxemicPreserveTransform() {
  if (currentView !== "proxemic") return;

  const svg = d3.select("#proxemic-view svg");
  const world = svg.empty() ? null : svg.select("g");
  const oldTransform = world ? world.attr("transform") : null;

  showProxemicView();

  if (oldTransform) {
    const newSvg = d3.select("#proxemic-view svg");
    const newWorld = newSvg.select("g");
    if (!newWorld.empty()) newWorld.attr("transform", oldTransform);
  }
}

const diffToggleBtn = document.getElementById("toggle-diffractions-btn");



function syncDiffToggleUI() {
  if (!diffToggleBtn) return;
  diffToggleBtn.textContent = SHOW_DIFFRACTIONS ? "Masquer les diffractions" : "Afficher les diffractions";
}

if (diffToggleBtn) {
  diffToggleBtn.addEventListener("click", () => {
    SHOW_DIFFRACTIONS = !SHOW_DIFFRACTIONS;
    syncDiffToggleUI();
    refreshProxemicPreserveTransform(); // tu l’as déjà
  });
}
syncDiffToggleUI();




/*==================================================
=     INSPECTEUR D’UNITÉ : V1 / V2 / COMPARER      =
==================================================*/


// Importer une V1 pour le fragment source d'une unité (depuis la modale Unité)
function promptImportV1ForSourceFragment(fragmentId, onLoaded) {
  if (!fragmentId) return;
  const input = document.getElementById('three-file-input');
  input.value = '';
  input.onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
    });
    // ⬇️ on enregistre la V1 sur le fragment (même clé que la carte Fragments)
    saveFragment3D(fragmentId, file.name, file.type || 'model/gltf-binary', dataUrl);

    // Broadcast (si tu veux réagir ailleurs)
    window.dispatchEvent(new CustomEvent('frag3d:updated', { detail: { fragmentId } }));

    // callback local (pour recharger la vue dans la modale)
    if (typeof onLoaded === 'function') onLoaded(dataUrl);
  };
  input.click();
}


/*==================================================
=                 MODALE 3D (Three)                =
==================================================*/

function openThreeModalForFragment(fragmentId) {
  if (!window.__ThreeFactory__) { console.error('Viewer 3D non chargé.'); return; }
  activeFragmentId = fragmentId;
  const modal = document.getElementById('three-modal');
  const host  = document.getElementById('three-canvas-host');
  const btnClose = document.getElementById('three-close');
  const btnLoad  = document.getElementById('three-load-btn');

  modal.style.display = 'block';
  activeViewer = window.__ThreeFactory__?.createThreeViewer(host);

  const rec = loadFragment3D(fragmentId);
  if (rec?.dataUrl) {
    const blob = dataURLtoBlob(rec.dataUrl);
    activeViewer.showBlob(blob).then(() => {
      const meta = loadFragmentMeta(fragmentId);
      activeViewer.setLabelsFromMeta?.(meta);
    });
  } else {
    const meta = loadFragmentMeta(fragmentId);
    activeViewer.setLabelsFromMeta?.(meta);
  }

  document.getElementById('three-backdrop').onclick = closeThreeModal;
  btnClose.onclick = closeThreeModal;
  btnLoad.onclick  = () => promptImport3DForFragment(fragmentId, true);

  function onMetaUpdated(e){
    if (e.detail?.fragmentId === activeFragmentId && activeViewer) {
      activeViewer.setLabelsFromMeta?.(e.detail.meta);
    }
  }
  window.addEventListener('fragmeta:updated', onMetaUpdated);
  function escCloseThreeOnce(e){ if (e.key === 'Escape') closeThreeModal(); }
  document.addEventListener('keydown', escCloseThreeOnce);
  modal.__cleanupMetaListener = onMetaUpdated;
  modal.__escHandler = escCloseThreeOnce;
}

function closeThreeModal() {
  const modal = document.getElementById('three-modal');
  modal.style.display = 'none';
  if (modal.__escHandler) { document.removeEventListener('keydown', modal.__escHandler); modal.__escHandler = null; }
  if (modal.__cleanupMetaListener) { window.removeEventListener('fragmeta:updated', modal.__cleanupMetaListener); modal.__cleanupMetaListener = null; }
  if (activeViewer) { activeViewer.dispose?.(); activeViewer = null; }
  activeFragmentId = null;
}

function dataURLtoBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',');
  const mime = (meta.match(/data:(.*?);base64/)||[])[1] || 'application/octet-stream';
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i=0;i<bytes.length;i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function promptImport3DForFragment(fragmentId, reloadIfOpen=false) {
  const input = document.getElementById('three-file-input');
  input.value = '';
  input.onchange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
    });
    saveFragment3D(fragmentId, file.name, file.type || 'model/gltf-binary', dataUrl);
    if (reloadIfOpen && activeViewer) {
      await activeViewer.showBlob(dataURLtoBlob(dataUrl));
      const meta = loadFragmentMeta(fragmentId);
      activeViewer.setLabelsFromMeta?.(meta); // évite la double ligne inutile
    }
  };
  input.click();
}


/*==================================================
=           SAVED PATTERNS (localStorage)          =
==================================================*/
const SAVED_PATTERNS_KEY = 'savedPatternsV2';

function loadSavedPatterns(){
  try { return JSON.parse(localStorage.getItem(SAVED_PATTERNS_KEY) || '[]'); }
  catch(e){ return []; }
}
function saveSavedPatterns(arr){
  localStorage.setItem(SAVED_PATTERNS_KEY, JSON.stringify(arr));
}
function addSavedPattern(rec){
  const arr = loadSavedPatterns();
  arr.push(rec);
  saveSavedPatterns(arr);
}
function updateSavedPattern(uid, patch){
  const arr = loadSavedPatterns();
  const i = arr.findIndex(x => x.uid === uid);
  if (i >= 0) { arr[i] = { ...arr[i], ...patch, updatedAt: new Date().toISOString() }; saveSavedPatterns(arr); }
}
function deleteSavedPattern(uid){
  saveSavedPatterns(loadSavedPatterns().filter(x => x.uid !== uid));
}
function fmtDate(iso){
  try { const d = new Date(iso); return d.toLocaleString(); } catch(e){ return iso || ''; }
}


/*==================================================
=   ÉDITEUR DE PATTERN (création ET modification)  =
==================================================*/

/**
 * Ouvre la même fenêtre modale que la création, mais en mode:
 *  - "create"  : on enregistre un NOUVEAU snapshot (addSavedPattern)
 *  - "edit"    : on modifie un snapshot existant (updateSavedPattern)
 *
 * options = {
 *   mode: 'create' | 'edit',
 *   patternKey,                // string (clé P1, P7…)
 *   elements: string[],        // ids des membres
 *   criteria: object,          // critères du snapshot
 *   name: string,              // nom initial (pré-rempli)
 *   description: string,       // desc initiale (pré-remplie)
 *   onSave: (payload) => void, // callback appelé quand on confirme
 *   headerText?: string,       // (facultatif) titre personnalisé
 *   saveText?: string          // (facultatif) libellé bouton
 * }
 */
function openPatternEditor(options) {
  const {
    mode = 'create',
    patternKey = '',
    elements = [],
    criteria = {},          // ⇐ maintenant on passe des critères fuzzy
    name = patternKey,
    description = '',
    onSave = () => {},
    headerText,
    saveText
  } = options || {};

  const modal   = document.getElementById('save-pattern-modal');
  modal.style.zIndex = '6000';
  document.body.appendChild(modal);

  const keyEl   = document.getElementById('sp-key');
  const nameEl  = document.getElementById('sp-name');
  const descEl  = document.getElementById('sp-desc');
  const listEl  = document.getElementById('sp-fragments');
  const countEl = document.getElementById('sp-frag-count');
  const btnSave   = document.getElementById('sp-save');
  const btnCancel = document.getElementById('sp-cancel');

  // Titre & labels
  const headTitle = modal.querySelector('.modal__head strong');
  headTitle.textContent = headerText || (mode === 'edit' ? 'Modifier ce pattern' : 'Enregistrer ce pattern');
  btnSave.textContent   = saveText   || (mode === 'edit' ? 'Enregistrer les modifications' : 'Enregistrer');

  // Champs
  keyEl.value   = patternKey;
  nameEl.value  = (name || patternKey).trim();
  descEl.value  = description || '';

  // Liste des fragments membres
  countEl.textContent = String(elements.length);
  const all = [...(dataGeojson || []), ...(datamGeojson || [])];
  const byId = new Map(all.map(f => [f.properties.id, f]));
  listEl.innerHTML = '';
  elements.forEach(id => {
    const f = byId.get(id);
    const line = document.createElement('div');
    line.textContent = `${id}${f?.properties?.name ? ' — ' + f.properties.name : ''}`;
    listEl.appendChild(line);
  });

  function close() {
    modal.style.display = 'none';
    cleanup();
  }
  function cleanup() {
    document.querySelector('#save-pattern-modal .modal__backdrop').onclick = null;
    btnCancel.onclick = null;
    btnSave.onclick = null;
  }

  document.querySelector('#save-pattern-modal .modal__backdrop').onclick = close;
  btnCancel.onclick = close;

  btnSave.onclick = () => {
    const payload = {
      patternKey,
      name: (nameEl.value || patternKey).trim(),
      description: (descEl.value || '').trim(),
      elements: elements.slice(),
      criteria: criteria   // ⇐ on renvoie bien les critères fuzzy
    };
    onSave(payload);
    close();
  };

  modal.style.display = 'block';
}

/**
 * Calcule des critères "moyens" fuzzy pour une liste d'IDs de fragments.
 * Retourne un objet { cléFuzzy: valeurMoyenne } avec des nombres entre 0 et 1.
 */
function computeConsensusCriteriaForIds(ids) {
  const all = [...(dataGeojson || []), ...(datamGeojson || [])];
  const byId = new Map(all.map(f => [f.properties.id, f]));

  const consensus = {};

  ALL_FUZZY_KEYS.forEach((key, idx) => {
    let sum = 0;
    let count = 0;

    ids.forEach(id => {
      const f = byId.get(id);
      if (!f) return;
      const v = parseFuzzy(f.properties[key]);
      if (v === null || Number.isNaN(v)) return;
      sum += v;
      count++;
    });

    if (count > 0) {
      consensus[key] = sum / count;  // moyenne fuzzy
    }
  });

  return consensus;
}

function computeTextConsensusForIds(ids, key, byIdFeatureMap, { minRatio = 1 } = {}) {
  // minRatio=1 => strictement commun à TOUS les fragments du pattern
  // (tu peux repasser à 0.7 plus tard si tu veux du "quasi commun")

  const counts = new Map();

  // IMPORTANT : on se base sur le nombre total de fragments du pattern
  const total = ids.length;
  if (!total) return [];

  // Si un fragment n'a pas de valeur -> pas de consensus (car pas comparable)
  for (const id of ids) {
    const f = byIdFeatureMap.get(id);
    if (!f) return [];
    const arr = parseMultiText(f.properties?.[key]); // Array<string> | null
    if (!arr || !arr.length) return [];             // <-- clé: bloque le consensus

    const uniq = new Set(arr);
    uniq.forEach(tok => counts.set(tok, (counts.get(tok) || 0) + 1));
  }

  const threshold = Math.max(1, Math.ceil(total * minRatio));

  return Array.from(counts.entries())
    .filter(([, c]) => c >= threshold)
    .sort((a, b) => b[1] - a[1])
    .map(([tok]) => tok);
}

/* --- Création : garde le même nom de fonction publique --- */
function openSavePatternModal(patternKey, patternData) {
  const occIds = (patternData?.occurrences || []).slice();
  const occs = occIds.map(id => agencementsById.get(id)).filter(Boolean);

  const signature = computePatternSignatureFromOccurrences(occs);
  const elements = computeFragmentsUnionFromOccurrences(occIds); // flatten fragments pour l’affichage

  openPatternEditor({
    mode: 'create',
    patternKey,
    elements,                  // on garde ce champ pour la UI (liste)
    criteria: signature.numericMeans, // si tu veux continuer à afficher des “valeurs”
    name: (patternNames?.[patternKey]) || patternKey,
    description: '',
    headerText: 'Enregistrer ce pattern (agencements)',
    onSave: (payload) => {
      const rec = {
        uid: 'sp_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7),

        patternKey,
        name: payload.name,
        description: payload.description,

        // ✅ vrai contenu du pattern
        occurrences: occIds.slice(),

        // ✅ “flatten” pour confort UI (photos, liste)
        elements: elements.slice(),

        // ✅ signature stable
        signature,

        // ✅ contexte de calcul (reproductible)
        params: getCurrentPatternParams(),

        savedAt: new Date().toISOString()
      };

      addSavedPattern(rec);
      openSavedPatternPanel(rec.uid);
    }
  });
}

/* --- Édition d’un pattern SAUVEGARDÉ (par UID) --- */
function openEditSavedPatternModal(uid) {
  const items = loadSavedPatterns();
  const rec = items.find(x => x.uid === uid);
  if (!rec) return;

  openPatternEditor({
    mode: 'edit',
    patternKey: rec.patternKey,
    elements: rec.elements || [],
    criteria: rec.criteria || {},      // ⇐ on garde les critères fuzzy
    name: rec.name || rec.patternKey,
    description: rec.description || '',
    onSave: (payload) => {
      // On ne modifie ici que nom + description (les critères peuvent rester)
      updateSavedPattern(uid, {
        name: payload.name,
        description: payload.description
      });

      // rafraîchir la fiche ouverte si elle existe
      const tabId = `saved-${uid}`;
      const updated = loadSavedPatterns().find(x => x.uid === uid);
      if (Tabbed?.openTabs?.has(tabId)) {
        const panel = Tabbed.openTabs.get(tabId).panel;
        renderSavedPatternPanel(panel, updated);
        // mettre à jour le titre de l'onglet
        Tabbed.openTabs.get(tabId).btn.firstChild.nodeValue = (updated.name || updated.patternKey);
      }

      // rafraîchir la liste si la modale est ouverte
      const listModal = document.getElementById('saved-patterns-list-modal');
      if (listModal && listModal.style.display === 'block') {
        openSavedPatternsListModal();
      }
    }
  });
}



function openSavedPatternsListModal(){
  const modal = document.getElementById('saved-patterns-list-modal');
  const body  = document.getElementById('splist-body');
  const closeBtn = document.getElementById('splist-close');

  body.innerHTML = '';
  const items = loadSavedPatterns().slice().sort((a,b) => (new Date(b.savedAt)) - (new Date(a.savedAt)));

  if (!items.length){
    body.innerHTML = '<div style="color:#aaa">Aucun pattern enregistré pour le moment.</div>';
  } else {
    items.forEach(rec => {
      const card = document.createElement('div');
      card.className = 'saved-item';
      const h = document.createElement('h4');
      h.textContent = `${rec.name}  (${rec.patternKey})`;
      const meta = document.createElement('div');
      meta.className = 'meta';
      meta.textContent =
  `Enregistré: ${fmtDate(rec.savedAt)} • Occurrences: ${rec.occurrences?.length || 0} • Fragments: ${rec.elements?.length || 0}`;
      const row = document.createElement('div');
      row.className = 'row';

      const bOpen = document.createElement('button');
      bOpen.className = 'tab-btn btn-sm primary';
      bOpen.textContent = 'Consulter';
      bOpen.onclick = () => { modal.style.display = 'none'; openSavedPatternPanel(rec.uid); };

       // ⬇️ Unifie Renommer + Modifier description
      const bEdit = document.createElement('button');
      bEdit.className = 'tab-btn btn-sm';
      bEdit.textContent = 'Modifier';
      bEdit.onclick = () => openEditSavedPatternModal(rec.uid);

      const bDel = document.createElement('button');
bDel.className = 'tab-btn btn-sm danger';
bDel.textContent = 'Supprimer';
bDel.onclick = () => {
  // suppression immédiate, sans confirmation
  deleteSavedPattern(rec.uid);
  // rafraîchir la liste
  openSavedPatternsListModal();
};


      row.append(bOpen, bEdit, bDel);
      const p = document.createElement('div');
      p.style.cssText = 'margin-top:6px;color:#ccc;white-space:pre-wrap';
      p.textContent = rec.description || '—';

      card.append(h, meta, row, p);
      body.appendChild(card);
    });
  }

  function close(){ modal.style.display = 'none'; cleanup(); }
  function cleanup(){ document.querySelector('#saved-patterns-list-modal .modal__backdrop').onclick = null; closeBtn.onclick = null; }
  document.querySelector('#saved-patterns-list-modal .modal__backdrop').onclick = close;
  closeBtn.onclick = close;

  modal.style.display = 'block';
}


function openSavedPatternPanel(uid) {
  const items = loadSavedPatterns();
  const rec = items.find(x => x.uid === uid);
  if (!rec) return;

  openTab({
    id: `saved-${uid}`,
    title: rec.name || rec.patternKey,
    kind: 'saved-pattern',
    render: panel => renderSavedPatternPanel(panel, rec)
  });
}

function renderSavedPatternPanel(panel, rec) {
  panel.innerHTML = '';

  /* --------------------------------------------
     1) Titre + méta
  -------------------------------------------- */
  const h2 = document.createElement('h2');
  h2.textContent = `${rec.name || rec.patternKey} — (enregistré)`;
  panel.appendChild(h2);

  const meta = document.createElement('div');
  meta.style.cssText = 'color:#aaa;font-size:12px;margin-bottom:8px';
  meta.textContent =
  `ID: ${rec.patternKey} • Occurrences: ${rec.occurrences?.length || 0} • Fragments: ${rec.elements?.length || 0} • Sauvé: ${fmtDate(rec.savedAt)}` +
  (rec.updatedAt ? ` • Modifié: ${fmtDate(rec.updatedAt)}` : '');
  panel.appendChild(meta);

  /* --------------------------------------------
     2) Description
  -------------------------------------------- */
  const desc = document.createElement('p');
  desc.textContent = rec.description || '—';
  panel.appendChild(desc);

  /* --------------------------------------------
     3) CRITÈRES COMMUNS (moyenne fuzzy)
        => comme dans renderPatternPanel
  -------------------------------------------- */
  const ids = rec.elements || []; // garde pour la liste des fragments plus bas
const signature = rec.signature || { numericMeans: rec.criteria || {}, textTokens: {} };
const consensus = signature.numericMeans || {};

  const critBlock = document.createElement('div');
  critBlock.className = 'pattern-crit-block';

  const hCrit = document.createElement('h3');
  hCrit.textContent = 'Critères communs';
  critBlock.appendChild(hCrit);

  const entries = Object.entries(consensus)
    .filter(([k, v]) => v !== null && v >= 0.2)
    .sort((a, b) => b[1] - a[1]);

  if (!entries.length) {
    const none = document.createElement('p');
    none.textContent = 'Aucun critère commun significatif.';
    none.style.color = '#aaa';
    critBlock.appendChild(none);
  } else {
    entries.forEach(([k, v]) => {
      const row = document.createElement('div');
      row.className = 'crit-row';

      const label = document.createElement('span');
      label.className = 'crit-label';
      label.textContent = k.replace(/_/g, ' ');

      const val = document.createElement('span');
      val.className = 'crit-value';
      val.textContent = v.toFixed(2);

      row.append(label, val);
      critBlock.appendChild(row);
    });
  }

  if (rec.params) {
  const p = document.createElement('div');
  p.style.cssText = 'color:#aaa;font-size:12px;margin:8px 0';
  p.textContent = `Paramètres: diamètre ${rec.params.perimeterDiameterM}m • seuil ${Number(rec.params.agSimilarityThreshold).toFixed(2)} • zones ${((rec.params.zones||[]).join(', ') || '—')}`;
  panel.appendChild(p);
}

  panel.appendChild(critBlock);


  const textSignature = signature.textTokens || {};

const textBlock = document.createElement('div');
textBlock.className = 'pattern-crit-block';

const hText = document.createElement('h3');
hText.textContent = 'Critères textuels';
textBlock.appendChild(hText);

let hasAnyText = false;

Object.entries(textSignature).forEach(([k, arr]) => {
  if (!arr || !arr.length) return;
  hasAnyText = true;

  const row = document.createElement('div');
  row.className = 'crit-row';

  const label = document.createElement('span');
  label.className = 'crit-label';
  label.textContent = prettyKey(k);

  const val = document.createElement('span');
  val.className = 'crit-value';
  val.textContent = arr.slice(0, 10).join(', ') + (arr.length > 10 ? '…' : '');

  row.append(label, val);
  textBlock.appendChild(row);
});

if (!hasAnyText) {
  const none = document.createElement('p');
  none.textContent = 'Aucun critère textuel commun.';
  none.style.color = '#aaa';
  textBlock.appendChild(none);
}

panel.appendChild(textBlock);

  /* --------------------------------------------
     4) Liste des fragments membres
        => simple, même style que pattern normal
  -------------------------------------------- */
  const list = document.createElement('div');
  list.className = 'pattern-members';

  const all = [...(dataGeojson || []), ...(datamGeojson || [])];
  const byId = new Map(all.map(f => [f.properties.id, f]));

  ids.forEach(id => {
    const f = byId.get(id);
    if (!f) return;

    const row = document.createElement('div');
    row.className = 'member-row';

    // miniature
    const thumb = document.createElement('div');
    thumb.className = 'member-thumb';
    const p = normalizePhotos(f.properties.photos)[0];
    if (p) thumb.style.backgroundImage = `url("${p}")`;

    // nom
    const right = document.createElement('div');
    right.className = 'member-right';

    const title = document.createElement('div');
    title.className = 'member-title';
    title.textContent = f.properties.name || id;

    right.append(title);
    row.append(thumb, right);

    row.addEventListener('click', () => showDetails(f.properties));
    list.appendChild(row);
  });

  panel.appendChild(list);

  /* --------------------------------------------
     5) Actions
  -------------------------------------------- */
  const actions = document.createElement('div');
  actions.className = 'btn-row';

  const bEdit = document.createElement('button');
  bEdit.className = 'tab-btn btn-sm';
  bEdit.textContent = 'Modifier';
  bEdit.onclick = () => openEditSavedPatternModal(rec.uid);

  const bDel = document.createElement('button');
  bDel.className = 'tab-btn btn-sm danger';
  bDel.textContent = 'Supprimer';
  bDel.onclick = () => {
    deleteSavedPattern(rec.uid);
    const idTab = `saved-${rec.uid}`;
    if (Tabbed?.openTabs?.has(idTab)) closeTab(idTab);
  };

  actions.append(bEdit, bDel);
  panel.appendChild(actions);
}




/* ==================================================
   BINDINGS UI FINAUX 
================================================== */

function updateFragmentTimeButtonsUI() {
  document.querySelectorAll('.fragment-time-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.fragmentTime === currentFragmentTimeMode);
  });

  const legend = document.getElementById('fragment-time-legend');
  if (legend) {
    const showLegend =
      currentFragmentTimeMode === 'trajectories' &&
      (currentView === 'map' || currentView === 'fragment-proxemic');

    legend.style.display = showLegend ? 'block' : 'none';
  }
}

function setFragmentTimeMode(mode) {
  currentFragmentTimeMode = mode;
  updateFragmentTimeButtonsUI();

  if (currentView === 'map') {
    renderFragmentsMapByTimeMode();
    restyleBuildingsOnFragmentsMap();
  } else if (currentView === 'fragment-proxemic') {
    showFragmentProxemicView();
  }
}


document.querySelectorAll('.fragment-time-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setFragmentTimeMode(btn.dataset.fragmentTime);
  });
});



document.getElementById('toggle-legend-btn').addEventListener('click', () => {
  const legend = document.getElementById('criteria-legend');
  legend.style.display = (legend.style.display === 'none' || legend.style.display === '') ? 'block' : 'none';
});


document.querySelectorAll('.crit-key').forEach(cb => {
  cb.addEventListener('change', () => {
    const key = cb.dataset.key;
    if (!key) return;

    if (cb.checked) ACTIVE_CRITERIA_KEYS.add(key);
    else ACTIVE_CRITERIA_KEYS.delete(key);

    applyFilters();
  });
});

document.querySelectorAll('.filter-zone').forEach(cb => {
  cb.addEventListener('change', () => {
    applyFilters();
  });
});


const savedListBtn = document.getElementById('saved-patterns-list-btn');
if (savedListBtn) savedListBtn.addEventListener('click', () => openSavedPatternsListModal());


function updatePatternGalleryTimeButtonsUI() {
  document.querySelectorAll('.pattern-gallery-time-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.patternGalleryTime === currentPatternGalleryTimeMode);
  });
}

function setPatternGalleryTimeMode(mode) {
  currentPatternGalleryTimeMode = mode;
  updatePatternGalleryTimeButtonsUI();

  if (currentView === 'gallery') {
    showGalleryView();
  }
}

document.querySelectorAll('.pattern-gallery-time-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setPatternGalleryTimeMode(btn.dataset.patternGalleryTime);
  });
});

updatePatternGalleryTimeButtonsUI();
