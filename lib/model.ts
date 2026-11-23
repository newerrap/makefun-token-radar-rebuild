export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface Row {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  watchlist: boolean;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  tokenless_age_days: number | null;
  multiple: number;
  multiple_source: 'category' | 'global';
  peer_count: number;
  momentum_multiplier: number;
  maturity_multiplier: number;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0.21;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function clamp(value: number): number {
  return Math.max(0.02, Math.min(3, value));
}

function daysBetween(listedAt: string | null, asOf: string): number | null {
  if (!listedAt) return null;
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = Date.parse(`${listedAt}T00:00:00Z`);
  return Math.max(0, Math.floor((end - start) / 86400000));
}

export function selectBoard(snapshot: Snapshot): Protocol[] {
  const watched = new Set(snapshot.watchlist);
  const excludedCategories = new Set([
    'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking',
    'Restaked BTC', 'CEX',
  ]);
  const versionMarker = / (?:[Vv]\d+(?:\.\d+)?|\d+\.\d+)$/;
  const wrappedWord = /\b(wrapped|staked|staking)\b/i;
  const exchangeName = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)/i;

  return snapshot.protocols.filter((protocol) => {
    if (watched.has(protocol.slug)) return true;
    return protocol.tvl_usd < snapshot.floor_usd
      && protocol.gecko_id === null
      && protocol.symbol === null
      && !excludedCategories.has(protocol.category || '')
      && !versionMarker.test(protocol.name)
      && !wrappedWord.test(protocol.name)
      && !exchangeName.test(protocol.name);
  });
}

function categoryInfo(snapshot: Snapshot) {
  const peers = snapshot.protocols
    .filter((protocol) => protocol.gecko_id !== null || protocol.symbol !== null)
    .filter((protocol) => protocol.mcap_usd !== null && protocol.tvl_usd > 0);
  const global = median(peers.map((protocol) => protocol.mcap_usd! / protocol.tvl_usd));
  const groups = new Map<string, number[]>();

  for (const protocol of peers) {
    if (!protocol.category) continue;
    const values = groups.get(protocol.category) || [];
    values.push(protocol.mcap_usd! / protocol.tvl_usd);
    groups.set(protocol.category, values);
  }
  return { global: clamp(global), groups, peerCount: peers.length };
}

function plan(protocol: Protocol, age: number | null, seed: number): string[] {
  const name = protocol.name;
  const chain = protocol.chains[0] || 'its primary network';
  const category = (protocol.category || 'protocol').toLowerCase();
  let productStep: string;

  if (/lend|money market|credit/.test(category)) {
    productStep = `Supply a small amount of a liquid asset to ${name} on ${chain}, then borrow only against a wide collateral buffer and monitor the health factor.`;
  } else if (/dex|exchange|amm/.test(category)) {
    productStep = `Make a $100 starter position in ${name} on ${chain}: route two modest swaps, then provide liquidity only after checking pool depth and impermanent-loss risk.`;
  } else if (/perp|derivative|futures/.test(category)) {
    productStep = `Open a $100 starter position on ${name} via ${chain}; keep leverage low, use stops, and build genuine maker/taker volume rather than chasing risky open interest.`;
  } else if (/cdp|stablecoin/.test(category)) {
    productStep = `Open a conservative $100 collateral position in ${name} on ${chain}, mint modestly, and check its liquidation threshold and health factor each session.`;
  } else if (/yield|vault|aggregator|allocator/.test(category)) {
    productStep = `Deposit a $100 starter amount into ${name}'s most transparent vault on ${chain}; read the strategy and fees before enabling auto-compounding.`;
  } else if (/risk|curat/.test(category)) {
    productStep = `Allocate a $100 starter position through ${name}'s curated vaults on ${chain}; review curator limits, assets, and withdrawal terms before scaling.`;
  } else if (/rwa|real world|basis/.test(category)) {
    productStep = `Complete ${name}'s onboarding on ${chain} with a $100 starter allocation, confirming eligibility, redemption terms, and the underlying basis or real-world exposure.`;
  } else {
    productStep = `Create a wallet position for ${name} on ${chain} and make a $100 starter interaction, recording fees and the product's core risk before adding capital.`;
  }

  const variants = [
    `Create a dedicated wallet label for ${name}, bookmark its official ${chain} app, and verify the contract address from two official sources before signing.`,
    productStep,
    `For the next eight weeks, repeat one measured interaction each week and budget $1,000 total; keep receipts, avoid sybil-like bursts, and stop if risk parameters change.`,
    `Spend 15 minutes weekly for eight weeks reviewing ${name}'s documentation, governance, audits, incentives, and any points rules; compound only rewards whose risks you understand.`,
    `Use a small recurring cadence on ${chain}: vary the useful product action slightly, keep balances proportional to your budget, and never borrow or leverage just to manufacture activity.`,
    `Follow ${name}'s official announcements, governance forum, and verified social account; prepare a separate gas balance and be ready to claim, stake, or provide launch liquidity if eligibility opens.`,
    `At the three-month mark, reconcile your activity and costs against the potential token opportunity, then reduce exposure if the thesis, security posture, or withdrawal access worsens.`,
    `When a token exists, verify the contract and official claim window, review unlocks and liquidity, then choose deliberately between exiting, holding a sized position, or supplying launch liquidity.`,
  ];
  // Keep the playbook chronological for every protocol; the seed remains part of
  // the function signature so callers and model inputs remain unchanged.
  return variants;
}

export function buildRows(snapshot: Snapshot): Row[] {
  const board = selectBoard(snapshot);
  const info = categoryInfo(snapshot);
  const watched = new Set(snapshot.watchlist);
  const raw = board.map((protocol, index) => {
    const values = protocol.category ? info.groups.get(protocol.category) || [] : [];
    const ownMultiple = values.length >= 4;
    const multiple = clamp(ownMultiple ? median(values) : info.global);
    const age = daysBetween(protocol.listed_at, snapshot.as_of);
    const momentum = 1 + (protocol.change_7d ?? 0) / 100 / 2;
    const maturity = age === null ? 1 : Math.max(0.85, 1 - age / 730 * 0.15);
    const value = Math.round(protocol.tvl_usd * multiple * momentum * maturity);
    return { protocol, age, multiple, ownMultiple, momentum, maturity, value, seed: index };
  });

  raw.sort((a, b) => b.value - a.value || a.protocol.slug.localeCompare(b.protocol.slug));
  let previous = Infinity;
  return raw.map((item, index) => {
    const value = Math.max(1, Math.min(100_000_000_000_000, Math.min(previous, item.value)));
    previous = value;
    const peerCount = item.ownMultiple && item.protocol.category
      ? info.groups.get(item.protocol.category)!.length
      : info.peerCount;
    return {
      slug: item.protocol.slug,
      name: item.protocol.name,
      rank: index + 1,
      implied_value_usd: value,
      farm_steps: plan(item.protocol, item.age, item.seed),
      watchlist: watched.has(item.protocol.slug),
      category: item.protocol.category,
      chains: item.protocol.chains,
      tvl_usd: item.protocol.tvl_usd,
      change_7d: item.protocol.change_7d,
      tokenless_age_days: item.age,
      multiple: item.multiple,
      multiple_source: item.ownMultiple ? 'category' : 'global',
      peer_count: peerCount,
      momentum_multiplier: item.momentum,
      maturity_multiplier: item.maturity,
    };
  });
}
