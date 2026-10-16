let configCache = null;

export async function loadConfig() {
  if (configCache) return configCache;
  const resp = await fetch('./config/site.json');
  configCache = await resp.json();
  return configCache;
}

export function getConfig() {
  return configCache;
}
