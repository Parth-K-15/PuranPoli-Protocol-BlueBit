import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { analyticsApi } from "../services/api";

/* ───────── Constants ───────── */
const MAHARASHTRA_TOPO = "/maharashtra.topo.json";

const SUPPLY_CHAIN_PARAMS = [
  { key: "demand", label: "Demand Index", icon: "trending_up", unit: "" },
  { key: "supply", label: "Supply Volume", icon: "inventory_2", unit: "MT" },
  { key: "fulfillment", label: "Fulfillment Rate", icon: "check_circle", unit: "%" },
  { key: "inventory", label: "Inventory Level", icon: "warehouse", unit: "units" },
  { key: "leadTime", label: "Lead Time", icon: "schedule", unit: "days" },
  { key: "risk", label: "Risk Score", icon: "warning", unit: "" },
];

const COLOR_RANGES = {
  demand: ["#e0f4f1", "#b2dfdb", "#80cbc4", "#4db6ac", "#26a69a", "#009688", "#00897b", "#00796b", "#00695c"],
  supply: ["#e8eaf6", "#c5cae9", "#9fa8da", "#7986cb", "#5c6bc0", "#3f51b5", "#3949ab", "#303f9f", "#283593"],
  fulfillment: ["#e8f5e9", "#c8e6c9", "#a5d6a7", "#81c784", "#66bb6a", "#4caf50", "#43a047", "#388e3c", "#2e7d32"],
  inventory: ["#fff3e0", "#ffe0b2", "#ffcc80", "#ffb74d", "#ffa726", "#ff9800", "#fb8c00", "#f57c00", "#ef6c00"],
  leadTime: ["#fce4ec", "#f8bbd0", "#f48fb1", "#f06292", "#ec407a", "#e91e63", "#d81b60", "#c2185b", "#ad1457"],
  risk: ["#e0f7fa", "#b2ebf2", "#80deea", "#4dd0e1", "#26c6da", "#00bcd4", "#00acc1", "#0097a7", "#00838f"],
};

/* Major cities with approximate lon/lat within Maharashtra */
const MAHARASHTRA_CITIES = [
  { name: "Mumbai", lat: 19.076, lon: 72.8777, district: "Mumbai" },
  { name: "Pune", lat: 18.5204, lon: 73.8567, district: "Pune" },
  { name: "Nagpur", lat: 21.1458, lon: 79.0882, district: "Nagpur" },
  { name: "Nashik", lat: 19.9975, lon: 73.7898, district: "Nashik" },
  { name: "Aurangabad", lat: 19.8762, lon: 75.3433, district: "Aurangabad" },
  { name: "Solapur", lat: 17.6599, lon: 75.9064, district: "Solapur" },
  { name: "Kolhapur", lat: 16.705, lon: 74.2433, district: "Kolhapur" },
  { name: "Thane", lat: 19.2183, lon: 72.9781, district: "Thane" },
  { name: "Amravati", lat: 20.932, lon: 77.7523, district: "Amravati" },
  { name: "Nanded", lat: 19.1383, lon: 77.321, district: "Nanded" },
  { name: "Latur", lat: 18.3916, lon: 76.5604, district: "Latur" },
  { name: "Akola", lat: 20.707, lon: 77.0025, district: "Akola" },
  { name: "Jalgaon", lat: 21.0077, lon: 75.5626, district: "Jalgaon" },
  { name: "Satara", lat: 17.68, lon: 74.0183, district: "Satara" },
  { name: "Ratnagiri", lat: 16.9902, lon: 73.312, district: "Ratnagiri" },
  { name: "Chandrapur", lat: 19.9615, lon: 79.2961, district: "Chandrapur" },
];

