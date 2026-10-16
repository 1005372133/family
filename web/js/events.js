import * as db from './db.js';
import * as render from './render.js';
import { ocrImage, ocrPdf, readExifOrientation, correctImageOrientation, createThumbnail } from './ocr.js';
import { readFileAsDataUrl, readFileAsArrayBuffer, todayStr } from './utils.js';

let config = null;
let state = null;

export function initEvents(cfg, st) {
  config = cfg;
  state = st;
}

export function bindAll() {
  bindTimeFilters();
  bindCustomDate();
  bindCategoryPills();
  bindCategoryManager();
  bindFileDrop();
  bindMemoForm();
  bindMemoList();
  bindLightbox();
}

function bindTimeFilters() {
  document.getElementById('timeFilters').addEventListener('click', async (e) => {
    const btn = e.target.closest('.tf-btn');
    if (!btn) return;
    state.timeRange = btn.dataset.range;
    render.renderTimeFilters();
    await render.renderStats();
    await render.renderMemos();
  });
}

function bindCustomDate() {
  document.getElementById('dateFrom').addEventListener('change', async (e) => {
    state.customFrom = e.target.value;
    if (state.timeRange === 'custom') { await render.renderStats(); await render.renderMemos(); }
  });
  document.getElementById('dateTo').addEventListener('change', async (e) => {
    state.customTo = e.target.value;
    if (state.timeRange === 'custom') { await render.renderStats(); await render.renderMemos(); }
  });
}

function bindCategoryPills() {
  document.getElementById('catPills').addEventListener('click', async (e) => {
    const pill = e.target.closest('.cat-pill');
    if (!pill) return;
    state.activeCatFilter = pill.dataset.cat;
    await render.renderCategoryPills();
    await render.renderStats();
    await render.renderMemos();
  });
}

function bindCategoryManager() {
  const labels = config.ui.labels;

  document.getElementById('btnManageCats').addEventListener('click', async () => {
    state.editingCatId = null;
    document.getElementById('catFormTitle').textContent = labels.addCategory;
    document.getElementById('catName').value = '';
    state.selectedEmoji = config.ui.emojis[0];
    state.selectedColor = config.ui.colors[0];
    render.renderEmojiGrid();
    render.renderColorGrid();
    document.getElementById('btnCancelEdit').style.display = 'none';
    await render.renderCatList();
    document.getElementById('categoryModal').classList.add('open');
  });

  document.getElementById('modalClose').addEventListener('click', () => document.getElementById('categoryModal').classList.remove('open'));
  document.getElementById('categoryModal').addEventListener('click', (e) => { if (e.target === document.getElementById('categoryModal')) document.getElementById('categoryModal').classList.remove('open'); });

  document.getElementById('emojiGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.emoji-option');
    if (!btn) return;
    state.selectedEmoji = btn.dataset.emoji;
    render.renderEmojiGrid();
  });

  document.getElementById('colorGrid').addEventListener('click', (e) => {
    const btn = e.target.closest('.color-option');
    if (!btn) return;
    state.selectedColor = btn.dataset.color;
    render.renderColorGrid();
  });

  document.getElementById('btnSaveCat').addEventListener('click', async () => {
    const name = document.getElementById('catName').value.trim();
    if (!name) return;
    if (state.editingCatId) {
      await db.updateCategory(state.editingCatId, name, state.selectedEmoji, state.selectedColor);
    } else {
      const cats = await db.getCategories();
      await db.insertCategory('cat_' + Date.now(), name, state.selectedEmoji, state.selectedColor, cats.length);
    }
    state.editingCatId = null;
    document.getElementById('catFormTitle').textContent = labels.addCategory;
    document.getElementById('catName').value = '';
    document.getElementById('btnCancelEdit').style.display = 'none';
    await render.renderCatList();
    await render.renderCategoryPills();
    await render.renderCategorySelect();
    await render.renderStats();
    await render.renderMemos();
  });

  document.getElementById('btnCancelEdit').addEventListener('click', () => {
    state.editingCatId = null;
    document.getElementById('catFormTitle').textContent = labels.addCategory;
    document.getElementById('catName').value = '';
    document.getElementById('btnCancelEdit').style.display = 'none';
  });

  document.getElementById('catList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.action === 'edit-cat') {
      const cats = await db.getCategories();
      const cat = cats.find(c => c.id === id);
      if (!cat) return;
      state.editingCatId = id;
      document.getElementById('catFormTitle').textContent = labels.editCategory;
      document.getElementById('catName').value = cat.name;
      state.selectedEmoji = cat.icon;
      state.selectedColor = cat.color;
      render.renderEmojiGrid();
      render.renderColorGrid();
      document.getElementById('btnCancelEdit').style.display = 'inline-block';
    } else if (btn.dataset.action === 'delete-cat') {
      const memos = await db.getMemos();
      const hasMemos = memos.some(m => m.categoryId === id);
      const msg = hasMemos ? labels.deleteCatWithMemos : labels.deleteCatConfirm;
      if (confirm(msg)) {
        await db.deleteCategory(id);
        if (state.activeCatFilter === id) state.activeCatFilter = 'all';
        await render.renderCatList();
        await render.renderCategoryPills();
        await render.renderCategorySelect();
        await render.renderStats();
        await render.renderMemos();
      }
    }
  });
}

