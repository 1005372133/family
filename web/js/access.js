const TOKEN_KEY = 'fm_access_token';

export function tokenHeaders() {
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { 'x-access-token': t } : {};
}

export async function checkAccess() {
  const res = await fetch('/api/access/info', { headers: tokenHeaders() });
  return res.json();
}

export async function verifyAccess(code) {
  const res = await fetch('/api/access/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  const data = await res.json();
  if (data.ok && data.token) localStorage.setItem(TOKEN_KEY, data.token);
  return !!data.ok;
}

export function initGate(onSuccess) {
  const overlay = document.getElementById('gateOverlay');
  const input = document.getElementById('gateCode');
  const btn = document.getElementById('gateSubmit');
  const err = document.getElementById('gateError');
  overlay.style.display = 'flex';

  const submit = async () => {
    const code = input.value.trim();
    if (!code) return;
    btn.disabled = true;
    const ok = await verifyAccess(code);
    btn.disabled = false;
    if (ok) {
      overlay.style.display = 'none';
      onSuccess();
    } else {
      err.textContent = '访问码错误，请重试';
      input.value = '';
      input.focus();
      overlay.classList.remove('gate-shake');
      void overlay.offsetWidth;
      overlay.classList.add('gate-shake');
    }
  };

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.focus();
}