/* Districts list with dt_code mapping */
const DISTRICTS = [
  { code: "507", name: "Gondia" },
  { code: "506", name: "Bhandara" },
  { code: "499", name: "Jalgaon" },
  { code: "504", name: "Wardha" },
  { code: "500", name: "Buldhana" },
  { code: "501", name: "Akola" },
  { code: "516", name: "Nashik" },
  { code: "508", name: "Gadchiroli" },
  { code: "502", name: "Washim" },
  { code: "509", name: "Chandrapur" },
  { code: "510", name: "Yavatmal" },
  { code: "514", name: "Jalna" },
  { code: "522", name: "Ahmednagar" },
  { code: "512", name: "Hingoli" },
  { code: "511", name: "Nanded" },
  { code: "513", name: "Parbhani" },
  { code: "521", name: "Pune" },
  { code: "523", name: "Beed" },
  { code: "519", name: "Mumbai" },
  { code: "524", name: "Latur" },
  { code: "525", name: "Osmanabad" },
  { code: "526", name: "Solapur" },
  { code: "527", name: "Satara" },
  { code: "528", name: "Ratnagiri" },
  { code: "531", name: "Sangli" },
  { code: "530", name: "Kolhapur" },
  { code: "529", name: "Sindhudurg" },
  { code: "517", name: "Thane" },
  { code: "732", name: "Palghar" },
  { code: "497", name: "Nandurbar" },
  { code: "503", name: "Amravati" },
  { code: "498", name: "Dhule" },
  { code: "505", name: "Nagpur" },
  { code: "515", name: "Aurangabad" },
  { code: "520", name: "Raigad" },
];

/* ───────── Demand Forecast Constants ───────── */
const PRODUCT_LIST = [
  "Paracetamol", "Azithromycin", "ORS Sachets", "Cetirizine",
  "Metformin", "Insulin Glargine", "Omeprazole", "Amoxicillin",
  "Vitamin D3", "Ibuprofen",
];

const WEEKS_OPTIONS = [1, 2, 4, 8, 12];

/* ───────── Mock data generator ───────── */
const rand = (min, max) => Math.round(min + Math.random() * (max - min));

function generateDistrictData() {
  const data = {};
  DISTRICTS.forEach((d) => {
    data[d.code] = {
      district: d.name,
      demand: rand(15, 98),
      supply: rand(200, 5000),
      fulfillment: rand(40, 99),
      inventory: rand(500, 12000),
      leadTime: rand(1, 30),
      risk: rand(5, 95),
    };
  });
  return data;
}

/* ───────── Subcomponents ───────── */

function ParamSelector({ params, active, onSelect }) {
  return (
    <div className="flex flex-wrap gap-2">
      {params.map((p) => (
        <button
          key={p.key}
          onClick={() => onSelect(p.key)}
          className={`group flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all duration-300 ${
            active === p.key
              ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-lg shadow-teal-500/25"
              : "border border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:text-teal-600 hover:shadow-sm"
          }`}
        >
          <span
            className={`material-symbols-outlined text-[16px] transition-transform duration-300 group-hover:scale-110 ${
              active === p.key ? "text-white" : "text-slate-400 group-hover:text-teal-500"
            }`}
          >
            {p.icon}
          </span>
          {p.label}
        </button>
      ))}
    </div>
  );
}

