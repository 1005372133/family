import { loadConfig } from './config.js';
import { initOcr } from './ocr.js';
import { initRender, renderHeader, renderAll } from './render.js';
import { initEvents, bindAll } from './events.js';
import { todayStr } from './utils.js';

const state = {
  timeRange: 'week',
  customFrom: null,
  customTo: null,
  activeCatFilter: 'all',
  editingCatId: null,
  editingMemoId: null,
  selectedEmoji: '🛒',
  selectedColor: '#81b29a',
  pendingAttachments: []
};

let config = null;

async function init() {
  try {
    config = await loadConfig();
    state.timeRange = config.defaults.timeRange;

    initRender(config, state);
    initEvents(config, state);

    renderHeader();
    await renderAll();
    bindAll();
  } catch (e) {
    console.error('Init failed:', e);
  }

  const dateInput = document.getElementById('memoDate');
  if (dateInput && !dateInput.value) dateInput.value = todayStr();

  if (config) {
    try { await initOcr(config.features.ocrLanguages); } catch (e) { console.error('OCR init failed:', e); }
  }
}

init();
