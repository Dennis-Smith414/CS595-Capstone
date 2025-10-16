import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
// If WebApp is TSX, import without .jsx. If it really is .jsx, leave as-is.
import WebApp from "./components/WebApp";

function getToken() {
  return localStorage.getItem("token");
}

function HomeRedirect() {
  // decide on each render, not once at module load
  return getToken() ? <Navigate to="/app" replace /> : <Navigate to="/login" replace />;
}

function ProtectedRoute({ children }: { children: JSX.Element }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Default: route users based on current auth state */}
      <Route path="/" element={<HomeRedirect />} />

      {/* Public auth pages */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Logged-in shell */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <WebApp />
          </ProtectedRoute>
        }
      />

      {/* Legacy pages still protected (optional) */}
      {/* <Route path="/routes" element={<ProtectedRoute><RoutesList /></ProtectedRoute>} />
      <Route path="/route/:id" element={<ProtectedRoute><RouteView /></ProtectedRoute>} /> */}

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
