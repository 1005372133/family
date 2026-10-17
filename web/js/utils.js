export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function formatRelativeDate(dateStr, labels) {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((d - now) / 86400000);
  if (diff === 0) return labels.today;
  if (diff === 1) return labels.tomorrow;
  if (diff === -1) return labels.yesterday;
  if (diff > 1 && diff <= 7) return labels.daysLater.replace('{n}', diff);
  if (diff < -1 && diff >= -7) return labels.daysAgo.replace('{n}', Math.abs(diff));
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

export function detectDevice() {
  const ua = navigator.userAgent;
  let device = '';
  if (/iPhone/.test(ua)) device = 'iPhone';
  else if (/iPad/.test(ua)) device = 'iPad';
  else if (/Android/.test(ua)) {
    const m = ua.match(/;\s*([^;)]+)\s+Build\//);
    const model = m ? m[1].trim() : '';
    if (/HUAWEI|HarmonyOS/i.test(ua) || /HUAWEI/i.test(model)) device = '华为';
    else if (/Xiaomi|Redmi|MI\s/i.test(ua) || /Xiaomi|Redmi/i.test(model)) device = '小米';
    else if (/OPPO|PEM/i.test(ua) || /OPPO/i.test(model)) device = 'OPPO';
    else if (/vivo/i.test(ua) || /vivo/i.test(model)) device = 'vivo';
    else if (/Samsung|SM-|GT-/i.test(ua) || /Samsung/i.test(model)) device = '三星';
    else device = model || 'Android';
  } else if (/Macintosh|Mac OS X/.test(ua)) device = 'Mac';
  else if (/Windows/.test(ua)) device = 'Windows';
  else if (/Linux/.test(ua)) device = 'Linux';
  else device = '未知设备';

  let browser = '';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/OPR\//.test(ua)) browser = 'Opera';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Firefox\//.test(ua)) browser = 'Firefox';
  else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
  else browser = '浏览器';

  return device + ' · ' + browser;
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}
