import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";

// src/legacy-shims.ts (import this in main.tsx first)
declare global {
  interface Window {
    upvoteWaypoint?: (...args: any[]) => void;
    postWaypointComment?: (...args: any[]) => void;
    popup?: (...args: any[]) => void;
  }
}

if (typeof window !== "undefined") {
  const noop = (...args: any[]) =>
    console.warn("[legacy shim] ignored inline call:", args);

  window.upvoteWaypoint ??= noop;
  window.postWaypointComment ??= noop;
  window.popup ??= noop;
}

// (no export needed)


ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
