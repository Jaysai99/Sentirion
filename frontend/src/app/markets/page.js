"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(value, decimals = 2) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function fmtCompact(value) {
  if (value == null) return "--";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function fmtPct(value, decimals = 2) {
  if (value == null) return "--";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}%`;
}

function pctColor(value) {
  if (value == null) return "text-[#93a49c]";
  if (value > 0) return "text-[#b8f36b]";
  if (value < 0) return "text-[#ff7d6b]";
  return "text-[#ffbf69]";
}

function pctBg(value) {
  if (value == null) return "bg-white/[0.03] border-white/8";
  if (value > 0.5) return "bg-[#b8f36b]/8 border-[#b8f36b]/20";
  if (value < -0.5) return "bg-[#ff7d6b]/8 border-[#ff7d6b]/20";
  return "bg-white/[0.03] border-white/8";
}

// ── Region config ─────────────────────────────────────────────────────────────
const REGION_CONFIG = [
  {
    name: "Americas",
    flag: "🌎",
    accent: "#7fd0ff",
    usSymbols: ["^GSPC", "^IXIC", "^DJI"],
    globalSymbols: ["^BVSP", "^MXX"],
  },
  {
    name: "Europe",
    flag: "🌍",
    accent: "#b8f36b",
    usSymbols: [],
    globalSymbols: ["^FTSE", "^GDAXI", "^FCHI"],
  },
  {
    name: "Asia-Pacific",
    flag: "🌏",
    accent: "#ffbf69",
    usSymbols: [],
    globalSymbols: ["^N225", "^HSI", "^AXJO", "^BSESN", "^KS11"],
  },
];

const COMMODITY_GROUPS = {
  "Precious Metals": ["Gold", "Silver", "Platinum"],
  "Energy": ["WTI Crude", "Brent Crude", "Natural Gas"],
  "Base Metals & Ag": ["Copper", "Wheat", "Corn", "Soybeans"],
};

// ── Components ────────────────────────────────────────────────────────────────

function SparkLine({ history, stroke = "#b8f36b", height = 40, width = 80 }) {
  if (!history?.length) return <div style={{ width, height }} className="rounded bg-white/[0.03]" />;
  const vals = history.map((h) => h.close).filter((v) => typeof v === "number");
  if (!vals.length) return <div style={{ width, height }} className="rounded bg-white/[0.03]" />;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pts = vals.map((v, i) => {
    const x = (i / Math.max(vals.length - 1, 1)) * width;
    const y = max === min ? height / 2 : height - ((v - min) / (max - min)) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={pts.join(" ")} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FullLineChart({ history, stroke = "#b8f36b", name = "" }) {
  if (!history?.length) return <div className="h-48 rounded-[18px] bg-white/[0.04]" />;
  return (
    <ResponsiveContainer width="100%" height={192}>
      <LineChart data={history} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#70827a", fontSize: 9, fontFamily: "monospace" }}
          tickFormatter={(v) => String(v || "").slice(5)}
          interval="preserveStartEnd"
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#70827a", fontSize: 9, fontFamily: "monospace" }}
          domain={["auto", "auto"]}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v) => fmtCompact(v)}
        />
        <Tooltip
          contentStyle={{
            background: "#0b1714",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "12px",
            padding: "8px 12px",
          }}
          labelStyle={{ color: "#9aaba3", fontSize: 11 }}
          itemStyle={{ color: stroke, fontFamily: "monospace" }}
          formatter={(v) => [typeof v === "number" ? v.toLocaleString(undefined, { maximumFractionDigits: 4 }) : v, name]}
        />
        <Line
          type="monotone"
          dataKey="close"
          stroke={stroke}
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: stroke, stroke: "#0b1714", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function IndexCard({ item, accent, onClick, selected }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-[18px] border p-3 text-left transition ${
        selected
          ? "border-white/20 bg-white/8"
          : `${pctBg(item.change_pct)} hover:bg-white/[0.05]`
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#70827a]">{item.symbol}</div>
          <div className="mt-0.5 truncate text-sm font-semibold text-[#f4f0e8]">{item.name}</div>
        </div>
        <SparkLine history={item.history} stroke={accent} height={32} width={60} />
      </div>
      <div className="mt-2 flex items-end justify-between">
        <div className="font-mono text-base font-semibold text-[#f4f0e8]">
          {fmtCompact(item.price)}
        </div>
        <div className={`font-mono text-sm font-semibold ${pctColor(item.change_pct)}`}>
          {fmtPct(item.change_pct)}
        </div>
      </div>
    </button>
  );
}

function AssetRow({ item, precision = 2, isRate = false }) {
  return (
    <tr className="border-b border-white/4 hover:bg-white/[0.02]">
      <td className="py-2 pr-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#70827a]">{item.symbol}</div>
        <div className="text-sm text-[#f4f0e8]">{item.name}</div>
      </td>
      <td className="py-2 pr-3 font-mono text-sm text-[#f4f0e8]">
        {item.price != null ? (isRate ? `${item.price.toFixed(3)}%` : item.price.toLocaleString(undefined, { maximumFractionDigits: precision })) : "--"}
      </td>
      <td className={`py-2 pr-3 font-mono text-sm font-semibold ${pctColor(item.change_pct)}`}>
        {fmtPct(item.change_pct, 3)}
      </td>
      <td className="py-2">
        <SparkLine history={item.history} stroke={item.change_pct >= 0 ? "#b8f36b" : "#ff7d6b"} height={28} width={72} />
      </td>
    </tr>
  );
}

function SectionTable({ title, items, precision = 2, isRate = false }) {
  if (!items?.length) return null;
  return (
    <div className="rounded-[22px] border border-white/8 bg-[#0b1714] p-4">
      <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/8">
              {["Instrument", "Price", "Chg%", "30D"].map((h) => (
                <th key={h} className="pb-2 pr-3 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-[#70827a]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <AssetRow key={item.symbol} item={item} precision={precision} isRate={isRate} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tab Views ─────────────────────────────────────────────────────────────────

function WorldMarketsView({ overview, ficc, loading }) {
  const [selected, setSelected] = useState(null);

  const bySymbol = useMemo(() => {
    const map = {};
    for (const idx of overview?.indices || []) map[idx.symbol] = idx;
    for (const eq of ficc?.equities || []) map[eq.symbol] = eq;
    return map;
  }, [overview, ficc]);

  const selectedItem = selected ? bySymbol[selected] : null;

  if (loading) return <LoadingGrid count={6} />;

  return (
    <div className="space-y-5">
      {selectedItem && (
        <div className="glass-panel rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">{selectedItem.symbol}</div>
              <div className="text-2xl font-semibold tracking-[-0.03em] text-[#f4f0e8]">{selectedItem.name}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tracking-[-0.06em] text-[#f4f0e8]">{fmtCompact(selectedItem.price)}</div>
              <div className={`text-base font-semibold ${pctColor(selectedItem.change_pct)}`}>{fmtPct(selectedItem.change_pct)}</div>
            </div>
          </div>
          <FullLineChart history={selectedItem.history} name={selectedItem.name} />
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#70827a] hover:text-[#f4f0e8]"
          >
            Close ×
          </button>
        </div>
      )}

      {REGION_CONFIG.map((region) => {
        const items = [
          ...region.usSymbols.map((s) => bySymbol[s]).filter(Boolean),
          ...region.globalSymbols.map((s) => bySymbol[s]).filter(Boolean),
        ];
        if (!items.length) return null;
        return (
          <div key={region.name} className="glass-panel rounded-[28px] p-5">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-lg">{region.flag}</span>
              <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">{region.name}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {items.map((item) => (
                <IndexCard
                  key={item.symbol}
                  item={item}
                  accent={region.accent}
                  selected={selected === item.symbol}
                  onClick={() => setSelected(selected === item.symbol ? null : item.symbol)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FICCView({ ficc, loading }) {
  const [activeAsset, setActiveAsset] = useState(null);

  const commodityRows = useMemo(() => {
    const all = ficc?.commodities || [];
    const out = {};
    for (const [group, names] of Object.entries(COMMODITY_GROUPS)) {
      out[group] = all.filter((c) => names.includes(c.name));
    }
    return out;
  }, [ficc]);

  const selectedItem = useMemo(() => {
    if (!activeAsset) return null;
    return [...(ficc?.forex || []), ...(ficc?.commodities || []), ...(ficc?.crypto || []), ...(ficc?.rates || [])].find((i) => i.symbol === activeAsset) || null;
  }, [activeAsset, ficc]);

  if (loading) return <LoadingGrid count={4} />;

  return (
    <div className="space-y-5">
      {selectedItem && (
        <div className="glass-panel rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">{selectedItem.symbol}</div>
              <div className="text-2xl font-semibold tracking-[-0.03em] text-[#f4f0e8]">{selectedItem.name}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tracking-[-0.06em] text-[#f4f0e8]">
                {selectedItem.price?.toLocaleString(undefined, { maximumFractionDigits: 4 })}
              </div>
              <div className={`text-base font-semibold ${pctColor(selectedItem.change_pct)}`}>{fmtPct(selectedItem.change_pct, 3)}</div>
            </div>
          </div>
          <FullLineChart history={selectedItem.history} stroke={selectedItem.change_pct >= 0 ? "#b8f36b" : "#ff7d6b"} name={selectedItem.name} />
          <button type="button" onClick={() => setActiveAsset(null)} className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#70827a] hover:text-[#f4f0e8]">
            Close ×
          </button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        {/* Forex */}
        <div className="glass-panel rounded-[28px] p-5">
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">Forex — G10 + EM</div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/8">
                  {["Pair", "Rate", "Chg%", "30D"].map((h) => (
                    <th key={h} className="pb-2 pr-3 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-[#70827a]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(ficc?.forex || []).map((item) => (
                  <tr
                    key={item.symbol}
                    onClick={() => setActiveAsset(activeAsset === item.symbol ? null : item.symbol)}
                    className="cursor-pointer border-b border-white/4 hover:bg-white/[0.03]"
                  >
                    <td className="py-2 pr-3">
                      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#70827a]">{item.symbol}</div>
                      <div className="text-sm text-[#f4f0e8]">{item.name}</div>
                    </td>
                    <td className="py-2 pr-3 font-mono text-sm text-[#f4f0e8]">
                      {item.price?.toFixed(4) ?? "--"}
                    </td>
                    <td className={`py-2 pr-3 font-mono text-sm font-semibold ${pctColor(item.change_pct)}`}>
                      {fmtPct(item.change_pct, 3)}
                    </td>
                    <td className="py-2">
                      <SparkLine history={item.history} stroke={item.change_pct >= 0 ? "#b8f36b" : "#ff7d6b"} height={28} width={72} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rates + Crypto */}
        <div className="space-y-5">
          <div className="glass-panel rounded-[28px] p-5">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">US Treasury Rates</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Tenor", "Yield", "Chg%", "30D"].map((h) => (
                      <th key={h} className="pb-2 pr-3 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-[#70827a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ficc?.rates || []).map((item) => (
                    <tr
                      key={item.symbol}
                      onClick={() => setActiveAsset(activeAsset === item.symbol ? null : item.symbol)}
                      className="cursor-pointer border-b border-white/4 hover:bg-white/[0.03]"
                    >
                      <td className="py-2 pr-3 text-sm text-[#f4f0e8]">{item.name}</td>
                      <td className="py-2 pr-3 font-mono text-sm text-[#ffbf69]">
                        {item.price != null ? `${item.price.toFixed(3)}%` : "--"}
                      </td>
                      <td className={`py-2 pr-3 font-mono text-sm font-semibold ${pctColor(item.change_pct)}`}>
                        {fmtPct(item.change_pct, 3)}
                      </td>
                      <td className="py-2">
                        <SparkLine history={item.history} stroke="#ffbf69" height={24} width={64} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="glass-panel rounded-[28px] p-5">
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">Crypto</div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/8">
                    {["Asset", "Price", "Chg%", "30D"].map((h) => (
                      <th key={h} className="pb-2 pr-3 text-left font-mono text-[10px] uppercase tracking-[0.2em] text-[#70827a]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(ficc?.crypto || []).map((item) => (
                    <tr
                      key={item.symbol}
                      onClick={() => setActiveAsset(activeAsset === item.symbol ? null : item.symbol)}
                      className="cursor-pointer border-b border-white/4 hover:bg-white/[0.03]"
                    >
                      <td className="py-2 pr-3 text-sm text-[#f4f0e8]">{item.name}</td>
                      <td className="py-2 pr-3 font-mono text-sm text-[#f4f0e8]">
                        {item.price != null ? `$${item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}
                      </td>
                      <td className={`py-2 pr-3 font-mono text-sm font-semibold ${pctColor(item.change_pct)}`}>
                        {fmtPct(item.change_pct)}
                      </td>
                      <td className="py-2">
                        <SparkLine history={item.history} stroke={item.change_pct >= 0 ? "#b8f36b" : "#ff7d6b"} height={24} width={64} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Commodities */}
      <div className="glass-panel rounded-[28px] p-5">
        <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">Commodities</div>
        <div className="grid gap-5 xl:grid-cols-3">
          {Object.entries(commodityRows).map(([group, items]) => (
            <div key={group}>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#5a6b63]">{group}</div>
              <div className="space-y-2">
                {items.map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onClick={() => setActiveAsset(activeAsset === item.symbol ? null : item.symbol)}
                    className={`flex w-full items-center justify-between rounded-[14px] border p-3 transition ${pctBg(item.change_pct)} hover:bg-white/[0.05]`}
                  >
                    <div className="text-left">
                      <div className="text-sm text-[#f4f0e8]">{item.name}</div>
                      <div className="font-mono text-[10px] text-[#70827a]">{item.symbol}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-[#f4f0e8]">
                        {item.price != null ? `$${item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "--"}
                      </div>
                      <div className={`font-mono text-xs font-semibold ${pctColor(item.change_pct)}`}>
                        {fmtPct(item.change_pct)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShippingView({ ficc, loading }) {
  const [selected, setSelected] = useState(null);

  if (loading) return <LoadingGrid count={3} />;

  const selectedItem = selected ? (ficc?.shipping || []).find((i) => i.symbol === selected) : null;

  return (
    <div className="space-y-5">
      {selectedItem && (
        <div className="glass-panel rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">{selectedItem.symbol}</div>
              <div className="text-2xl font-semibold tracking-[-0.03em] text-[#f4f0e8]">{selectedItem.name}</div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-semibold tracking-[-0.06em] text-[#f4f0e8]">
                ${selectedItem.price?.toFixed(2) ?? "--"}
              </div>
              <div className={`text-base font-semibold ${pctColor(selectedItem.change_pct)}`}>{fmtPct(selectedItem.change_pct)}</div>
            </div>
          </div>
          <FullLineChart history={selectedItem.history} stroke={selectedItem.change_pct >= 0 ? "#b8f36b" : "#ff7d6b"} name={selectedItem.name} />
          <button type="button" onClick={() => setSelected(null)} className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-[#70827a] hover:text-[#f4f0e8]">
            Close ×
          </button>
        </div>
      )}

      <div className="glass-panel rounded-[28px] p-5">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">Shipping & Maritime</div>
        <p className="mb-4 text-sm text-[#70827a]">
          Dry bulk, container, and tanker proxies. Click any row to see the 30-day price chart.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(ficc?.shipping || []).map((item) => (
            <button
              key={item.symbol}
              type="button"
              onClick={() => setSelected(selected === item.symbol ? null : item.symbol)}
              className={`rounded-[18px] border p-4 text-left transition ${
                selected === item.symbol ? "border-white/20 bg-white/8" : `${pctBg(item.change_pct)} hover:bg-white/[0.05]`
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#70827a]">{item.symbol}</div>
                  <div className="mt-0.5 text-sm font-semibold text-[#f4f0e8]">{item.name}</div>
                </div>
                <SparkLine history={item.history} stroke={item.change_pct >= 0 ? "#b8f36b" : "#ff7d6b"} height={32} width={64} />
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div className="font-mono text-lg font-semibold text-[#f4f0e8]">
                  ${item.price?.toFixed(2) ?? "--"}
                </div>
                <div className={`font-mono text-sm font-semibold ${pctColor(item.change_pct)}`}>
                  {fmtPct(item.change_pct)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="glass-panel rounded-[28px] p-5">
        <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.24em] text-[#76867f]">Baltic & Freight Context</div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "BDRY ETF", desc: "Breakwave Dry Bulk Shipping ETF tracks the near-curve of dry bulk freight futures (Capesize, Panamax, Supramax)." },
            { label: "Crude Tanker Proxy", desc: "VLCC spot rates inversely correlated with oil supply. Rising rates = tight tonnage = higher freight costs for importers." },
            { label: "Container Shipping", desc: "ZIM and MATX reflect trans-Pacific and near-shore container demand. High correlation to trade volumes and retail inventory cycles." },
          ].map(({ label, desc }) => (
            <div key={label} className="rounded-[18px] border border-white/8 bg-[#0b1714] p-4">
              <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.22em] text-[#70827a]">{label}</div>
              <p className="text-sm leading-6 text-[#93a49c]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoadingGrid({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-32 animate-pulse rounded-[22px] bg-white/[0.04]" />
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const TABS = ["World Markets", "FICC", "Shipping"];

export default function MarketsPage() {
  const [activeTab, setActiveTab] = useState("World Markets");
  const [overview, setOverview] = useState(null);
  const [ficc, setFicc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [ovRes, ficcRes] = await Promise.all([
          fetch("/api/market-overview"),
          fetch("/api/ficc"),
        ]);
        const [ovData, ficcData] = await Promise.all([ovRes.json(), ficcRes.json()]);
        setOverview(ovData);
        setFicc(ficcData);
      } catch (err) {
        setError(err?.message || "Failed to load market data.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main className="sentirion-grid min-h-screen px-4 py-5 text-white sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5">
        {/* Header */}
        <header className="glass-panel dashboard-fade rounded-[30px] px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-[#76867f]">
                Sentirion · Global Markets Terminal
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-[#f4f0e8]">
                {activeTab}
              </h1>
              {ficc?.generated_at && (
                <div className="mt-1 font-mono text-[10px] text-[#4d5e56]">
                  Updated {new Date(ficc.generated_at).toLocaleTimeString()}
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="flex flex-wrap gap-3">
              {(overview?.indices || []).slice(0, 4).map((idx) => (
                <div key={idx.symbol} className="rounded-[18px] border border-white/8 bg-white/[0.04] px-4 py-3 text-center">
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#70827a]">{idx.name}</div>
                  <div className="mt-1 font-mono text-base font-semibold text-[#f4f0e8]">{fmtCompact(idx.price)}</div>
                  <div className={`font-mono text-xs font-semibold ${pctColor(idx.change_pct)}`}>{fmtPct(idx.change_pct)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-full px-5 py-2 font-mono text-[11px] uppercase tracking-[0.2em] transition ${
                  activeTab === tab
                    ? "bg-[#b8f36b] text-[#09110f]"
                    : "border border-white/10 bg-white/5 text-[#76867f] hover:border-[#b8f36b]/30 hover:bg-[#b8f36b]/10 hover:text-white"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <div className="glass-panel dashboard-fade rounded-[24px] border border-[#ff7d6b]/20 px-6 py-4 text-sm text-[#ffd4ce]">
            {error}
          </div>
        )}

        {activeTab === "World Markets" && (
          <WorldMarketsView overview={overview} ficc={ficc} loading={loading} />
        )}
        {activeTab === "FICC" && (
          <FICCView ficc={ficc} loading={loading} />
        )}
        {activeTab === "Shipping" && (
          <ShippingView ficc={ficc} loading={loading} />
        )}
      </div>
    </main>
  );
}
