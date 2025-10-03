import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const API = import.meta.env.VITE_API_BASE || "http://localhost:5100";

interface Route {
  id: number;
  name: string;
  distance_m: number;
  points_n: number;
}

export default function RoutesList() {
  const [items, setItems] = useState<Route[]>([]);

  useEffect(() => {
    // 1. Get the token that was saved during login
    const token = localStorage.getItem('token');

    if (!token) {
      // Optional: If for some reason there's no token, you could redirect to the login page
      // navigate('/');
      return;
    }

    // 2. Make the fetch request and include the Authorization header
    fetch(`${API}/api/routes/list?limit=50`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    })
      .then(res => {
        // Handle cases where the token is expired or invalid
        if (res.status === 401 || res.status === 403) {
          localStorage.removeItem('token');
          // navigate('/'); // Redirect to login
        }
        if (!res.ok) {
          throw new Error('Failed to fetch data');
        }
        return res.json();
      })
      .then(data => setItems(data.items ?? []))
      .catch(error => console.error("Error fetching routes:", error));
  }, []); // The empty array ensures this runs only once when the component loads
  return (
    <div style={{ maxWidth: 800, margin: "40px auto", padding: 16 }}>
      <h1>Routes</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {items.map((t) => (
          <li key={t.id} style={{ margin: "10px 0" }}>
            <strong>{t.name}</strong> — {(t.distance_m / 1000).toFixed(1)} km
            <div style={{ marginTop: 5 }}>
              <Link to={`/route/${t.id}`}>View</Link> |{" "}
              <a href={`${API}/api/routes/${t.id}.gpx`} target="_blank">
                Download GPX
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
