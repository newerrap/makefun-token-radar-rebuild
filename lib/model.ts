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
  peer_p25: number;
  peer_median: number;
  peer_p75: number;
  value_low_usd: number;
  value_high_usd: number;
  reasoning: string;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0.21;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function quantile(sortedValues: number[], q: number): number {
  if (!sortedValues.length) return 0.21;
  const n = sortedValues.length;
  const index = q * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sortedValues[lower];
  const weight = index - lower;
  return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
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

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  switch (n % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}

function formatNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K';
  return n.toFixed(0);
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
  const globalMultiples = peers.map((protocol) => protocol.mcap_usd! / protocol.tvl_usd);
  const globalSorted = [...globalMultiples].sort((a, b) => a - b);
  const global = median(globalMultiples);
  const groups = new Map<string, number[]>();
  const groupSorted = new Map<string, number[]>();

  for (const protocol of peers) {
    if (!protocol.category) continue;
    const values = groups.get(protocol.category) || [];
    values.push(protocol.mcap_usd! / protocol.tvl_usd);
    groups.set(protocol.category, values);
  }
  for (const [cat, vals] of groups) {
    groupSorted.set(cat, [...vals].sort((a, b) => a - b));
  }
  return { global: clamp(global), globalSorted, groups, groupSorted, peerCount: peers.length };
}