function GradientLegend({ colors, min, max, label }) {
  const gradient = `linear-gradient(to right, ${colors.join(", ")})`;
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {label}
      </span>
      <div
        className="h-3 w-full rounded-full"
        style={{ background: gradient }}
      />
      <div className="flex justify-between text-[10px] font-semibold text-slate-500">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function StatsCard({ icon, label, value, trend, color }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <div className="absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-10" style={{ background: color }} />
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl"
          style={{ background: `${color}18` }}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ color }}>
            {icon}
          </span>
        </div>
        <div>
          <p className="text-lg font-black text-slate-800">{value}</p>
          <p className="text-[10px] font-medium text-slate-400">{label}</p>
        </div>
      </div>
      {trend !== undefined && (
        <div className={`mt-2 flex items-center gap-1 text-[10px] font-bold ${trend >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
          <span className="material-symbols-outlined text-[12px]">
            {trend >= 0 ? "trending_up" : "trending_down"}
          </span>
          {Math.abs(trend)}% vs last week
        </div>
      )}
    </div>
  );
}

function DistrictDetailPanel({ district, data, onClose, paramKey, isDemandMode }) {
  if (!district || !data) return null;
  const param = SUPPLY_CHAIN_PARAMS.find((p) => p.key === paramKey);

  return (
    <div
      className="animate-slideIn absolute right-4 top-4 z-20 w-80 overflow-hidden rounded-2xl border border-slate-100 bg-white/95 shadow-2xl backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-teal-500 to-emerald-500 px-5 py-4">
        <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/10" />
        <div className="absolute -right-2 bottom-0 h-12 w-12 rounded-full bg-white/5" />
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">{district}</h3>
            <p className="text-[10px] font-medium text-teal-100">Maharashtra, India</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      </div>

      {/* Demand forecast detail */}
      {isDemandMode && data._hasForecast ? (
        <>
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-teal-500">trending_up</span>
                <span className="text-xs font-semibold text-slate-600">Predicted Demand</span>
              </div>
              <span className="text-xl font-black text-slate-800">
                {data.predicted_units} <span className="text-xs font-medium text-slate-400">units</span>
              </span>
            </div>
          </div>
          <div className="space-y-3 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Demand Index</span>
              <span className="text-xs font-bold text-slate-700">{data.demand_index !== null ? (data.demand_index * 100).toFixed(1) + "%" : "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Demand Level</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                data.demand_level === "high" ? "bg-rose-50 text-rose-600" :
                data.demand_level === "medium" ? "bg-amber-50 text-amber-600" :
                "bg-emerald-50 text-emerald-600"
              }`}>{data.demand_level}</span>
            </div>
            {data.city && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">Forecast City</span>
                <span className="text-xs font-bold text-slate-700">{data.city}</span>
              </div>
            )}
          </div>
          {/* Demand bar */}
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Demand Intensity</span>
              <span className={`text-xs font-bold ${
                data.demand_level === "high" ? "text-rose-500" :
                data.demand_level === "medium" ? "text-amber-500" :
                "text-emerald-500"
              }`}>{data.demand_level === "high" ? "High" : data.demand_level === "medium" ? "Moderate" : "Low"}</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${(data.demand_index || 0) * 100}%`,
                  background: data.demand_level === "high"
                    ? "linear-gradient(90deg, #ef4444, #f87171)"
                    : data.demand_level === "medium"
                    ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                    : "linear-gradient(90deg, #10b981, #34d399)",
                }}
              />
            </div>
          </div>
        </>
      ) : isDemandMode && !data._hasForecast ? (
        <div className="px-5 py-8 text-center">
          <span className="material-symbols-outlined text-[32px] text-slate-300">info</span>
          <p className="mt-2 text-xs text-slate-400">No forecast data available for this district</p>
        </div>
      ) : (
        <>
          {/* Highlighted param */}
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-teal-500">{param?.icon}</span>
                <span className="text-xs font-semibold text-slate-600">{param?.label}</span>
              </div>
              <span className="text-xl font-black text-slate-800">
                {data[paramKey]}{param?.unit && <span className="text-xs font-medium text-slate-400 ml-1">{param.unit}</span>}
              </span>
            </div>
          </div>

          {/* All metrics */}
          <div className="space-y-3 px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">All Metrics</p>
            {SUPPLY_CHAIN_PARAMS.filter((p) => p.key !== paramKey).map((p) => (
              <div key={p.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-slate-400">
                    {p.icon}
                  </span>
                  <span className="text-xs text-slate-500">{p.label}</span>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {data[p.key]} {p.unit}
                </span>
              </div>
            ))}
          </div>

          {/* Supply chain health bar */}
          <div className="border-t border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Supply Chain Health
              </span>
              <span className={`text-xs font-bold ${data.fulfillment > 70 ? "text-emerald-500" : data.fulfillment > 50 ? "text-amber-500" : "text-rose-500"}`}>
                {data.fulfillment > 70 ? "Healthy" : data.fulfillment > 50 ? "Moderate" : "Critical"}
              </span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-2 rounded-full transition-all duration-700"
                style={{
                  width: `${data.fulfillment}%`,
                  background:
                    data.fulfillment > 70
                      ? "linear-gradient(90deg, #10b981, #34d399)"
                      : data.fulfillment > 50
                      ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                      : "linear-gradient(90deg, #ef4444, #f87171)",
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ───────── MAIN PAGE ───────── */
export default function HeatmapPage() {
  const [activeParam, setActiveParam] = useState("demand");
  const [districtData, setDistrictData] = useState(() => generateDistrictData());
  const [tooltipContent, setTooltipContent] = useState("");
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [zoom, setZoom] = useState(1);

  // Demand forecast state
  const [selectedProduct, setSelectedProduct] = useState("Paracetamol");
  const [weeksAhead, setWeeksAhead] = useState(1);
  const [forecastData, setForecastData] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState(null);

  // Disable live mode when switching to demand
  useEffect(() => {
    if (activeParam === "demand") setIsLive(false);
  }, [activeParam]);

  // Simulated live update (non-demand params only)
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => {
      setDistrictData(generateDistrictData());
      setLastUpdated(new Date());
    }, 5000);
    return () => clearInterval(interval);
  }, [isLive]);

  // Fetch demand forecast
  useEffect(() => {
    if (activeParam !== "demand") return;

    let cancelled = false;
    setForecastLoading(true);
    setForecastError(null);

    analyticsApi
      .getDemandForecast(selectedProduct, weeksAhead)
      .then((res) => {
        if (cancelled) return;
        setForecastData(res);
        setForecastLoading(false);
        setLastUpdated(new Date());
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Demand forecast fetch failed:", err);
        setForecastError(err.response?.data?.detail || err.message || "Failed to load forecast");
        setForecastLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeParam, selectedProduct, weeksAhead]);

  // Build district data from forecast response — aggregate across all weeks
  const forecastDistrictData = useMemo(() => {
    if (activeParam !== "demand" || !forecastData?.forecasts?.length) return null;

    // Aggregate predicted_units across ALL forecast weeks per district
    const aggregated = {}; // district_code -> { totalUnits, city, lat, lng }

    for (const weekData of forecastData.forecasts) {
      for (const city of weekData.cities) {
        const code = city.district_code;
        if (!code) continue;

        if (!aggregated[code]) {
          aggregated[code] = {
            totalUnits: 0,
            city: city.city,
            lat: city.lat,
            lng: city.lng,
          };
        }
        // For duplicate district codes in same week, keep higher value
        aggregated[code].totalUnits += city.predicted_units;
      }
    }

    // Determine demand level from absolute predicted_units
    const allUnits = Object.values(aggregated).map((a) => a.totalUnits);
    const maxUnits = Math.max(...allUnits, 1);

    const demandLevel = (units) => {
      const ratio = units / maxUnits;
      if (ratio >= 0.66) return "high";
      if (ratio >= 0.33) return "medium";
      return "low";
    };

    const data = {};
    DISTRICTS.forEach((d) => {
      const agg = aggregated[d.code];
      if (agg) {
        data[d.code] = {
          district: d.name,
          demand: agg.totalUnits,
          demand_index: agg.totalUnits / maxUnits,
          demand_level: demandLevel(agg.totalUnits),
          predicted_units: agg.totalUnits,
          city: agg.city,
          _hasForecast: true,
        };
      } else {
        data[d.code] = {
          district: d.name,
          demand: null,
          demand_index: null,
          demand_level: null,
          predicted_units: null,
          city: null,
          _hasForecast: false,
        };
      }
    });
    return data;
  }, [activeParam, forecastData]);

  // Use forecast data when demand param is active, else mock data
  const isDemandMode = activeParam === "demand" && forecastDistrictData !== null;
  const effectiveData = isDemandMode ? forecastDistrictData : districtData;

  const colorRange = COLOR_RANGES[activeParam];
  const values = Object.values(effectiveData)
    .map((d) => d[activeParam])
    .filter((v) => v !== null && v !== undefined);
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 100;

  const colorScale = useMemo(() => {
    const steps = colorRange.length;
    const domain = colorRange.map((_, i) => minVal + (i / (steps - 1)) * (maxVal - minVal));
    return scaleLinear().domain(domain).range(colorRange).clamp(true);
  }, [minVal, maxVal, colorRange]);

  const handleMouseEnter = useCallback(
    (geo, e) => {
      const code = geo.properties.dt_code;
      const d = effectiveData[code];
      if (d) {
        if (isDemandMode && d._hasForecast) {
          setTooltipContent(`${d.district}: ${d.predicted_units} units (${d.demand_level})`);
        } else if (isDemandMode && !d._hasForecast) {
          setTooltipContent(`${d.district}: No forecast data`);
        } else {
          const param = SUPPLY_CHAIN_PARAMS.find((p) => p.key === activeParam);
          setTooltipContent(`${d.district}: ${d[activeParam]}${param?.unit ? " " + param.unit : ""}`);
        }
      } else {
        setTooltipContent(geo.properties.district || "Unknown");
      }
      setTooltipPos({ x: e.clientX, y: e.clientY });
    },
    [effectiveData, activeParam, isDemandMode]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltipContent("");
  }, []);

  const handleDistrictClick = useCallback(
    (geo) => {
      const code = geo.properties.dt_code;
      const d = effectiveData[code];
      if (d) setSelectedDistrict({ name: d.district, code, data: d });
    },
    [effectiveData]
  );

  const handleRefresh = () => {
    if (isDemandMode) {
      // Re-trigger forecast fetch by toggling a dummy state
      setForecastData(null);
      setWeeksAhead((w) => w); // no-op to preserve value
      // Force re-fetch by temporarily clearing
      const product = selectedProduct;
      setSelectedProduct("");
      setTimeout(() => setSelectedProduct(product), 0);
    } else {
      setDistrictData(generateDistrictData());
    }
    setLastUpdated(new Date());
  };

  /* Summary stats */
  const coveredEntries = Object.entries(effectiveData)
    .filter(([, d]) => d[activeParam] !== null && d[activeParam] !== undefined);
  const coveredValues = coveredEntries.map(([, d]) => d[activeParam]);
  const avgVal = coveredValues.length > 0
    ? Math.round(coveredValues.reduce((a, b) => a + b, 0) / coveredValues.length)
    : 0;
  const sortedEntries = [...coveredEntries].sort((a, b) => b[1][activeParam] - a[1][activeParam]);
  const topDistrict = sortedEntries[0];
  const lowDistrict = sortedEntries[sortedEntries.length - 1];
  const activeParamInfo = SUPPLY_CHAIN_PARAMS.find((p) => p.key === activeParam);
  const coveredCount = isDemandMode
    ? Object.values(forecastDistrictData).filter((d) => d._hasForecast).length
    : DISTRICTS.length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8" style={{ background: "linear-gradient(135deg, #f0fdf9 0%, #f0f9ff 50%, #faf5ff 100%)", minHeight: "100%" }}>
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-500 shadow-lg shadow-teal-500/20">
              <span className="material-symbols-outlined text-[18px] text-white">map</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">Supply Chain Heatmap</h1>
          </div>
          <p className="text-sm text-slate-500">
            Maharashtra district-level supply chain analytics &amp; demand forecasting
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Live toggle (hidden in demand mode) */}
          {activeParam !== "demand" && (
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-all duration-300 ${
                isLive
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/25"
                  : "border border-slate-200 bg-white text-slate-500 hover:border-emerald-300"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${isLive ? "animate-pulse bg-white" : "bg-slate-300"}`} />
              {isLive ? "Live" : "Paused"}
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-500 transition-all hover:border-teal-300 hover:text-teal-600 hover:shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span>
            Refresh
          </button>

          {/* Last updated */}
          <div className="hidden items-center gap-1.5 rounded-xl bg-white/60 px-3 py-2 text-[10px] font-medium text-slate-400 backdrop-blur-sm sm:flex">
            <span className="material-symbols-outlined text-[12px]">schedule</span>
            Updated {lastUpdated.toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Parameter Selector */}
      <ParamSelector params={SUPPLY_CHAIN_PARAMS} active={activeParam} onSelect={setActiveParam} />

      {/* Demand Forecast Controls */}
      {activeParam === "demand" && (
        <div className="flex flex-wrap items-center gap-4">
          {/* Product selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Product:</span>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-teal-300 focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/20"
            >
              {PRODUCT_LIST.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* Weeks ahead selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">Forecast:</span>
            <div className="flex gap-1">
              {WEEKS_OPTIONS.map((w) => (
                <button
                  key={w}
                  onClick={() => setWeeksAhead(w)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    weeksAhead === w
                      ? "bg-teal-500 text-white shadow-sm"
                      : "border border-slate-200 bg-white text-slate-500 hover:border-teal-300"
                  }`}
                >
                  {w}W
                </button>
              ))}
            </div>
          </div>

          {/* Forecast week label */}
          {forecastData?.forecasts?.length > 0 && (
            <span className="rounded-full bg-teal-50 px-3 py-1 text-[10px] font-bold text-teal-600">
              {forecastData.forecasts.length === 1
                ? `Week: ${forecastData.forecasts[0].forecast_week}`
                : `Weeks: ${forecastData.forecasts[0].forecast_week} — ${forecastData.forecasts[forecastData.forecasts.length - 1].forecast_week}`}
            </span>
          )}

          {/* Loading indicator */}
          {forecastLoading && (
            <span className="text-[10px] font-medium text-slate-400 animate-pulse">
              Loading forecast...
            </span>
          )}

          {/* Error indicator */}
          {forecastError && (
            <span className="text-[10px] font-medium text-rose-500">
              {forecastError}
            </span>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatsCard
          icon="analytics"
          label={isDemandMode ? `Avg Demand (${selectedProduct}, ${weeksAhead}W)` : `Avg ${activeParamInfo?.label}`}
          value={isDemandMode ? `${avgVal} units` : `${avgVal}${activeParamInfo?.unit ? " " + activeParamInfo.unit : ""}`}
          color="#14b8a6"
        />
        <StatsCard icon="arrow_upward" label="Highest District" value={topDistrict?.[1]?.district || "—"} color="#6366f1" />
        <StatsCard icon="arrow_downward" label="Lowest District" value={lowDistrict?.[1]?.district || "—"} color="#f43f5e" />
        <StatsCard
          icon="location_on"
          label={isDemandMode ? "Districts with Data" : "Active Districts"}
          value={isDemandMode ? `${coveredCount}/${DISTRICTS.length}` : DISTRICTS.length}
          color="#f59e0b"
        />
      </div>

      {/* Map + Sidebar layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Map container */}
        <div className="relative lg:col-span-3">
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm" style={{ minHeight: 520 }}>
            {/* Map toolbar */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-teal-500">public</span>
                <span className="text-xs font-bold text-slate-700">Maharashtra, India</span>
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[9px] font-bold text-teal-600">
                  {isDemandMode ? `${coveredCount}/${DISTRICTS.length} Districts` : `${DISTRICTS.length} Districts`}
                </span>
                {isDemandMode && (
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-indigo-600">
                    ML Forecast
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setZoom((z) => Math.min(z * 1.3, 8))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
                <button
                  onClick={() => setZoom((z) => Math.max(z / 1.3, 1))}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <button
                  onClick={() => setZoom(1)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[16px]">fit_screen</span>
                </button>
              </div>
            </div>

            {/* Actual map */}
            <div className="relative" style={{ height: 460 }}>
              <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                  scale: 3800,
                  center: [76.5, 19.5],
                }}
                width={800}
                height={460}
                style={{ width: "100%", height: "100%" }}
              >
                <ZoomableGroup zoom={zoom} center={[76.5, 19.5]}>
                  <Geographies geography={MAHARASHTRA_TOPO}>
                    {({ geographies }) =>
                      geographies.map((geo) => {
                        const code = geo.properties.dt_code;
                        const d = effectiveData[code];
                        const value = d?.[activeParam];
                        const isSelected = selectedDistrict?.code === code;
                        const noData = isDemandMode && d && !d._hasForecast;

                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={
                              noData
                                ? "#f1f5f9"
                                : value !== undefined && value !== null
                                ? colorScale(value)
                                : "#e2e8f0"
                            }
                            stroke={isSelected ? "#0d9488" : noData ? "#e2e8f0" : "#fff"}
                            strokeWidth={isSelected ? 2 : 0.6}
                            style={{
                              default: {
                                outline: "none",
                                transition: "all 300ms",
                              },
                              hover: {
                                fill: noData ? "#e2e8f0" : "#5eead4",
                                outline: "none",
                                cursor: "pointer",
                                strokeWidth: 1.5,
                                stroke: "#0d9488",
                              },
                              pressed: {
                                outline: "none",
                              },
                            }}
                            onMouseEnter={(e) => handleMouseEnter(geo, e)}
                            onMouseLeave={handleMouseLeave}
                            onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                            onClick={() => handleDistrictClick(geo)}
                          />
                        );
                      })
                    }
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>

              {/* Tooltip */}
              {tooltipContent && (
                <div
                  className="pointer-events-none fixed z-50 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white shadow-xl"
                  style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 28 }}
                >
                  {tooltipContent}
                  <div className="absolute -bottom-1 left-3 h-2 w-2 rotate-45 bg-slate-800" />
                </div>
              )}

              {/* Detail panel */}
              {selectedDistrict && (
                <DistrictDetailPanel
                  district={selectedDistrict.name}
                  data={selectedDistrict.data}
                  paramKey={activeParam}
                  isDemandMode={isDemandMode}
                  onClose={() => setSelectedDistrict(null)}
                />
              )}
            </div>

            {/* Legend */}
            <div className="border-t border-slate-100 px-5 py-3">
              <GradientLegend
                colors={colorRange}
                min={isDemandMode ? "Low" : minVal}
                max={isDemandMode ? "High" : maxVal}
                label={isDemandMode ? `${selectedProduct} — Demand Forecast` : (activeParamInfo?.label || "Value")}
              />
            </div>
          </div>
        </div>

        {/* Sidebar: District rankings */}
        <div className="flex flex-col gap-4">
          {/* Top districts */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <span className="material-symbols-outlined text-[14px] text-emerald-500">leaderboard</span>
              {isDemandMode ? "Top Demand Districts" : "Top Districts"}
            </h3>
            <div className="space-y-2">
              {sortedEntries
                .slice(0, 8)
                .map(([code, d], i) => {
                  const pct = maxVal > 0 ? Math.round((d[activeParam] / maxVal) * 100) : 0;
                  const displayValue = isDemandMode && d.predicted_units
                    ? `${d.predicted_units} units`
                    : `${d[activeParam]}${activeParamInfo?.unit ? " " + activeParamInfo.unit : ""}`;
                  return (
                    <div
                      key={code}
                      className="group cursor-pointer rounded-xl px-3 py-2 transition-all hover:bg-teal-50/50"
                      onClick={() => setSelectedDistrict({ name: d.district, code, data: d })}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-black ${
                              i < 3
                                ? "bg-gradient-to-br from-teal-500 to-emerald-500 text-white"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="text-xs font-medium text-slate-700 group-hover:text-teal-700">
                            {d.district}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-600">
                          {displayValue}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${colorRange[2]}, ${colorRange[6]})`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Key cities */}
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
              <span className="material-symbols-outlined text-[14px] text-indigo-500">location_city</span>
              Key Cities
            </h3>
            <div className="space-y-2">
              {MAHARASHTRA_CITIES.slice(0, 8).map((city) => {
                const distEntry = Object.entries(effectiveData).find(
                  ([, d]) => d.district === city.district
                );
                const d = distEntry ? distEntry[1] : null;
                const val = isDemandMode && d?._hasForecast
                  ? `${d.predicted_units} units`
                  : isDemandMode && d && !d._hasForecast
                  ? "—"
                  : d ? d[activeParam] : "—";
                return (
                  <div
                    key={city.name}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[14px] text-slate-300">
                        location_on
                      </span>
                      <span className="text-xs text-slate-600">{city.name}</span>
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {val}
                      {!isDemandMode && activeParamInfo?.unit && typeof val === "number" && (
                        <span className="ml-0.5 text-[9px] font-normal text-slate-400">{activeParamInfo.unit}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick info */}
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-5">
            <div className="mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-teal-600">info</span>
              <span className="text-xs font-bold text-teal-700">About this Heatmap</span>
            </div>
            <p className="text-[11px] leading-relaxed text-teal-600/80">
              {isDemandMode ? (
                <>
                  Showing <strong>ML-powered demand forecasts</strong> for <strong>{selectedProduct}</strong> across
                  Maharashtra ({weeksAhead}W total). {coveredCount} of {DISTRICTS.length} districts have forecast coverage.
                  Gray districts lack prediction data. Colors reflect absolute predicted units.
                </>
              ) : (
                <>
                  Visualizing real-time supply chain parameters across Maharashtra's {DISTRICTS.length} districts.
                  Click on any district for detailed metrics. Toggle <strong>Live</strong> mode for auto-refreshing data
                  every 5 seconds.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slideIn {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
