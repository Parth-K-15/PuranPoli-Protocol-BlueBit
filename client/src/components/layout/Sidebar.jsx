import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  { to: "/app", icon: "dashboard", label: "Dashboard" },
  { to: "/app/graph", icon: "hub", label: "Graph Builder" },
  { to: "/app/marketplace", icon: "store", label: "Marketplace" },
  { to: "/app/risk", icon: "warning", label: "Risk Analysis" },
  { to: "/app/simulation", icon: "science", label: "Simulation" },
  { to: "/app/reports", icon: "summarize", label: "Reports" },
  { to: "/app/data", icon: "database", label: "Data Management" },
  { to: "/app/heatmap", icon: "map", label: "Heatmap" },
];

const bottomItems = [
  { to: "/app/settings", icon: "settings", label: "Settings" },
];

function Sidebar() {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebarCollapsed") === "true"
  );
  const location = useLocation();

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  return (
    <aside
      className={`flex h-full flex-col border-r border-[#a390f9]/10 bg-white py-4 transition-all duration-200 ${
        collapsed ? "w-[72px] items-center" : "w-56 items-stretch px-4"
      }`}
    >
      {/* Brand */}
      <NavLink
        to="/"
        className={`mb-8 flex items-center gap-3 ${collapsed ? "justify-center px-1" : "px-2"}`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#a390f9] text-white shadow-lg shadow-[#a390f9]/30">
          <span className="material-symbols-outlined text-[22px]">hub</span>
        </div>
        {!collapsed && (
          <div>
            <h2 className="text-sm font-bold leading-tight tracking-tight text-slate-900">
              Supply Chain
            </h2>
            <p className="text-[10px] font-semibold text-[#a390f9]">Graph Engine</p>
          </div>
        )}
      </NavLink>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1">
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Menu
          </p>
        )}

        {navItems.map((item) => {
          const isActive =
            item.to === "/app"
              ? location.pathname === "/app"
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all ${
                collapsed ? "justify-center px-2" : "px-3"
              } ${
                isActive
                  ? "bg-[#b1b2ff]/10 text-[#b1b2ff] shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  isActive ? "text-[#b1b2ff]" : "text-slate-400 group-hover:text-slate-600"
                }`}
              >
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="flex flex-col gap-1 border-t border-[#b1b2ff]/10 pt-4">
        {bottomItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={`group flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium transition-all ${
                collapsed ? "justify-center px-2" : "px-3"
              } ${
                isActive
                  ? "bg-[#b1b2ff]/10 text-[#b1b2ff] shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  isActive ? "text-[#b1b2ff]" : "text-slate-400 group-hover:text-slate-600"
                }`}
              >
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}

        {/* User avatar */}
        <div
          className={`mt-3 flex items-center gap-3 rounded-xl py-2 ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <div className="h-9 w-9 shrink-0 rounded-full border border-[#a390f9]/30 bg-[#a390f9]/20 p-0.5">
            <img
              alt="User"
              className="h-full w-full rounded-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAG0cmWkfVl1HwIFhSJfo2Tv4r_lpWPh5i4tCfHerqd1oRfX967LGMQf2LMUUWw42x21PsZhrTEamLYoLwj12pZUgyL1jR4lkd-0O7ldkwgY779zJnVX7vQI8jFVdDeKyQecuO6OmhgF7dfIgctdfeo0iNG-mAXajGNbAOhy8-rXE5dxpysyBYIHBJq7JT9yK9VuCeV7kCTklfTXZUitn--jYXSAlVMf-Qu6Ibblowp9GnqxSI7DaB6G94QBm0qxaoEpTis4Mxqzx0"
            />
          </div>
          {!collapsed && (
            <div>
              <p className="text-xs font-semibold text-slate-700">User</p>
              <p className="text-[10px] text-slate-400">Admin</p>
            </div>
          )}
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={`mt-1 flex items-center gap-2 rounded-xl py-2 text-xs font-medium text-slate-400 transition-all hover:bg-slate-50 hover:text-slate-600 ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
