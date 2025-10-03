import { useState } from "react";
import styles from "./Login.module.css";
import logo from "../assets/logo.png"; // 
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_URL || "http://localhost:5100";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  async function onSubmit(e: React.FormEvent) {
      e.preventDefault();
      setError(null);

      try {
        const response = await fetch(`${API}/api/auth/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: username.trim(),
            password: password,
          }),
        });
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Invalid username or password.");
        }
        // --- SUCCESSFUL LOGIN ---
        // The server sends back a token. We need to save it.
        // localStorage is the standard place to save it in a web browser.
        localStorage.setItem("token", data.token);

        // Redirect the user to the main part of the application.
        navigate("/routes"); // Or wherever your main map/dashboard is
      } catch (err: any) {
        setError(err.message);
      }
    }
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <img src={logo} alt="OpenCairn Logo" className={styles.logo} />

        {/* Title */}
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
          <div className="card">

            <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            

            </div>
          </div>
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

          <button type="submit" className={styles.button}>
            Log In
          </button>
          <button
            type="button"
            className={styles.Create_button}
            onClick={() => navigate("/register")}  // must be lowercase to match route
          >
            Create Account
          </button>
          <button type="submit" className={styles.Map_button}>
            Demo Map
          </button>
            <Link to="/routes">
                  <button type="button"className={styles.Routes_button}  style={{ width: "100%", padding: 12 }}>Routes</button>
            </Link>
        </form>
      </div>
    </div>
  );
}
