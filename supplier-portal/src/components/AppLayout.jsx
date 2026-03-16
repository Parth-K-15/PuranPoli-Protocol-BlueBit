import { useEffect, useState } from "react";
import { NavLink, Outlet, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { workspaceApi } from "../services/api";

export default function AppLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState([]);
  const [sidebarOpen] = useState(true);

  useEffect(() => {
    if (!user) return;
    workspaceApi.listMine().then((data) => {
      setWorkspaces(data.workspaces ?? data ?? []);
    }).catch(() => {});
  }, [user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-400">
          <span className="material-symbols-outlined animate-spin text-[#6d6fd8]">
            progress_activity
          </span>
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside
        className={`flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white transition-all ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full absolute"
        }`}
      >
        {/* Brand */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#b1b2ff]">
            <span className="material-symbols-outlined text-xl text-white">
              local_shipping
            </span>
          </div>
          <span className="text-base font-bold text-slate-800">
            Supplier Portal
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#b1b2ff]/10 text-[#6d6fd8]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">
              dashboard
            </span>
            Dashboard
          </NavLink>

          {/* Workspace sub-links */}
          {workspaces.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Workspaces
              </p>
              <div className="space-y-0.5">
                {workspaces.map((ws) => (
                  <NavLink
                    key={ws._id}
                    to={`/graph/${ws._id}`}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "bg-[#b1b2ff]/10 text-[#6d6fd8]"
                          : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                      }`
                    }
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      account_tree
                    </span>
                    <span className="truncate">{ws.name}</span>
                    {ws.isPublished && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400" />
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* User / Logout */}
        <div className="border-t border-slate-100 px-3 py-3">
          <div className="mb-2 px-3">
            <p className="truncate text-sm font-medium text-slate-700">
              {user.name || user.email}
            </p>
            {user.companyName && (
              <p className="truncate text-xs text-slate-400">
                {user.companyName}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <span className="material-symbols-outlined text-[20px]">
              logout
            </span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <Outlet context={{ workspaces, setWorkspaces }} />
      </main>
    </div>
  );
}
