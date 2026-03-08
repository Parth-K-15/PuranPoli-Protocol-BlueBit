import { useEffect, useState, useCallback } from "react";
import {
  Search,
  Filter,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Shield,
} from "lucide-react";
import { getDisruptions } from "../services/disruptionApi";
import SeverityBadge from "../components/SeverityBadge";
import Spinner from "../components/Spinner";

const SOURCE_OPTIONS = ["all", "news", "weather", "google_news"];
const EVENT_OPTIONS = [
  "all",
  "production_disruption",
  "logistics_disruption",
  "raw_material_shortage",
  "geopolitical_risk",
  "storm",
  "heavy_rain",
  "heatwave",
  "extreme_cold",
  "severe_weather_alert",
];

export default function Disruptions() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  // Filters
  const [country, setCountry] = useState("");
  const [source, setSource] = useState("all");
  const [type, setType] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (country.trim()) params.country = country.trim();
      if (source !== "all") params.source_type = source;
      if (type !== "all") params.event_type = type;

      const res = await getDisruptions(params);
      setEvents(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [country, source, type]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Shield className="h-6 w-6 text-cyan-400" />
          Disruption Events
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Browse, filter, and inspect all detected disruption signals.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Country */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Country</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-gray-500" />
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g. China"
              className="pl-8 pr-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-cyan-500/50 w-44"
            />
          </div>
        </div>

        {/* Source */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Source</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
          >
            {SOURCE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o === "all" ? "All Sources" : o.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Event type */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-gray-500 font-medium">Event Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/50"
          >
            {EVENT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o === "all" ? "All Types" : o.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm font-medium hover:bg-cyan-500/20 transition"
        >
          <Filter className="h-3.5 w-3.5" />
          Apply
        </button>
      </div>

      {/* List */}
      {loading ? (
        <Spinner />
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Shield className="h-10 w-10 mx-auto mb-3 text-gray-700" />
          <p>No disruption events found matching your filters.</p>
          <p className="text-xs mt-1">Try adjusting filters or run an ingestion.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((evt) => (
            <EventCard
              key={evt._id}
              event={evt}
              isOpen={expanded === evt._id}
              toggle={() => setExpanded(expanded === evt._id ? null : evt._id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Event card with expandable article list ────────────────────────────────── */

function EventCard({ event, isOpen, toggle }) {
  const e = event;
  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-xl overflow-hidden">
      {/* Summary row */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800/30 transition text-left"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <SeverityBadge score={e.severity_score} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-white capitalize truncate">
              {e.event_type?.replace(/_/g, " ")}
            </p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{e.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0 ml-4">
          <span className="hidden sm:inline">{e.source_type?.toUpperCase()}</span>
          <span className="hidden md:inline">
            {e.location}, {e.country}
          </span>
          <span>{new Date(e.detected_at).toLocaleDateString()}</span>
          {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {/* Expanded detail */}
      {isOpen && (
        <div className="px-5 pb-5 border-t border-gray-800">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 text-xs">
            <Detail label="Source" value={e.source_type} />
            <Detail label="Location" value={`${e.location}, ${e.country}`} />
            <Detail label="Severity" value={e.severity_score} />
            <Detail label="Detected" value={new Date(e.detected_at).toLocaleString()} />
          </div>

          {e.related_articles?.length > 0 && (
            <>
              <h4 className="text-xs font-semibold text-gray-400 mb-2">
                Related Articles ({e.related_articles.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {e.related_articles.map((article, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 bg-gray-800/40 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white truncate">{article.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {article.source} ·{" "}
                        {article.publishedAt
                          ? new Date(article.publishedAt).toLocaleDateString()
                          : ""}
                        {article.matched_keywords?.length > 0 && (
                          <span className="ml-2 text-cyan-500">
                            [{article.matched_keywords.join(", ")}]
                          </span>
                        )}
                      </p>
                    </div>
                    {article.url && (
                      <a
                        href={article.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 hover:text-cyan-300 shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <span className="text-gray-500">{label}</span>
      <p className="text-white mt-0.5 capitalize">{value}</p>
    </div>
  );
}
