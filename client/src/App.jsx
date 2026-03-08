import { createBrowserRouter, RouterProvider } from "react-router-dom";

import AppLayout from "./components/layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import GraphBuilderPage from "./pages/GraphBuilderPage";
import RiskAnalysisPage from "./pages/RiskAnalysisPage";
import SimulationPage from "./pages/SimulationPage";
import ReportsPage from "./pages/ReportsPage";
import DataManagementPage from "./pages/DataManagementPage";
import SettingsPage from "./pages/SettingsPage";

import Disruptions from "./pages/Disruptions";
import LiveIntelFeed from "./pages/LiveIntelFeed";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "graph", element: <GraphBuilderPage /> },
      { path: "risk", element: <RiskAnalysisPage /> },
      { path: "simulation", element: <SimulationPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "data", element: <DataManagementPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "disruptions", element: <Disruptions /> },
      { path: "live-feed", element: <LiveIntelFeed /> },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