function bindFileDrop() {
  const fileDrop = document.getElementById('fileDrop');
  const fileInput = document.getElementById('memoFiles');

  fileDrop.addEventListener('click', () => fileInput.click());
  fileDrop.addEventListener('dragover', (e) => { e.preventDefault(); fileDrop.classList.add('dragover'); });
  fileDrop.addEventListener('dragleave', () => fileDrop.classList.remove('dragover'));
  fileDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    fileDrop.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', (e) => { handleFiles(e.target.files); e.target.value = ''; });

  document.getElementById('attachmentPreviews').addEventListener('click', (e) => {
    const btn = e.target.closest('.att-remove');
    if (!btn) return;
    state.pendingAttachments.splice(Number(btn.dataset.idx), 1);
    render.renderAttachmentPreviews();
  });
}

async function handleFiles(fileList) {
  for (const file of fileList) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') continue;

    const id = 'att_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    let dataUrl = await readFileAsDataUrl(file);

    if (file.type.startsWith('image/') && config.features.imageAutoRotate) {
      const buffer = await readFileAsArrayBuffer(file);
      const orientation = readExifOrientation(buffer);
      dataUrl = await correctImageOrientation(dataUrl, orientation);
    }

    const thumbnail = file.type.startsWith('image/')
      ? await createThumbnail(dataUrl, 150)
      : null;

    const att = { id, data: dataUrl, thumbnail, type: file.type, name: file.name, ocrText: '', ocrProcessing: true };
    state.pendingAttachments.push(att);
    render.renderAttachmentPreviews();

    if (config.features.ocr) {
      (async () => {
        let text = '';
        if (file.type.startsWith('image/')) text = await ocrImage(dataUrl);
        else if (file.type === 'application/pdf') text = await ocrPdf(dataUrl);
        const idx = state.pendingAttachments.findIndex(a => a.id === id);
        if (idx !== -1) {
          state.pendingAttachments[idx].ocrText = text;
          state.pendingAttachments[idx].ocrProcessing = false;
          render.renderAttachmentPreviews();
        }
        if (text) {
          const contentEl = document.getElementById('memoContent');
          const existing = contentEl.value.trim();
          contentEl.value = existing ? existing + '\n' + text : text;
        }
      })();
    }
  }
}

function bindMemoForm() {
  const labels = config.ui.labels;

  document.getElementById('memoForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('memoTitle').value.trim();
    if (!title) return;

    const savedAttachments = [];
    for (const att of state.pendingAttachments) {
      const dbAtt = { id: att.id, memoId: null, data: att.data, thumbnail: att.thumbnail, type: att.type, name: att.name, ocrText: att.ocrText || '' };
      savedAttachments.push(dbAtt);
    }

    const dateVal = document.getElementById('memoDate').value;
    const formData = {
      title,
      content: document.getElementById('memoContent').value.trim(),
      categoryId: document.getElementById('memoCategory').value,
      date: dateVal || todayStr(),
      amount: document.getElementById('memoAmount').value ? parseFloat(document.getElementById('memoAmount').value) : null,
      priority: document.getElementById('memoPriority').checked,
    };

    if (state.editingMemoId) {
      const memos = await db.getMemos();
      const memo = memos.find(m => m.id === state.editingMemoId);
      if (memo) {
        Object.assign(memo, formData);
        await db.updateMemo(memo);
        for (const att of savedAttachments) {
          att.memoId = state.editingMemoId;
          await db.insertAttachment(att);
        }
      }
      state.editingMemoId = null;
    } else {
      const memo = { id: Date.now(), ...formData, done: false, createdAt: new Date().toISOString() };
      await db.insertMemo(memo);
      for (const att of savedAttachments) {
        att.memoId = memo.id;
        await db.insertAttachment(att);
      }
    }

    state.pendingAttachments = [];
    render.renderAttachmentPreviews();
    await render.renderStats();
    await render.renderMemos();
    document.getElementById('memoForm').reset();
    document.getElementById('memoDate').value = todayStr();
    document.getElementById('btnAddMemo').textContent = labels.addMemo;
  });
}

