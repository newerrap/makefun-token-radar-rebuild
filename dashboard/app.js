const rows = globalThis.TOKEN_RADAR_DATA.rows;
let shown = [...rows];
let sortKey = 'rank';
let ascending = true;

const byId = (id) => document.getElementById(id);
const money = (value) => '$' + new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
}).format(value);
const fullMoney = (value) => '$' + value.toLocaleString();

byId('date').textContent = 'Snapshot · 14 Nov 2026';
byId('method').textContent = 'Implied value = TVL × median FDV/TVL multiple of traded peers in the same category (or all traded peers when category is thin), adjusted for 7-day momentum and tokenless age.';

const categories = [...new Set(rows.map((row) => row.category).filter(Boolean))].sort();
const chains = [...new Set(rows.flatMap((row) => row.chains))].sort();

for (const [id, values] of [['category', categories], ['chain', chains]]) {
  for (const value of values) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    byId(id).append(option);
  }
}

function render() {
  const query = byId('search').value.toLowerCase();
  const category = byId('category').value;
  const chain = byId('chain').value;
  const watchlistOnly = byId('watch').checked;

  shown = rows.filter((row) => (
    (!query || row.name.toLowerCase().includes(query) || row.slug.toLowerCase().includes(query))
    && (!category || row.category === category)
    && (!chain || row.chains.includes(chain))
    && (!watchlistOnly || row.watchlist)
  ));
  shown.sort((a, b) => {
    const left = a[sortKey];
    const right = b[sortKey];
    if (typeof left === 'string') {
      return (ascending ? 1 : -1) * left.localeCompare(right);
    }
    return (ascending ? 1 : -1) * ((left ?? 0) - (right ?? 0));
  });

  byId('tbody').innerHTML = shown.map((row) => {
    const rankChip = row.rank <= 3 ? `<span class="rank-chip rank-${row.rank}">#${row.rank}</span>` : `#${row.rank}`;
    const watchStar = row.watchlist ? '★ ' : '';
    const multipleSource = row.multiple_source === 'category' ? 'cat' : 'global';
    return `
    <tr data-slug="${row.slug}">
      <td>${rankChip}</td>
      <td><div class="name">${watchStar}${row.name}</div><div class="slug">${row.slug}</div></td>
      <td class="tag">${row.category || 'Uncategorized'}</td>
      <td>${money(row.tvl_usd)}</td>
      <td><span class="multiple">${row.multiple.toFixed(3)}×</span><span class="source-tag ${multipleSource}">${multipleSource}</span></td>
      <td class="value">${money(row.implied_value_usd)}</td>
      <td class="${(row.change_7d || 0) >= 0 ? 'up' : 'down'}">${row.change_7d == null ? '—' : (row.change_7d > 0 ? '+' : '') + row.change_7d.toFixed(1) + '%'}</td>
    </tr>
  `;
  }).join('');

  document.querySelectorAll('tbody tr').forEach((element) => {
    element.onclick = () => showDetail(element.dataset.slug);
  });
  byId('stats').innerHTML = `
    <div class="stat"><b>${shown.length}<small> / ${rows.length}</small></b><span>visible protocols</span></div>
    <div class="stat"><b>${rows.filter((row) => row.watchlist).length}</b><span>house watchlist</span></div>
    <div class="stat"><b>${money(rows.reduce((total, row) => total + row.tvl_usd, 0))}</b><span>board TVL</span></div>
  `;
}

