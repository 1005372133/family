import * as db from './db.js';
import { escapeHtml, formatRelativeDate, todayStr } from './utils.js';

let config = null;
let state = null;

export function initRender(cfg, st) {
  config = cfg;
  state = st;
}

export function renderHeader() {
  const opts = { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' };
  document.getElementById('headerDate').textContent = new Date().toLocaleDateString('zh-CN', opts);
}

export function renderSiteText() {
  const labels = config.ui.labels;
  const $ = (sel) => document.querySelector(sel);
  const $id = (id) => document.getElementById(id);

  const h1 = $('.header h1'); if (h1) h1.textContent = config.site.title;
  const sub = $('.subtitle'); if (sub) sub.textContent = config.site.subtitle;
  const fd = $('.file-drop-text'); if (fd) fd.textContent = labels.fileDropText;
  const btn = $id('btnAddMemo'); if (btn) btn.textContent = state.editingMemoId ? labels.saveEdit : labels.addMemo;
  const t = $id('memoTitle'); if (t) t.placeholder = labels.titlePlaceholder;
  const c = $id('memoContent'); if (c) c.placeholder = labels.contentPlaceholder;
  const a = $id('memoAmount'); if (a) a.placeholder = labels.amountPlaceholder;
  const pl = $('.priority-label'); if (pl) pl.textContent = labels.priorityLabel;
  const mc = $id('btnManageCats'); if (mc) mc.textContent = labels.manageCategories;
  const ep = $('.empty-state p'); if (ep) ep.textContent = labels.emptyTitle;
  const eh = $('.empty-hint'); if (eh) eh.textContent = labels.emptyHint;
  const cft = $id('catFormTitle'); if (cft) cft.textContent = labels.addCategory;
  const lcn = $id('labelCatName'); if (lcn) lcn.textContent = labels.categoryName;
  const lci = $id('labelCatIcon'); if (lci) lci.textContent = labels.categoryIcon;
  const lcc = $id('labelCatColor'); if (lcc) lcc.textContent = labels.categoryColor;
  const bsc = $id('btnSaveCat'); if (bsc) bsc.textContent = labels.save;
  const bce = $id('btnCancelEdit'); if (bce) bce.textContent = labels.cancelEdit;
  const ott = $id('ocrTitleText'); if (ott) ott.textContent = labels.ocrTitle;
  const lo = $id('lightboxOcr'); if (lo) lo.textContent = labels.viewOcr;
  const ld = $id('lightboxDownload'); if (ld) ld.textContent = labels.download;
}

export function renderTimeFilters() {
  const container = document.getElementById('timeFilters');
  const customRange = document.getElementById('customRange');
  if (!container) return;
  container.innerHTML = config.ui.timeFilters.map(f =>
    `<button class="tf-btn${state.timeRange === f.key ? ' active' : ''}" data-range="${f.key}">${f.label}</button>`
  ).join('');
  if (customRange) customRange.style.display = state.timeRange === 'custom' ? 'flex' : 'none';
}

export async function renderCategoryPills() {
  const cats = await db.getCategories();
  const pills = document.getElementById('catPills');
  if (!pills) return;
  const allActive = state.activeCatFilter === 'all';
  pills.innerHTML = `<span class="cat-pill${allActive ? ' active' : ''}" data-cat="all" style="${allActive ? 'background:var(--accent);color:#fff;border-color:transparent' : ''}">全部</span>`;
  cats.forEach(cat => {
    const active = state.activeCatFilter === cat.id;
    const pill = document.createElement('span');
    pill.className = `cat-pill${active ? ' active' : ''}`;
    pill.dataset.cat = cat.id;
    pill.textContent = `${cat.icon} ${cat.name}`;
    if (active) { pill.style.background = cat.color; pill.style.color = '#fff'; pill.style.borderColor = 'transparent'; }
    pills.appendChild(pill);
  });
}

export async function renderCategorySelect() {
  const cats = await db.getCategories();
  const sel = document.getElementById('memoCategory');
  if (!sel) return;
  sel.innerHTML = cats.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
}

function getTimeRange() {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  let start = new Date();
  start.setHours(0, 0, 0, 0);
  switch (state.timeRange) {
    case 'today': break;
    case 'week': start.setDate(start.getDate() - 7); break;
    case 'month': start.setDate(1); break;
    case '3months': start.setMonth(start.getMonth() - 3); break;
    case 'all': start = null; break;
    case 'custom':
      start = state.customFrom ? new Date(state.customFrom + 'T00:00:00') : null;
      if (state.customTo) now.setTime(new Date(state.customTo + 'T23:59:59').getTime());
      break;
  }
  return { start, end: now };
}

async function filterMemos() {
  const { start, end } = getTimeRange();
  const allMemos = await db.getMemos();
  const query = state.searchQuery.toLowerCase().trim();
  return allMemos.filter(m => {
    const d = m.date ? new Date(m.date) : new Date(m.createdAt);
    if (start && d < start) return false;
    if (end && d > end) return false;
    if (state.activeCatFilter !== 'all' && m.categoryId !== state.activeCatFilter) return false;
    if (query && !m.title.toLowerCase().includes(query)) return false;
    return true;
  });
}

export async function renderStats() {
  const filtered = await filterMemos();
  const totalAmount = filtered.reduce((s, m) => s + (m.amount || 0), 0);
  const doneCount = filtered.filter(m => m.done).length;
  const priorityCount = filtered.filter(m => m.priority && !m.done).length;
  const values = { count: filtered.length, amount: totalAmount.toFixed(2), priority: priorityCount, done: doneCount };
  const labels = config.ui.stats;
  const el = document.getElementById('statsSection');
  if (!el) return;
  el.innerHTML = labels.map(s => {
    const prefix = s.prefix || '';
    return `<div class="stat-card"><div class="stat-value">${prefix}${values[s.key]}</div><div class="stat-label">${s.label}</div></div>`;
  }).join('');
}

export async function renderMemos() {
  const filtered = await filterMemos();
  const sorted = [...filtered].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.priority !== b.priority) return a.priority ? -1 : 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const list = document.getElementById('memoList');
  const emptyState = document.getElementById('emptyState');
  if (!list) return;
  list.innerHTML = '';

  const totalPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  if (state.currentPage > totalPages) state.currentPage = totalPages;
  const start = (state.currentPage - 1) * state.pageSize;
  const pageItems = sorted.slice(start, start + state.pageSize);

  if (emptyState) emptyState.style.display = sorted.length === 0 ? 'block' : 'none';

  const cats = await db.getCategories();
  const labels = config.ui.labels;

  for (const memo of pageItems) {
    const cat = cats.find(c => c.id === memo.categoryId) || { icon: '📌', name: labels.unknownCategory, color: '#999' };
    const card = document.createElement('div');
    card.className = `memo-card${memo.priority ? ' priority' : ''}${memo.done ? ' done' : ''}`;
    if (!memo.priority) card.style.borderLeftColor = cat.color;

    const dateStr = memo.date ? formatRelativeDate(memo.date, labels) : '';
    const attachments = await db.getAttachmentsForMemo(memo.id);
    const attHtml = attachments.map(att => {
      const isImage = att.type.startsWith('image/');
      const inner = isImage ? `<img src="${att.thumbnail}" alt="">` : '📄';
      return `<div class="memo-att-wrap"><div class="memo-att-thumb" data-memo-id="${memo.id}" data-att-id="${att.id}" data-type="${att.type}" data-ocr="${encodeURIComponent(att.ocrText || '')}">${inner}</div><button class="memo-att-delete" data-memo-id="${memo.id}" data-att-id="${att.id}" title="删除附件">&times;</button></div>`;
    }).join('');

    card.innerHTML = `
      <div class="memo-header">
        <div class="memo-title-text">
          ${escapeHtml(memo.title)}
          ${memo.priority ? `<span class="priority-badge">${labels.importantBadge}</span>` : ''}
        </div>
        <div class="memo-actions">
          <button data-action="edit" data-id="${memo.id}" title="编辑">✏️</button>
          <button data-action="toggle" data-id="${memo.id}" title="${memo.done ? '取消完成' : '标记完成'}">${memo.done ? '↩️' : '✅'}</button>
          <button data-action="delete" data-id="${memo.id}" title="删除">🗑️</button>
        </div>
      </div>
      ${memo.content ? `<div class="memo-content collapsed">${escapeHtml(memo.content)}</div><button class="memo-content-toggle" style="display:none">展开</button>` : ''}
      ${memo.amount ? `<div class="memo-amount">¥${Number(memo.amount).toFixed(2)}</div>` : ''}
      ${attHtml ? `<div class="memo-attachments">${attHtml}</div>` : ''}
      <div class="memo-meta">
        <span>${cat.icon} ${cat.name}</span>
        ${dateStr ? `<span>📆 ${dateStr}</span>` : ''}
        <span>🕐 ${new Date(memo.createdAt).toLocaleDateString('zh-CN')}</span>
      </div>
    `;
    list.appendChild(card);
    if (memo.content) {
      const contentEl = card.querySelector('.memo-content');
      const toggleBtn = card.querySelector('.memo-content-toggle');
      if (contentEl && toggleBtn && contentEl.scrollHeight > contentEl.clientHeight + 1) {
        toggleBtn.style.display = '';
      } else if (contentEl && toggleBtn) {
        contentEl.classList.remove('collapsed');
      }
    }
  }
  renderPagination(sorted.length);
}

