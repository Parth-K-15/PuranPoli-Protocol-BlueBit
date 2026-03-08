import { NavLink } from "react-router-dom";
import { Activity, BarChart3, Radio, Shield } from "lucide-react";

const links = [
  { to: "/", label: "Dashboard", icon: BarChart3 },
  { to: "/disruptions", label: "Disruptions", icon: Shield },
  { to: "/live-feed", label: "Live Intel Feed", icon: Radio },
];

export default function Sidebar() {
  return (
    <aside className="fixed top-0 left-0 h-screen w-60 bg-gray-950 border-r border-gray-800 flex flex-col z-40">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <Activity className="h-6 w-6 text-cyan-400" />
        <span className="text-lg font-bold text-white tracking-tight">
          RiskPulse
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-4 space-y-1 px-3">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-cyan-500/10 text-cyan-400"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
        External Intelligence v1.0
      </div>
    </aside>
  );
}
