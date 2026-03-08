import { useState } from "react";

const defaultSettings = {
  graphAnimated: false,
  edgeStyle: "dashed",
  minimap: true,
  autoSave: true,
  riskThreshold: 60,
  defaultZoom: 1,
  primaryColor: "#a390f9",
  gridSize: 40,
};

function SettingsPage() {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem("sc_graph_settings");
      return saved ? { ...defaultSettings, ...JSON.parse(saved) } : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });
  const [saved, setSaved] = useState(false);

  const update = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem("sc_graph_settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem("sc_graph_settings");
    setSaved(false);
  };

  return (
    <div className="flex flex-col gap-8 p-8">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
          <p className="text-sm text-slate-500">Configure application preferences</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            onClick={handleReset}
          >
            Reset Defaults
          </button>
          <button
            type="button"
            className="rounded-xl bg-[#a390f9] px-6 py-2 text-xs font-bold text-white shadow-lg shadow-[#a390f9]/20 hover:bg-[#8f79f7]"
            onClick={handleSave}
          >
            {saved ? "Saved!" : "Save Settings"}
          </button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-xl bg-green-50 p-4 text-sm font-medium text-green-700">
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          Settings saved successfully
        </div>
      )}

      {/* Graph settings */}
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
        <h3 className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span className="material-symbols-outlined text-[18px]">hub</span>
          Graph Visualization
        </h3>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Animated edges */}
          <label className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Animated Edges</p>
              <p className="text-xs text-slate-400">Show flow animation on connections</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={settings.graphAnimated}
                onChange={(e) => update("graphAnimated", e.target.checked)}
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-[#a390f9]" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
            </div>
          </label>

          {/* Minimap */}
          <label className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Show Minimap</p>
              <p className="text-xs text-slate-400">Display minimap in graph view</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={settings.minimap}
                onChange={(e) => update("minimap", e.target.checked)}
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-[#a390f9]" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
            </div>
          </label>

          {/* Edge style */}
          <div className="rounded-xl border border-slate-100 p-4">
            <p className="text-sm font-semibold text-slate-700">Edge Style</p>
            <p className="mb-2 text-xs text-slate-400">Visual style for connections</p>
            <div className="flex gap-2">
              {["solid", "dashed", "dotted"].map((style) => (
                <button
                  key={style}
                  type="button"
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                    settings.edgeStyle === style
                      ? "bg-[#a390f9] text-white"
                      : "border border-slate-200 text-slate-500 hover:text-slate-700"
                  }`}
                  onClick={() => update("edgeStyle", style)}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Grid size */}
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Grid Size</p>
                <p className="text-xs text-slate-400">Background grid spacing</p>
              </div>
              <span className="text-xs font-bold text-[#a390f9]">{settings.gridSize}px</span>
            </div>
            <input
              type="range"
              min="20"
              max="80"
              value={settings.gridSize}
              onChange={(e) => update("gridSize", Number(e.target.value))}
              className="mt-2 w-full accent-[#a390f9]"
            />
          </div>

          {/* Default zoom */}
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Default Zoom</p>
                <p className="text-xs text-slate-400">Initial zoom level</p>
              </div>
              <span className="text-xs font-bold text-[#a390f9]">{settings.defaultZoom}x</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.8"
              step="0.1"
              value={settings.defaultZoom}
              onChange={(e) => update("defaultZoom", Number(e.target.value))}
              className="mt-2 w-full accent-[#a390f9]"
            />
          </div>
        </div>
      </div>

      {/* Risk settings */}
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
        <h3 className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          Risk & Alerts
        </h3>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Risk threshold */}
          <div className="rounded-xl border border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700">Risk Threshold</p>
                <p className="text-xs text-slate-400">Nodes above this are flagged as high-risk</p>
              </div>
              <span className="text-xs font-bold text-[#a390f9]">{settings.riskThreshold}%</span>
            </div>
            <input
              type="range"
              min="30"
              max="90"
              value={settings.riskThreshold}
              onChange={(e) => update("riskThreshold", Number(e.target.value))}
              className="mt-2 w-full accent-[#a390f9]"
            />
          </div>

          {/* Auto save */}
          <label className="flex items-center justify-between rounded-xl border border-slate-100 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-700">Auto-Save</p>
              <p className="text-xs text-slate-400">Automatically persist changes</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={settings.autoSave}
                onChange={(e) => update("autoSave", e.target.checked)}
              />
              <div className="h-6 w-11 rounded-full bg-slate-200 transition-colors peer-checked:bg-[#a390f9]" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
            </div>
          </label>
        </div>
      </div>

      {/* Theme */}
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
        <h3 className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span className="material-symbols-outlined text-[18px]">palette</span>
          Appearance
        </h3>

        <div className="rounded-xl border border-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-700">Primary Color</p>
          <p className="mb-3 text-xs text-slate-400">Accent color used across the UI</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.primaryColor}
              onChange={(e) => update("primaryColor", e.target.value)}
              className="h-10 w-10 cursor-pointer rounded-lg border-0"
            />
            <span className="rounded-lg bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-600">
              {settings.primaryColor}
            </span>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="rounded-2xl border border-[#a390f9]/10 bg-white p-6 shadow-sm">
        <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
          <span className="material-symbols-outlined text-[18px]">info</span>
          About
        </h3>
        <div className="space-y-2 text-sm text-slate-600">
          <p><strong>Supply Chain Graph Engine</strong> v1.0.0</p>
          <p>PuranPoli Protocol · BlueBit</p>
          <p className="text-xs text-slate-400">React {">"}19 · React Flow 12 · Express · MongoDB</p>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
