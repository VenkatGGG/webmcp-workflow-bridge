const RESOURCES = [
  { id: 'paymentsdb', name: 'PaymentsDB', initials: 'P', kind: 'PostgreSQL', version: '16.2', region: 'us-east-1', size: '248.6 GB', owner: 'Finance platform', color: 'violet', lastBackup: '8 minutes ago', objects: '1,284,902', schedule: 'Every 6 hours' },
  { id: 'ordersdb', name: 'OrdersDB', initials: 'O', kind: 'PostgreSQL', version: '16.2', region: 'us-east-1', size: '186.2 GB', owner: 'Commerce platform', color: 'orange', lastBackup: '24 minutes ago', objects: '842,107', schedule: 'Every 6 hours' },
  { id: 'analyticsdb', name: 'AnalyticsDB', initials: 'A', kind: 'PostgreSQL', version: '15.6', region: 'eu-west-1', size: '412.8 GB', owner: 'Data engineering', color: 'blue', lastBackup: '1 hour ago', objects: '2,106,548', schedule: 'Every 12 hours' },
];
const STORAGE_KEY = 'harbor-demo-snapshots-v1';
const main = document.querySelector('main');
const dialog = document.querySelector('#snapshot-dialog');
const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>';
const arrowIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>';
const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
const cameraIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h4l2-3h4l2 3h4v14H4z"/><circle cx="12" cy="12" r="3.5"/></svg>';
let snapshots = readSnapshots();
let searchQuery = '';
let lastReceipt = null;
let draft = null;
let layoutAlternate = false;
let duplicateControls = false;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function readSnapshots() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(stored)) return [];
    return stored.filter((snapshot) => snapshot && typeof snapshot.id === 'string' && snapshot.id.length < 100 &&
      RESOURCES.some((resource) => resource.id === snapshot.resourceId) &&
      Number.isInteger(snapshot.retention) && snapshot.retention >= 1 && snapshot.retention <= 365 &&
      typeof snapshot.createdAt === 'string' && Number.isFinite(Date.parse(snapshot.createdAt))).slice(0, 50);
  } catch {
    return [];
  }
}

function persistSnapshots() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
    return true;
  } catch {
    return false;
  }
}

function resourceMark(resource, large = false) {
  return `<span class="resource-mark ${resource.color}${large ? ' large' : ''}" aria-hidden="true">${resource.initials}<span>▤</span></span>`;
}

function protectedBadge() {
  return `<span class="status-badge">${checkIcon}Protected</span>`;
}

function pageHeader(eyebrow, title, description, action = '') {
  return `<div class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p class="page-description">${description}</p></div>${action}</div>`;
}

