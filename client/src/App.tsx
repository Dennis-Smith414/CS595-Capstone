// src/App.tsx (or wherever your Routes live)
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import WebApp from "./components/WebApp";
import RouteView from "./components/RouteView"; // ⬅️ NEW

function getToken() {
  return localStorage.getItem("token");
}
function HomeRedirect() {
  return getToken() ? <Navigate to="/app" replace /> : <Navigate to="/login" replace />;
}
function ProtectedRoute({ children }: { children: JSX.Element }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />

      {/* Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Authenticated shell */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <WebApp />
          </ProtectedRoute>
        }
      />

      {/* 🔒 Protected route viewer pages */}
      <Route
        path="/routes/view"
        element={
          <ProtectedRoute>
            <RouteView />
          </ProtectedRoute>
        }
      />
      <Route
        path="/routes/:id"
        element={
          <ProtectedRoute>
            <RouteView />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