function plan(protocol: Protocol, age: number | null, seed: number): string[] {
  const name = protocol.name;
  const mainChain = protocol.chains[0] || 'its primary network';
  const isEthereum = protocol.chains.includes('Ethereum');
  const category = (protocol.category || 'protocol').toLowerCase();
  let productStep: string;
  let riskStep: string;
  let prereqStep: string;

  if (/lend|money market|credit/.test(category)) {
    productStep = `Entry: supply $100 of a liquid asset to ${name} on ${mainChain}, then borrow only against a wide collateral buffer; keep health factor ≥ 1.5 and monitor daily.`;
    riskStep = `Risk: main risks are liquidation from collateral drop and smart-contract exploit; mitigate by keeping health factor ≥ 1.5, using only battle-tested collateral, and capping position at 20% of the $1,000 budget ($200 max).`;
    prereqStep = `Prereqs: dedicated wallet, verify ${name} contracts from 2 official sources, hold ETH for gas on ${mainChain}, and complete any onboarding/KYC if required for institutional-grade lending.`;
  } else if (/dex|exchange|amm/.test(category)) {
    productStep = `Entry: make a $100 starter position in ${name} on ${mainChain}: route two modest swaps, then provide liquidity only after checking pool depth ≥ $50K and impermanent-loss risk.`;
    riskStep = `Risk: impermanent loss and smart-contract risk dominate; mitigate by limiting LP position to 15% of budget ($150 max), preferring stable-correlated pools, and verifying audit status.`;
    prereqStep = `Prereqs: dedicated wallet, verify ${name} router and pool contracts from 2 official sources, hold ${isEthereum ? 'ETH' : 'native gas token'} for gas on ${mainChain}, no KYC typically needed for DEX.`;
  } else if (/perp|derivative|futures/.test(category)) {
    productStep = `Entry: open a $100 starter position on ${name} via ${mainChain}; keep leverage ≤ 2x, use stops, and build genuine maker/taker volume rather than chasing risky open interest.`;
    riskStep = `Risk: liquidation from funding/price moves and oracle manipulation; mitigate by capping leverage at 2x, position at 10% of budget ($100 max), and using only protocols with ≥ 2 audits.`;
    prereqStep = `Prereqs: dedicated wallet, verify ${name} contracts from 2 official sources, hold ${isEthereum ? 'ETH' : 'native gas token'} for gas on ${mainChain}, no KYC typically needed for perps.`;
  } else if (/cdp|stablecoin/.test(category)) {
    productStep = `Entry: open a conservative $100 collateral position in ${name} on ${mainChain}, mint modestly, and check its liquidation threshold and health factor each session.`;
    riskStep = `Risk: depeg of minted stablecoin and collateral liquidation; mitigate by keeping collateral ratio ≥ 150% (health factor ≥ 1.5), capping minted amount at 20% of budget ($200 max), and monitoring peg daily.`;
    prereqStep = `Prereqs: dedicated wallet, verify ${name} CDP/engine contracts from 2 official sources, hold ${isEthereum ? 'ETH' : 'native gas token'} for gas on ${mainChain}, check eligibility for RWA-backed CDPs.`;
  } else if (/yield|vault|aggregator|allocator/.test(category)) {
    productStep = `Entry: deposit a $100 starter amount into ${name}'s most transparent vault on ${mainChain}; read the strategy and fees before enabling auto-compounding.`;
    riskStep = `Risk: strategy drift, smart-contract exploit, and withdrawal delays; mitigate by capping vault exposure at 25% of budget ($250 max), preferring audited strategies with ≤ 30-day withdrawal, and diversifying across ≤ 3 vaults.`;
    prereqStep = `Prereqs: dedicated wallet, verify ${name} vault and strategy contracts from 2 official sources, hold ${isEthereum ? 'ETH' : 'native gas token'} for gas on ${mainChain}, no KYC typically needed.`;
  } else if (/risk|curat/.test(category)) {
    productStep = `Entry: allocate a $100 starter position through ${name}'s curated vaults on ${mainChain}; review curator limits, assets, and withdrawal terms before scaling.`;
    riskStep = `Risk: curator key compromise, strategy drift, and withdrawal gating; mitigate by capping curated allocation at 20% of budget ($200 max), requiring ≥ 2-of-3 multisig for curator actions, and verifying ≤ 14-day withdrawal.`;
    prereqStep = `Prereqs: dedicated wallet, verify ${name} vault and curator contracts from 2 official sources, hold ${isEthereum ? 'ETH' : 'native gas token'} for gas on ${mainChain}, no KYC typically needed.`;
  } else if (/rwa|real world|basis/.test(category)) {
    productStep = `Entry: complete ${name}'s onboarding on ${mainChain} with a $100 starter allocation, confirming eligibility, redemption terms, and the underlying basis or real-world exposure.`;
    riskStep = `Risk: issuer default, regulatory freeze, and redemption gate; mitigate by capping RWA exposure at 15% of budget ($150 max), verifying auditor and custodian, and requiring ≥ weekly NAV updates.`;
    prereqStep = `Prereqs: dedicated wallet, verify ${name} token and issuer contracts from 2 official sources, hold ${isEthereum ? 'ETH' : 'native gas token'} for gas on ${mainChain}, complete KYC/accreditation onboarding for RWA access.`;
  } else {
    productStep = `Entry: create a wallet position for ${name} on ${mainChain} and make a $100 starter interaction, recording fees and the product's core risk before adding capital.`;
    riskStep = `Risk: smart-contract exploit, rug pull, and liquidity drain; mitigate by capping position at 15% of budget ($150 max), verifying ≥ 1 audit, and checking TVL > $1M before scaling.`;
    prereqStep = `Prereqs: dedicated wallet, verify ${name} core contracts from 2 official sources, hold ${isEthereum ? 'ETH' : 'native gas token'} for gas on ${mainChain}, check for any category-specific onboarding.`;
  }

  const gasRange = isEthereum ? '$5–$20' : '$0.01–$0.50';
  const weeklyBudget = 125; // 1000/8 = 125
  const cadenceStep = `Cadence: 8-week plan, $1,000 total ($${weeklyBudget}/week); weekly gas on ${mainChain} ~${gasRange}, so net deployable ~$${weeklyBudget - (isEthereum ? 12 : 0.25)}/week; stop if risk parameters change.`;
  const monitorStep = `Monitor: 15-min weekly checklist — read docs/changelog, governance forum, audit updates, incentive/points rules, and re-check the risk parameters above (health factor, collateral ratio, leverage cap, position caps).`;
  const scaleStep = `Scale: only increase after 4 weeks if health factor ≥ 1.5 (lending/CDP), leverage ≤ 2x (perps), position caps held, and no security incidents; total exposure cap = $1,000 budget.`;
  const launchStep = `Launch: watch official blog, governance forum, and verified X for token announcement; reserve $50 gas for claim, use only verified claim domain (check 2 sources), prepare to claim/stake/provide launch liquidity.`;
  const exitStep = `Exit: in claim window, verify contract, review unlocks/liquidity, then choose: exit, hold ≤ 5% of portfolio, or supply launch liquidity; stop triggers — security incident, paused withdrawals, broken thesis — immediately withdraw via official UI or emergency exit.`;

  return [
    prereqStep,
    productStep,
    cadenceStep,
    riskStep,
    monitorStep,
    scaleStep,
    launchStep,
    exitStep,
  ];
}

