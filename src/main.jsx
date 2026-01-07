import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

const BUILD_ID = import.meta.env.VITE_BUILD_ID || "dev";

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  const swUrl = `/sw.js?build=${encodeURIComponent(BUILD_ID)}`;

  navigator.serviceWorker
    .register(swUrl)
    .then(() => {
      // When a new SW takes control, refresh once to load the new JS/UI
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
      });
    })
    .catch((err) => {
      console.error("SW registration failed:", err);
    });
}

registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
