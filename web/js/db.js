import { tokenHeaders } from './access.js';

const API = '/api';

async function apiGet(path) {
  const res = await fetch(`${API}${path}`, { headers: tokenHeaders() });
  return res.json();
}

async function apiSend(path, method, body) {
  await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...tokenHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export async function getCategories() {
  return apiGet('/categories');
}

export async function insertCategory(id, name, icon, color, sortOrder) {
  await apiSend('/categories', 'POST', { id, name, icon, color, sort_order: sortOrder });
}

export async function updateCategory(id, name, icon, color) {
  await apiSend(`/categories/${id}`, 'PUT', { name, icon, color });
}

export async function deleteCategory(id) {
  await apiSend(`/categories/${id}`, 'DELETE');
}

export async function getMemos() {
  return apiGet('/memos');
}

export async function getAttachmentsForMemo(memoId) {
  return apiGet(`/memos/${memoId}/attachments`);
}

export async function getAttachmentData(attId) {
  return apiGet(`/attachments/${attId}/data`);
}

export async function insertMemo(memo) {
  await apiSend('/memos', 'POST', memo);
}

export async function updateMemo(memo) {
  await apiSend(`/memos/${memo.id}`, 'PUT', memo);
}

export async function toggleMemoDone(id, done) {
  await apiSend(`/memos/${id}/toggle`, 'PATCH', { done });
}

export async function deleteMemo(id) {
  await apiSend(`/memos/${id}`, 'DELETE');
}

export async function insertAttachment(att) {
  await apiSend('/attachments', 'POST', att);
}

export async function deleteAttachment(id) {
  await apiSend(`/attachments/${id}`, 'DELETE');
}

export async function deleteMemoAttachment(memoId, attId) {
  await apiSend(`/memos/${memoId}/attachments/${attId}`, 'DELETE');
}
