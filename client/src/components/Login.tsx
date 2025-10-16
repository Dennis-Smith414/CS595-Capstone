import { useState } from "react";
import styles from "./Login.module.css";
import logo from "../assets/logo.png";
import { useNavigate, Link } from "react-router-dom";

const API =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (window as any).__API_BASE__ ||
  "http://localhost:5000";

export default function Login() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!usernameOrEmail || !password) {
      setError("Please enter a username/email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ✅ send a field the backend understands
        body: JSON.stringify({ usernameOrEmail, password }),
      });

      const ct = res.headers.get("content-type") || "";
      const text = await res.text();
      const data = ct.includes("application/json") ? JSON.parse(text) : {};

      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `Login failed (${res.status})`);
      }

      // ✅ accept either `token` or `accessToken`
      const token: string | undefined = data.token || data.accessToken;
      if (!token) throw new Error("Missing token in response");

      localStorage.setItem("token", token);
      if (data.user) localStorage.setItem("user", JSON.stringify(data.user));

      // If your app protects "/" with a ProtectedRoute -> WebApp, go there:
      navigate("/", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <img src={logo} alt="OpenCairn Logo" className={styles.logo} />
        <h1 className={styles.title}>Welcome to OpenCairn</h1>

        <form onSubmit={onSubmit} className={styles.form}>
          <label className={styles.label}>
            Username or Email
            <input
              className={styles.input}
              type="text"
              value={usernameOrEmail}
              onChange={(e) => setUsernameOrEmail(e.target.value)}
              placeholder="username or email"
              autoComplete="username"
              required
              disabled={loading}
            />
          </label>

          <label className={styles.label}>
            Password
            <div style={{ position: "relative" }}>
              <input
                className={`${styles.input} ${styles.inputWithToggle}`}
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className={styles.toggle}
                disabled={loading}
              >
                {showPwd ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && <div className={styles.error}>{error}</div>}

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? "Logging in…" : "Log In"}
          </button>

          <button
            type="button"
            className={styles.Create_button}
            onClick={() => navigate("/register")}
            disabled={loading}
          >
            Create Account
          </button>

          <button
            type="button"
            className={styles.Map_button}
            onClick={() => navigate("/demo-map")}
            disabled={loading}
          >
            Demo Map
          </button>

          <Link to="/routes">
            <button
              type="button"
              className={styles.Routes_button}
              style={{ width: "100%", padding: 12 }}
              disabled={loading}
            >
              Routes
            </button>
          </Link>
        </form>
      </div>
    </div>
  );
}
