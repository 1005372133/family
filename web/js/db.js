const API = '/api';

export async function getCategories() {
  const res = await fetch(`${API}/categories`);
  return res.json();
}

export async function insertCategory(id, name, icon, color, sortOrder) {
  await fetch(`${API}/categories`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, name, icon, color, sort_order: sortOrder })
  });
}

export async function updateCategory(id, name, icon, color) {
  await fetch(`${API}/categories/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, icon, color })
  });
}

export async function deleteCategory(id) {
  await fetch(`${API}/categories/${id}`, { method: 'DELETE' });
}

export async function getMemos() {
  const res = await fetch(`${API}/memos`);
  return res.json();
}

export async function getAttachmentsForMemo(memoId) {
  const res = await fetch(`${API}/memos/${memoId}/attachments`);
  return res.json();
}

export async function getAttachmentData(attId) {
  const res = await fetch(`${API}/attachments/${attId}/data`);
  return res.json();
}

export async function insertMemo(memo) {
  await fetch(`${API}/memos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memo)
  });
}

export async function updateMemo(memo) {
  await fetch(`${API}/memos/${memo.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(memo)
  });
}

export async function toggleMemoDone(id, done) {
  await fetch(`${API}/memos/${id}/toggle`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done })
  });
}

export async function deleteMemo(id) {
  await fetch(`${API}/memos/${id}`, { method: 'DELETE' });
}

export async function insertAttachment(att) {
  await fetch(`${API}/attachments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(att)
  });
}

export async function deleteAttachment(id) {
  await fetch(`${API}/attachments/${id}`, { method: 'DELETE' });
}

export async function deleteMemoAttachment(memoId, attId) {
  await fetch(`${API}/memos/${memoId}/attachments/${attId}`, { method: 'DELETE' });
}
