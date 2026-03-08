import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";

function AppLayout() {
  const location = useLocation();
  const isGraphPage = location.pathname === "/graph";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#f6f5f8] text-slate-900">
      <Sidebar />

      <main className={`flex min-h-0 flex-1 flex-col overflow-hidden ${isGraphPage ? "" : "overflow-y-auto"}`}>
        <Outlet />
      </main>
    </div>
  );
}

export default AppLayout;