export function renderEmojiGrid() {
  const grid = document.getElementById('emojiGrid');
  grid.innerHTML = config.ui.emojis.map(e =>
    `<button type="button" class="emoji-option${e === state.selectedEmoji ? ' selected' : ''}" data-emoji="${e}">${e}</button>`
  ).join('');
}

export function renderColorGrid() {
  const grid = document.getElementById('colorGrid');
  grid.innerHTML = config.ui.colors.map(c =>
    `<button type="button" class="color-option${c === state.selectedColor ? ' selected' : ''}" data-color="${c}" style="background:${c}"></button>`
  ).join('');
}

export async function renderCatList() {
  const cats = await db.getCategories();
  document.getElementById('catList').innerHTML = cats.map(cat => `
    <div class="cat-item" data-id="${cat.id}">
      <span class="cat-item-icon">${cat.icon}</span>
      <span class="cat-item-name">${escapeHtml(cat.name)}</span>
      <div class="cat-item-actions">
        <button data-action="edit-cat" data-id="${cat.id}">✏️</button>
        <button data-action="delete-cat" data-id="${cat.id}">🗑️</button>
      </div>
    </div>
  `).join('');
}

export function renderAttachmentPreviews() {
  const container = document.getElementById('attachmentPreviews');
  container.innerHTML = state.pendingAttachments.map((att, i) => {
    const isImage = att.type.startsWith('image/');
    const preview = isImage ? `<img src="${att.thumbnail}" alt="">` : `<div class="att-pdf-icon">📄</div>`;
    const ocrBadge = att.ocrText ? `<span class="att-ocr-badge">OCR</span>` : '';
    const processing = att.ocrProcessing ? `<div class="att-ocr-processing">识别中...</div>` : '';
    return `<div class="att-preview" data-idx="${i}">${preview}<button class="att-remove" data-idx="${i}">&times;</button>${ocrBadge}${processing}</div>`;
  }).join('');
}