function navigate(path) {
  if (dialog.open) dialog.close();
  draft = null;
  if (location.pathname !== path) history.pushState({}, '', path);
  render();
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

function render() {
  const path = location.pathname.replace(/\/$/, '') || '/overview';
  const selected = path.startsWith('/resources') ? 'resources' : 'overview';
  document.querySelectorAll('[data-nav]').forEach((link) => {
    if (link.dataset.nav === selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelector('#current-page').textContent = selected === 'resources' ? 'Resources' : 'Overview';
  document.body.classList.toggle('alternate-layout', layoutAlternate);
  if (path === '/overview') renderOverview();
  else if (path === '/resources') renderResources();
  else {
    const resource = RESOURCES.find((item) => path === `/resources/${item.id}`);
    if (resource) renderResource(resource);
    else {
      document.title = 'Page not found · Harbor';
      main.innerHTML = `${pageHeader('WORKSPACE', 'Page not found', 'This page is not part of the demo workspace.')}<a class="button primary" href="/overview">Return to overview ${arrowIcon}</a>`;
    }
  }
}

function renderOverview() {
  document.title = 'Overview · Harbor';
  main.innerHTML = `${pageHeader('YOUR BACKUP WORKSPACE', 'A little peace of mind.', 'Your resources are protected and ready for what comes next.', '<a href="/resources" class="button primary">View resources ' + arrowIcon + '</a>')}
    <section class="health-banner" aria-label="Protection summary"><div class="health-icon">${checkIcon}</div><div><strong>Everything is covered.</strong><p>All 3 resources have a healthy backup policy. No action needed.</p></div><span class="health-pulse"><span></span>All systems healthy</span></section>
    <div class="metric-grid"><section class="metric-card"><span class="metric-label">Protected resources<span aria-hidden="true">↗</span></span><div class="metric-number">3<span>/ 3</span></div><p><span class="positive">100%</span> of your workspace</p><div class="metric-track"><span></span></div></section><section class="metric-card"><span class="metric-label">Stored data<span aria-hidden="true">▤</span></span><div class="metric-number">847.6<span>GB</span></div><p>Across 2 regions</p><div class="storage-bars" aria-hidden="true"><span></span><span></span><span></span></div></section><section class="metric-card"><span class="metric-label">Snapshots created<span aria-hidden="true">◷</span></span><div class="metric-number">${12 + snapshots.length}<span>snapshots</span></div><p><span class="positive">12 scheduled</span> + ${snapshots.length} manual demo snapshots</p><div class="sparkline" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></section></div>
    <div class="overview-grid"><section class="panel"><div class="panel-heading"><div><h2>Protected resources</h2><p>A healthy starting point for every workflow.</p></div><a class="text-link" href="/resources">View all ${arrowIcon}</a></div><div class="resource-preview">${RESOURCES.map((resource) => `<div class="preview-row">${resourceMark(resource)}<div><a class="resource-name" href="/resources/${resource.id}">${resource.name}</a><span class="secondary-text">${resource.kind} · ${resource.region}</span></div>${protectedBadge()}</div>`).join('')}</div></section>
    <section class="guide-card"><span class="guide-icon" aria-hidden="true">✳</span><p class="eyebrow">TRY A WORKFLOW</p><h2>A snapshot,<br>in a few steps.</h2><p>Open a resource, choose how long to keep its snapshot, and confirm. A receipt will show exactly what happened.</p><a class="text-link" href="/resources">Explore resources ${arrowIcon}</a><span class="guide-watermark" aria-hidden="true">↗</span></section></div>
    <section class="panel activity-panel"><div class="panel-heading"><div><h2>Recent activity</h2><p>A clear trail of the latest backup operations.</p></div><span class="small-badge">DEMO HISTORY</span></div><div class="activity-list">${activityRows()}</div></section>`;
}

function activityRows() {
  const recent = snapshots.slice(0, 3);
  if (!recent.length) return '<div class="activity-row"><span class="activity-check" aria-hidden="true">✓</span><div><strong>Scheduled backup completed</strong><span>PaymentsDB · 7-day retention · Example activity</span></div><span class="activity-time">8 minutes ago</span></div><div class="activity-row"><span class="activity-check" aria-hidden="true">✓</span><div><strong>Scheduled backup completed</strong><span>OrdersDB · 7-day retention · Example activity</span></div><span class="activity-time">24 minutes ago</span></div>';
  return recent.map((snapshot) => {
    const resource = RESOURCES.find((item) => item.id === snapshot.resourceId);
    return `<div class="activity-row"><span class="activity-check" aria-hidden="true">✓</span><div><strong>Manual snapshot created</strong><span>${resource.name} · ${snapshot.retention}-day retention · Simulated operation</span></div><time class="activity-time" datetime="${escapeHtml(snapshot.createdAt)}">${formatDate(snapshot.createdAt)}</time></div>`;
  }).join('');
}

function renderResources() {
  document.title = 'Resources · Harbor';
  main.innerHTML = `${pageHeader('WORKSPACE INVENTORY', 'Resources', 'A home for everything you protect.', '<span class="inventory-summary"><span></span>3 protected resources</span>')}
    <section class="panel resources-panel" aria-labelledby="resource-list-title"><div class="resource-toolbar"><div><h2 id="resource-list-title">All resources <span class="title-count">3</span></h2><p>Find a resource to view details or create a snapshot.</p></div><form id="resource-search" class="search-form" role="search"><label for="resource-query">Search resources</label><div class="search-controls"><div class="search-input-wrap">${searchIcon}<input id="resource-query" name="resource" type="search" autocomplete="off" placeholder="Search by name or region" value="${escapeHtml(searchQuery)}"></div><button class="button secondary" type="submit">Search</button></div></form></div><div id="resource-results"></div></section>
    <div class="info-note"><span aria-hidden="true">ⓘ</span><p>This workspace contains demo data. Snapshots create a local receipt and never contact a database.</p></div>`;
  document.querySelector('#resource-query').addEventListener('input', (event) => {
    searchQuery = event.target.value;
    renderResourceResults();
  });
  document.querySelector('#resource-search').addEventListener('submit', (event) => {
    event.preventDefault();
    searchQuery = document.querySelector('#resource-query').value;
    renderResourceResults();
  });
  renderResourceResults();
}

function renderResourceResults() {
  const query = searchQuery.trim().toLowerCase();
  const matches = RESOURCES.filter((resource) => `${resource.name} ${resource.kind} ${resource.region}`.toLowerCase().includes(query));
  const rows = matches.map((resource) => `<tr><td><div class="resource-cell">${resourceMark(resource)}<div><a class="resource-name" href="/resources/${resource.id}">${resource.name}</a><span class="secondary-text">${resource.owner}</span></div></div></td><td><span class="type-label">${resource.kind}</span><span class="secondary-text">v${resource.version}</span></td><td>${protectedBadge()}</td><td class="region-cell">${resource.region}</td><td class="size-cell">${resource.size}</td><td class="backup-cell">${resource.lastBackup}</td></tr>`).join('');
  document.querySelector('#resource-results').innerHTML = `${matches.length ? `<div class="table-scroll"><table><caption class="visually-hidden">Protected resources</caption><thead><tr><th scope="col">Resource name</th><th scope="col">Type</th><th scope="col">Status</th><th scope="col">Region</th><th scope="col">Data size</th><th scope="col">Last backup</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<div class="empty-state"><span aria-hidden="true">⌕</span><h3>No resources found</h3><p>Try PaymentsDB, OrdersDB, AnalyticsDB, or a region.</p></div>`}<div class="table-footer"><span role="status">${matches.length} ${matches.length === 1 ? 'resource' : 'resources'}${query ? ` matching “${escapeHtml(searchQuery.trim())}”` : ' in this workspace'}</span><span>All regions</span></div>`;
}

function snapshotButtons() {
  return `<div class="resource-actions"><button class="button primary snapshot-trigger" type="button">${cameraIcon}Create Snapshot</button>${duplicateControls ? `<button class="button primary snapshot-trigger" type="button">${cameraIcon}Create Snapshot</button>` : ''}</div>`;
}

function renderResource(resource) {
  document.title = `${resource.name} · Harbor`;
  const resourceSnapshots = snapshots.filter((snapshot) => snapshot.resourceId === resource.id);
  main.innerHTML = `<a class="back-link" href="/resources">← Back to resources</a><div class="page-heading detail-heading"><div class="detail-identity">${resourceMark(resource, true)}<div><p class="eyebrow">POSTGRESQL RESOURCE</p><h1>${resource.name}</h1><p class="page-description">${resource.owner} <span aria-hidden="true">·</span> ${resource.region}</p></div></div>${snapshotButtons()}</div>
    ${lastReceipt?.resourceId === resource.id ? receiptMarkup(resource, lastReceipt) : ''}
    ${duplicateControls ? '<div class="ambiguity-note"><strong>Duplicate button demo is on.</strong> Both Create Snapshot buttons perform the same action. A conservative replay should stop when it cannot pick a unique target.</div>' : ''}
    <div class="detail-stats"><div><span class="metric-label">Protection status</span>${protectedBadge()}</div><div><span class="metric-label">Data size</span><strong>${resource.size}</strong></div><div><span class="metric-label">Backup schedule</span><strong>${resource.schedule}</strong></div><div><span class="metric-label">Last scheduled backup</span><strong>${resource.lastBackup}</strong></div></div>
    <div class="resource-detail-grid"><section class="panel snapshot-panel"><div class="panel-heading"><div><h2>Snapshots</h2><p>Recovery points for ${resource.name}.</p></div><span class="small-badge">${resourceSnapshots.length} MANUAL</span></div>${resourceSnapshots.length ? `<div class="table-scroll"><table><caption class="visually-hidden">Manual snapshots for ${resource.name}</caption><thead><tr><th scope="col">Snapshot</th><th scope="col">Created</th><th scope="col">Retention</th><th scope="col">Status</th></tr></thead><tbody>${resourceSnapshots.map((snapshot) => `<tr><td><span class="snapshot-id">${escapeHtml(snapshot.id)}</span><span class="secondary-text">Manual · Demo</span></td><td><time datetime="${escapeHtml(snapshot.createdAt)}">${formatDate(snapshot.createdAt)}</time></td><td>${snapshot.retention} days</td><td><span class="status-badge">${checkIcon}Available</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="snapshot-empty"><div class="empty-camera">' + cameraIcon + '</div><h3>A fresh recovery point starts here.</h3><p>No manual snapshots yet. Create a snapshot to capture<br>the current state of this demo resource.</p></div>'}<div class="table-footer"><span>Manual snapshots are saved in this browser</span><span>Local demo</span></div></section>
    <section class="panel configuration-panel"><div class="panel-heading"><h2>Resource details</h2></div><dl class="detail-list"><div><dt>Database engine</dt><dd>${resource.kind} ${resource.version}</dd></div><div><dt>Region</dt><dd>${resource.region}</dd></div><div><dt>Owner</dt><dd>${resource.owner}</dd></div><div><dt>Objects</dt><dd>${resource.objects}</dd></div><div><dt>Default retention</dt><dd>7 days</dd></div><div><dt>Environment</dt><dd><span class="small-badge">SANDBOX</span></dd></div></dl><p class="configuration-note">This resource is simulated. No credentials or live connections are used.</p></section></div>`;
  document.querySelectorAll('.snapshot-trigger').forEach((button) => button.addEventListener('click', () => openSnapshotDialog(resource)));
}

function receiptMarkup(resource, receipt) {
  return `<section class="receipt"><span class="receipt-icon">${checkIcon}</span><div><div role="status" aria-atomic="true"><h2>Snapshot created for ${resource.name}</h2><p>Retention: ${receipt.retention} days. Simulated snapshot is available.</p></div><span>Snapshot ${escapeHtml(receipt.id)}. ${receipt.persisted === false ? 'Created in memory only; browser storage is unavailable.' : 'Saved locally in this browser.'} No database was contacted.</span></div></section>`;
}

function openSnapshotDialog(resource) {
  draft = { resourceId: resource.id, retention: 7 };
  renderSnapshotForm(resource);
  dialog.showModal();
}

function renderSnapshotForm(resource) {
  dialog.innerHTML = `<div class="dialog-heading"><span class="dialog-icon">${cameraIcon}</span><p class="eyebrow">NEW RECOVERY POINT</p><h2 id="snapshot-dialog-title">Create Snapshot</h2><p>Capture a recovery point for <strong>${resource.name}</strong>.</p></div><form id="snapshot-form" aria-label="Snapshot settings"><div class="dialog-body"><div class="dialog-resource">${resourceMark(resource)}<div><strong>${resource.name}</strong><span>${resource.kind} · ${resource.size} · ${resource.region}</span></div>${protectedBadge()}</div><label class="field-label" for="retention-days">Retention days</label><div class="retention-input"><input type="number" id="retention-days" name="retention" min="1" max="365" step="1" value="${draft.retention}" required aria-describedby="retention-help"><span aria-hidden="true">days</span></div><p id="retention-help" class="field-help">Keep this snapshot for 1–365 days. You can choose a different retention for each snapshot.</p><div class="dialog-notice"><span aria-hidden="true">ⓘ</span><p>This is a simulated snapshot. It will be stored only in your browser.</p></div></div><div class="dialog-footer"><button class="button secondary cancel-snapshot" type="button">Cancel</button><button class="button primary" type="submit">Review Snapshot ${arrowIcon}</button></div></form>`;
  dialog.querySelector('.cancel-snapshot').addEventListener('click', closeSnapshotDialog);
  dialog.querySelector('#snapshot-form').addEventListener('submit', (event) => {
    event.preventDefault();
    const retention = Number(dialog.querySelector('#retention-days').value);
    if (!Number.isInteger(retention) || retention < 1 || retention > 365) return;
    draft.retention = retention;
    renderConfirmation(resource);
  });
}

function renderConfirmation(resource) {
  dialog.innerHTML = `<div class="dialog-heading"><span class="dialog-icon">${cameraIcon}</span><p class="eyebrow">REVIEW YOUR SNAPSHOT</p><h2 id="snapshot-dialog-title">Confirm Snapshot</h2><p>Review the details before creating your recovery point.</p></div><form id="snapshot-confirmation" aria-label="Snapshot confirmation"><div class="dialog-body"><dl class="confirmation-list"><div><dt>Resource</dt><dd>${resource.name}</dd></div><div><dt>Retention</dt><dd>${draft.retention} days</dd></div><div><dt>Region</dt><dd>${resource.region}</dd></div><div><dt>Operation</dt><dd>Simulated manual snapshot</dd></div></dl><div class="dialog-notice"><span aria-hidden="true">ⓘ</span><p>Confirming creates a local demo receipt. Your live infrastructure is never accessed.</p></div></div><div class="dialog-footer"><button class="button secondary" type="button" id="edit-snapshot">Back</button><button class="button primary" type="submit">${checkIcon}Confirm Snapshot</button></div></form>`;
  dialog.querySelector('#edit-snapshot').addEventListener('click', () => renderSnapshotForm(resource));
  dialog.querySelector('#snapshot-confirmation').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!draft) return;
    const snapshot = { id: `snap-${crypto.randomUUID().slice(0, 8)}`, resourceId: resource.id, retention: draft.retention, createdAt: new Date().toISOString() };
    snapshots = [snapshot, ...snapshots].slice(0, 50);
    lastReceipt = { ...snapshot, persisted: persistSnapshots() };
    closeSnapshotDialog();
    renderResource(resource);
    main.focus({ preventScroll: true });
  });
}

function closeSnapshotDialog() {
  dialog.close();
  draft = null;
}

function formatDate(value) {
  return escapeHtml(new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)));
}

document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin || url.hash) return;
  event.preventDefault();
  navigate(url.pathname);
});

window.addEventListener('popstate', () => {
  closeSnapshotDialog();
  render();
});

dialog.addEventListener('cancel', () => { draft = null; });
document.querySelector('#alternate-layout').addEventListener('change', (event) => {
  layoutAlternate = event.target.checked;
  document.body.classList.toggle('alternate-layout', layoutAlternate);
});
document.querySelector('#duplicate-controls').addEventListener('change', (event) => {
  duplicateControls = event.target.checked;
  render();
});

render();
