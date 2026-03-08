import { NavLink, useLocation } from "react-router-dom";

const navItems = [
  { to: "/", icon: "dashboard", label: "Dashboard" },
  { to: "/graph", icon: "hub", label: "Graph Builder" },
  { to: "/risk", icon: "warning", label: "Risk Analysis" },
  { to: "/simulation", icon: "science", label: "Simulation" },
  { to: "/reports", icon: "summarize", label: "Reports" },
  { to: "/data", icon: "database", label: "Data Management" },
];

const bottomItems = [
  { to: "/settings", icon: "settings", label: "Settings" },
];

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="flex h-full w-[72px] flex-col items-center border-r border-[#a390f9]/10 bg-white py-4 transition-all xl:w-56 xl:items-stretch xl:px-4">
      {/* Brand */}
      <NavLink to="/" className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#a390f9] text-white shadow-lg shadow-[#a390f9]/30">
          <span className="material-symbols-outlined text-[22px]">hub</span>
        </div>
        <div className="hidden xl:block">
          <h2 className="text-sm font-bold leading-tight tracking-tight text-slate-900">
            Supply Chain
          </h2>
          <p className="text-[10px] font-semibold text-[#a390f9]">Graph Engine</p>
        </div>
      </NavLink>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1">
        <p className="mb-2 hidden px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400 xl:block">
          Menu
        </p>

        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#a390f9]/10 text-[#a390f9] shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  isActive ? "text-[#a390f9]" : "text-slate-400 group-hover:text-slate-600"
                }`}
              >
                {item.icon}
              </span>
              <span className="hidden xl:inline">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom items */}
      <div className="flex flex-col gap-1 border-t border-[#a390f9]/10 pt-4">
        {bottomItems.map((item) => {
          const isActive = location.pathname.startsWith(item.to);

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                isActive
                  ? "bg-[#a390f9]/10 text-[#a390f9] shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <span
                className={`material-symbols-outlined text-[20px] ${
                  isActive ? "text-[#a390f9]" : "text-slate-400 group-hover:text-slate-600"
                }`}
              >
                {item.icon}
              </span>
              <span className="hidden xl:inline">{item.label}</span>
            </NavLink>
          );
        })}

        {/* User avatar */}
        <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2">
          <div className="h-9 w-9 shrink-0 rounded-full border border-[#a390f9]/30 bg-[#a390f9]/20 p-0.5">
            <img
              alt="User"
              className="h-full w-full rounded-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAG0cmWkfVl1HwIFhSJfo2Tv4r_lpWPh5i4tCfHerqd1oRfX967LGMQf2LMUUWw42x21PsZhrTEamLYoLwj12pZUgyL1jR4lkd-0O7ldkwgY779zJnVX7vQI8jFVdDeKyQecuO6OmhgF7dfIgctdfeo0iNG-mAXajGNbAOhy8-rXE5dxpysyBYIHBJq7JT9yK9VuCeV7kCTklfTXZUitn--jYXSAlVMf-Qu6Ibblowp9GnqxSI7DaB6G94QBm0qxaoEpTis4Mxqzx0"
            />
          </div>
          <div className="hidden xl:block">
            <p className="text-xs font-semibold text-slate-700">User</p>
            <p className="text-[10px] text-slate-400">Admin</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
