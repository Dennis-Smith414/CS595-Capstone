import { useState } from "react";
import styles from "./Login.module.css";
import logo from "../assets/logo.png";
import { useNavigate, Link } from "react-router-dom";

const API =
  (import.meta as any)?.env?.VITE_API_BASE ||
  (window as any).__API_BASE__ ||
  "http://localhost:5000";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!username || !password) {
      setError("Please enter a username and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.token) {
        throw new Error(data?.error || `Login failed (${res.status})`);
      }

      localStorage.setItem("token", data.token);
      // optionally: localStorage.setItem("user", JSON.stringify(data.user));
      navigate("/app", { replace: true });
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
            Username
            <input
              className={styles.input}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              autoComplete="username"
              required
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
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className={styles.toggle}
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
          >
            Create Account
          </button>

          {/* Make these non-submit to avoid interfering with login */}
          <button
            type="button"
            className={styles.Map_button}
            onClick={() => navigate("/demo-map")}
          >
            Demo Map
          </button>

          <Link to="/app">
            <button
              type="button"
              className={styles.Routes_button}
              style={{ width: "100%", padding: 12 }}
            >
              Routes
            </button>
          </Link>
        </form>
      </div>
    </div>
  );
}
