import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import AppLayout from "./components/AppLayout";
import SupplierDashboard from "./pages/SupplierDashboard";
import SupplierGraphBuilder from "./pages/SupplierGraphBuilder";
import PublishPage from "./pages/PublishPage";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <SupplierDashboard />,
      },
      {
        path: "graph/:workspaceId",
        element: <SupplierGraphBuilder />,
      },
      {
        path: "publish/:workspaceId",
        element: <PublishPage />,
      },
    ],
  },
]);

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
