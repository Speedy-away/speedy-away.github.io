const allowed = new Set(['compatibility', 'preparation', 'requirements', 'installationSteps', 'installDirectory', 'firmwareSupport', 'primaryDocumentation', 'networkIntegration']);
function applyStoreAppOverrides(resource, override = {}) {
  const next = {...resource};
  for (const [key, value] of Object.entries(override)) {
    if (!allowed.has(key)) throw Error('Unsupported app requirement override: ' + key);
    next[key] = value;
  }
  return next;
}
module.exports = {applyStoreAppOverrides};