function showDetail(slug) {
  const row = rows.find((candidate) => candidate.slug === slug);
  byId('board').hidden = true;
  byId('detail').hidden = false;
  location.hash = `p=${encodeURIComponent(slug)}`;

  const phaseLabels = ['Setup', 'Entry', 'Cadence', 'Risk', 'Monitor', 'Scale', 'Launch', 'Exit'];
  const maxMultiple = Math.max(row.peer_p75 || 0, row.multiple, 1);
  const trackMax = maxMultiple * 1.15;
  const p25 = row.peer_p25 || 0;
  const median = row.peer_median || 0;
  const p75 = row.peer_p75 || 0;
  const p25Pos = (p25 / trackMax) * 100;
  const medianPos = (median / trackMax) * 100;
  const p75Pos = (p75 / trackMax) * 100;
  const bandWidth = p75Pos - p25Pos;

  byId('detail').innerHTML = `
    <div class="back" onclick="backToBoard()">← Back to radar</div>
    <article class="detailcard">
      <div class="hero">
        <div>
          <p class="eyebrow">RANK #${row.rank} · ${row.watchlist ? 'WATCHLIST' : 'MODEL QUALIFIED'}</p>
          <h2>${row.name}</h2>
          <p class="sub">${row.category || 'Uncategorized'} · ${(row.chains || []).join(', ')}</p>
        </div>
        <div><small>IMPLIED LAUNCH VALUE</small><div class="big">${fullMoney(row.implied_value_usd)}</div></div>
      </div>
      <div class="evidence">
        ${[
          ['TVL', fullMoney(row.tvl_usd)],
          ['7d change', row.change_7d == null ? '—' : row.change_7d + '%'],
          ['Multiple', row.multiple.toFixed(3) + '× (' + row.multiple_source + ')'],
          ['Peers', row.peer_count],
          ['Tokenless age', row.tokenless_age_days == null ? 'Unknown' : row.tokenless_age_days + ' days'],
          ['Momentum', row.momentum_multiplier.toFixed(3) + '×'],
          ['Maturity', row.maturity_multiplier.toFixed(3) + '×'],
          ['Slug', row.slug],
        ].map((item) => `<div class="ev"><small>${item[0]}</small><b>${item[1]}</b></div>`).join('')}
      </div>

      <h3>Why this rank</h3>
      <p class="reasoning">${row.reasoning || 'No reasoning available.'}</p>

      <h3>Peer evidence</h3>
      <div class="peer-panel">
        <div class="peer-header">
          <div><small>Peers</small><b>${row.peer_count}</b></div>
          <div><small>Median multiple</small><b>${(row.peer_median || 0).toFixed(3)}×</b></div>
        </div>
        <div class="range-track" style="--track-max:${trackMax.toFixed(3)}">
          <div class="range-band" style="left:${p25Pos}%;width:${bandWidth}%"></div>
          <div class="range-marker" style="left:${medianPos}%"></div>
          <div class="range-labels">
            <span style="left:${p25Pos}%">${p25.toFixed(3)}×</span>
            <span style="left:${medianPos}%">${median.toFixed(3)}×</span>
            <span style="left:${p75Pos}%">${p75.toFixed(3)}×</span>
          </div>
        </div>
      </div>

      <h3>Sensitivity</h3>
      <table class="sensitivity">
        <thead><tr><th>Scenario</th><th>Multiple</th><th>Implied value</th></tr></thead>
        <tbody>
          <tr><td>Conservative</td><td>${(row.peer_p25 || 0).toFixed(3)}×</td><td class="value">${fullMoney(row.value_low_usd || 0)}</td></tr>
          <tr><td>Base</td><td>${(row.peer_median || 0).toFixed(3)}×</td><td class="value">${fullMoney(row.implied_value_usd || 0)}</td></tr>
          <tr><td>Aggressive</td><td>${(row.peer_p75 || 0).toFixed(3)}×</td><td class="value">${fullMoney(row.value_high_usd || 0)}</td></tr>
        </tbody>
      </table>

      <h3>Positioning playbook</h3>
      <ol class="steps">
        ${row.farm_steps.map((step, index) => `<li><span class="phase-chip">${phaseLabels[index] || `Step ${index + 1}`}</span>${step}</li>`).join('')}
      </ol>
    </article>
  `;
}

function backToBoard() {
  byId('detail').hidden = true;
  byId('board').hidden = false;
  location.hash = '';
}

document.querySelectorAll('th').forEach((header) => {
  header.onclick = () => {
    const nextKey = header.dataset.key;
    ascending = sortKey === nextKey ? !ascending : true;
    sortKey = nextKey;
    render();
  };
});
['search', 'category', 'chain', 'watch'].forEach((id) => {
  byId(id).oninput = render;
});

function applyDeepLink() {
  const hash = location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  if (params.has('q')) {
    byId('search').value = decodeURIComponent(params.get('q'));
  }
  if (params.has('cat')) {
    byId('category').value = decodeURIComponent(params.get('cat'));
  }
  if (params.has('p')) {
    const slug = decodeURIComponent(params.get('p'));
    if (rows.some((r) => r.slug === slug)) {
      showDetail(slug);
      return;
    }
  }
  render();
}

applyDeepLink();
window.onhashchange = applyDeepLink;
render();