export function renderPagination(total) {
  const el = document.getElementById('pagination');
  if (!el) return;
  if (total <= state.pageSize) { el.innerHTML = ''; return; }
  const totalPages = Math.ceil(total / state.pageSize);
  const pages = [];
  for (let i = 1; i <= totalPages; i++) pages.push(i);
  el.innerHTML = `
    <div class="page-size-row">
      <span>每页</span>
      <select id="pageSizeSelect">
        ${[10,20,50,100].map(n => `<option value="${n}"${n === state.pageSize ? ' selected' : ''}>${n}</option>`).join('')}
      </select>
      <span>条</span>
    </div>
    <div class="page-btns">
      <button class="page-btn" data-page="prev" ${state.currentPage === 1 ? 'disabled' : ''}>上一页</button>
      ${pages.map(p => `<button class="page-btn${p === state.currentPage ? ' active' : ''}" data-page="${p}">${p}</button>`).join('')}
      <button class="page-btn" data-page="next" ${state.currentPage === totalPages ? 'disabled' : ''}>下一页</button>
    </div>
  `;
}

export async function renderAll() {
  try { renderSiteText(); } catch (e) { console.error('renderSiteText failed:', e); }
  try { renderTimeFilters(); } catch (e) { console.error('renderTimeFilters failed:', e); }
  try { await renderCategoryPills(); } catch (e) { console.error('renderCategoryPills failed:', e); }
  try { await renderCategorySelect(); } catch (e) { console.error('renderCategorySelect failed:', e); }
  try { await renderStats(); } catch (e) { console.error('renderStats failed:', e); }
  try { await renderMemos(); } catch (e) { console.error('renderMemos failed:', e); }
  try { renderPagination(0); } catch (e) { console.error('renderPagination failed:', e); }
}

export { filterMemos, getTimeRange };