function bindMemoList() {
  const labels = config.ui.labels;

  document.getElementById('memoList').addEventListener('click', async (e) => {
    const btn = e.target.closest('.memo-actions button');
    if (btn) {
      const id = Number(btn.dataset.id);
      if (btn.dataset.action === 'edit') {
        const memos = await db.getMemos();
        const memo = memos.find(m => m.id === id);
        if (!memo) return;
        const cats = await db.getCategories();
        state.editingMemoId = id;
        document.getElementById('memoTitle').value = memo.title;
        document.getElementById('memoCategory').value = memo.categoryId || cats[0]?.id || '';
        document.getElementById('memoContent').value = memo.content || '';
        document.getElementById('memoDate').value = memo.date || todayStr();
        document.getElementById('memoAmount').value = memo.amount || '';
        document.getElementById('memoPriority').checked = !!memo.priority;
        state.pendingAttachments = [];
        render.renderAttachmentPreviews();
        document.getElementById('btnAddMemo').textContent = labels.saveEdit;
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (btn.dataset.action === 'toggle') {
        const memos = await db.getMemos();
        const memo = memos.find(m => m.id === id);
        if (memo) { await db.toggleMemoDone(id, !memo.done); await render.renderStats(); await render.renderMemos(); }
      } else if (btn.dataset.action === 'delete') {
        if (confirm(labels.deleteMemoConfirm)) {
          await db.deleteMemo(id);
          await render.renderStats();
          await render.renderMemos();
        }
      }
      return;
    }

    const delBtn = e.target.closest('.memo-att-delete');
    if (delBtn) {
      e.stopPropagation();
      const memoId = Number(delBtn.dataset.memoId);
      const attId = delBtn.dataset.attId;
      if (confirm(labels.deleteAttConfirm)) {
        await db.deleteMemoAttachment(memoId, attId);
        await render.renderStats();
        await render.renderMemos();
      }
      return;
    }

    const thumb = e.target.closest('.memo-att-thumb');
    if (thumb && config.features.lightbox) {
      const memoId = Number(thumb.dataset.memoId);
      const attId = thumb.dataset.attId;
      const attType = thumb.dataset.type;
      const ocrText = decodeURIComponent(thumb.dataset.ocr || '');
      const attachments = await db.getAttachmentsForMemo(memoId);
      const att = attachments.find(a => a.id === attId);
      if (!att) return;

      const fullData = await db.getAttachmentData(attId);
      const lightbox = document.getElementById('lightbox');
      const content = document.getElementById('lightboxContent');

      if (attType.startsWith('image/') && fullData) {
        content.innerHTML = `<img src="${fullData}" alt="${escapeHtml(att.name)}">`;
      } else {
        content.innerHTML = `<div style="color:#fff;text-align:center;padding:40px;">${labels.noPreview}</div>`;
      }

      lightbox.dataset.ocrText = ocrText;
      lightbox.dataset.attData = fullData || '';
      lightbox.dataset.attName = att.name || 'download';
      lightbox.classList.add('open');
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function bindLightbox() {
  const labels = config.ui.labels;

  document.getElementById('lightboxClose').addEventListener('click', () => document.getElementById('lightbox').classList.remove('open'));
  document.querySelector('.lightbox-backdrop').addEventListener('click', () => document.getElementById('lightbox').classList.remove('open'));

  document.getElementById('lightboxOcr').addEventListener('click', () => {
    const text = document.getElementById('lightbox').dataset.ocrText;
    if (text) {
      document.getElementById('ocrText').textContent = text;
      document.getElementById('ocrModal').classList.add('open');
    } else {
      alert(labels.ocrEmpty);
    }
  });

  document.getElementById('lightboxDownload').addEventListener('click', () => {
    const data = document.getElementById('lightbox').dataset.attData;
    const name = document.getElementById('lightbox').dataset.attName || 'download';
    if (data) { const a = document.createElement('a'); a.href = data; a.download = name; a.click(); }
  });

  document.getElementById('ocrModalClose').addEventListener('click', () => document.getElementById('ocrModal').classList.remove('open'));
  document.getElementById('ocrModal').addEventListener('click', (e) => { if (e.target === document.getElementById('ocrModal')) document.getElementById('ocrModal').classList.remove('open'); });
}