export function buildRows(snapshot: Snapshot): Row[] {
  const board = selectBoard(snapshot);
  const info = categoryInfo(snapshot);
  const watched = new Set(snapshot.watchlist);
  const raw = board.map((protocol, index) => {
    const values = protocol.category ? info.groups.get(protocol.category) || [] : [];
    const sortedValues = protocol.category ? info.groupSorted.get(protocol.category) || [] : [];
    const ownMultiple = values.length >= 4;
    const peerMultiples = ownMultiple ? sortedValues : info.globalSorted;
    const peerCount = ownMultiple ? values.length : info.peerCount;
    const multiple = clamp(ownMultiple ? median(values) : info.global);
    const peer_p25 = clamp(quantile(peerMultiples, 0.25));
    const peer_median = clamp(quantile(peerMultiples, 0.5));
    const peer_p75 = clamp(quantile(peerMultiples, 0.75));
    const age = daysBetween(protocol.listed_at, snapshot.as_of);
    const momentum = 1 + (protocol.change_7d ?? 0) / 100 / 2;
    const maturity = age === null ? 1 : Math.max(0.85, 1 - age / 730 * 0.15);
    const value = Math.round(protocol.tvl_usd * multiple * momentum * maturity);
    const value_low_usd = Math.min(1e14, Math.round(protocol.tvl_usd * peer_p25 * momentum * maturity));
    const value_high_usd = Math.min(1e14, Math.round(protocol.tvl_usd * peer_p75 * momentum * maturity));
    return { protocol, age, multiple, ownMultiple, peerCount, peer_p25, peer_median, peer_p75, momentum, maturity, value, value_low_usd, value_high_usd, seed: index };
  });

  raw.sort((a, b) => b.value - a.value || a.protocol.slug.localeCompare(b.protocol.slug));
  let previous = Infinity;
  const ranked = raw.map((item, index) => {
    const value = Math.max(1, Math.min(100_000_000_000_000, Math.min(previous, item.value)));
    previous = value;
    const rank = index + 1;
    const total = raw.length;
    let positionDesc: string;
    if (rank <= 10) positionDesc = 'top 10';
    else if (rank <= Math.ceil(total * 0.25)) positionDesc = 'top quartile';
    else if (rank <= Math.ceil(total * 0.5)) positionDesc = 'top half';
    else positionDesc = 'bottom half';
    const momentumPct = ((item.momentum - 1) * 100).toFixed(2);
    const peerGroupDesc = item.ownMultiple
      ? `category "${item.protocol.category}" (${item.peerCount} peers)`
      : `global set (${item.peerCount} peers)`;
    const reasoning = `${item.protocol.name} has $${formatNumber(item.protocol.tvl_usd)} TVL, uses ${peerGroupDesc} with median multiple ${item.peer_median.toFixed(3)} (p25–p75: ${item.peer_p25.toFixed(3)}–${item.peer_p75.toFixed(3)}), 7d momentum ${momentumPct}%, tokenless age ${item.age ?? 'unknown'} days (maturity ${item.maturity.toFixed(3)}), placing it ${positionDesc} (rank ${rank}${ordinalSuffix(rank)}) with implied value $${formatNumber(value)}.`;
    return {
      slug: item.protocol.slug,
      name: item.protocol.name,
      rank,
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
      peer_count: item.peerCount,
      momentum_multiplier: item.momentum,
      maturity_multiplier: item.maturity,
      peer_p25: item.peer_p25,
      peer_median: item.peer_median,
      peer_p75: item.peer_p75,
      value_low_usd: item.value_low_usd,
      value_high_usd: item.value_high_usd,
      reasoning,
    };
  });
  return ranked;
}