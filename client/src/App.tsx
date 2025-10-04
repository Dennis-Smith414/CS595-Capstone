import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./components/Login";
import Register from "./components/Register";
import RoutesList from "./components/RoutesList";
import RouteView from "./components/RouteView";
// App.tsx
// @ts-ignore - JS component
import WebApp from "./components/WebApp.jsx";



export default function App() {
  const token = localStorage.getItem("token");
  return (
    <Routes>
      {/* send to /app if logged in, else /login */}
      <Route path="/" element={<Navigate to={token ? "/app" : "/login"} replace />} />

      {/* public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* new: mobile-like web shell */}
      <Route path="/app" element={token ? <WebApp /> : <Navigate to="/login" replace />} />

      {/* keep your old pages if you still want them */}
      <Route path="/routes" element={token ? <RoutesList /> : <Navigate to="/login" replace />} />
      <Route path="/route/:id" element={token ? <RouteView /> : <Navigate to="/login" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
