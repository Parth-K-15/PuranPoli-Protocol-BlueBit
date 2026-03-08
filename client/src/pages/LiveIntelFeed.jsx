import { useEffect, useState } from "react";
import {
  Newspaper,
  CloudRain,
  Rss,
  RefreshCw,
  ExternalLink,
  ThermometerSun,
  Wind,
  Droplets,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Spinner from "../components/Spinner";

const PAGE_SIZE = 15;

const API_BASE = "/api/v1";

export default function LiveIntelFeed() {
  const [tab, setTab] = useState("news");
  const [newsData, setNewsData] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [googleNewsData, setGoogleNewsData] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchRawData = async (source) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/disruptions/live/${source}`);
      const json = await res.json();
      if (source === "news") setNewsData(json.data);
      if (source === "weather") setWeatherData(json.data);
      if (source === "google-news") setGoogleNewsData(json.data);
    } catch (err) {
      console.error(`Failed to fetch ${source}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRawData(tab);
  }, [tab]);

  const tabs = [
    { key: "news", label: "News API", icon: Newspaper },
    { key: "weather", label: "Weather", icon: CloudRain },
    { key: "google-news", label: "Google News", icon: Rss },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Live Intelligence Feed</h1>
        <p className="text-sm text-gray-500 mt-1">
          Raw data fetched directly from external APIs — unprocessed signal view.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}

        <button
          onClick={() => fetchRawData(tab)}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-gray-800/60 transition"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <Spinner />
      ) : (
        <>
          {tab === "news" && <NewsTab data={newsData} />}
          {tab === "weather" && <WeatherTab data={weatherData} />}
          {tab === "google-news" && <GoogleNewsTab data={googleNewsData} />}
        </>
      )}
    </div>
  );
}

/* ── News Tab ──────────────────────────────────────────────────────────────── */

function NewsTab({ data }) {
  const [page, setPage] = useState(1);
  if (!data || data.length === 0) return <EmptyState label="news articles" />;

  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {paged.map((article, i) => (
        <div
          key={i}
          className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:bg-gray-800/30 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium text-white leading-snug">
                {article.title}
              </h3>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {article.description}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                <span>{article.source?.name || article.source}</span>
                <span>
                  {article.publishedAt
                    ? new Date(article.publishedAt).toLocaleString()
                    : ""}
                </span>
              </div>
            </div>
            {article.urlToImage && (
              <img
                src={article.urlToImage}
                alt=""
                className="h-16 w-24 rounded-lg object-cover shrink-0"
              />
            )}
          </div>
          {article.url && (
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-400 hover:text-cyan-300"
            >
              Read full article <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

/* ── Weather Tab ───────────────────────────────────────────────────────────── */

function WeatherTab({ data }) {
  if (!data || data.length === 0) return <EmptyState label="weather data" />;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {data.map((item, i) => {
        const w = item.weather;
        const loc = item.location;
        return (
          <div
            key={i}
            className="bg-gray-900/60 border border-gray-800 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-white">{loc.city}</h3>
                <p className="text-xs text-gray-500">{loc.country}</p>
              </div>
              {w?.weather?.[0]?.icon && (
                <img
                  src={`https://openweathermap.org/img/wn/${w.weather[0].icon}@2x.png`}
                  alt={w.weather[0].description}
                  className="h-10 w-10"
                />
              )}
            </div>
            <p className="text-xs text-gray-400 capitalize mb-3">
              {w?.weather?.[0]?.description || "N/A"}
            </p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <WeatherStat
                icon={ThermometerSun}
                label="Temp"
                value={`${w?.main?.temp ?? "-"}°C`}
              />
              <WeatherStat
                icon={Wind}
                label="Wind"
                value={`${w?.wind?.speed ?? "-"} m/s`}
              />
              <WeatherStat
                icon={Droplets}
                label="Humidity"
                value={`${w?.main?.humidity ?? "-"}%`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeatherStat({ icon: Icon, label, value }) {
  return (
    <div className="bg-gray-800/40 rounded-lg p-2">
      <Icon className="h-3.5 w-3.5 text-cyan-400 mx-auto" />
      <p className="text-[10px] text-gray-500 mt-1">{label}</p>
      <p className="text-xs text-white font-medium">{value}</p>
    </div>
  );
}

/* ── Google News RSS Tab ──────────────────────────────────────────────────────── */

function GoogleNewsTab({ data }) {
  const [page, setPage] = useState(1);
  if (!data || data.length === 0) return <EmptyState label="Google News articles" />;

  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const paged = data.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      {paged.map((article, i) => (
        <div
          key={i}
          className="bg-gray-900/60 border border-gray-800 rounded-xl p-4 hover:bg-gray-800/30 transition"
        >
          <h3 className="text-sm font-medium text-white leading-snug">
            {article.title}
          </h3>
          {article.snippet && (
            <p className="text-xs text-gray-400 mt-1 line-clamp-2">
              {article.snippet}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
            <span className="text-gray-500">{article.source}</span>
            {article.pubDate && (
              <span>{new Date(article.pubDate).toLocaleString()}</span>
            )}
            {article.query && (
              <span className="bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded-full text-[10px]">
                {article.query}
              </span>
            )}
          </div>
          {article.link && (
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-cyan-400 hover:text-cyan-300"
            >
              Read full article <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ))}
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}

/* ── Shared ────────────────────────────────────────────────────────────────── */

function EmptyState({ label }) {
  return (
    <div className="text-center py-20 text-gray-500">
      <p>No {label} available at the moment.</p>
      <p className="text-xs mt-1">Hit Refresh to fetch the latest data.</p>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  // Show up to 5 page numbers around current page
  const range = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, start + 4);
  for (let i = start; i <= end; i++) range.push(i);

  return (
    <div className="flex items-center justify-center gap-1 pt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page === 1}
        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {range.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`min-w-[32px] h-8 rounded-lg text-xs font-medium transition ${
            p === page
              ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
              : "text-gray-400 hover:text-white hover:bg-gray-800"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page === totalPages}
        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className="ml-3 text-xs text-gray-600">
        {page} / {totalPages}
      </span>
    </div>
  );
}
