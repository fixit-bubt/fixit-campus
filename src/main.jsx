import React from "react";
import ReactDOM from "react-dom/client";
import { AppProvider } from "./data/store.jsx";
import { ToastProvider } from "./components/ui.jsx";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { initTheme } from "./lib/theme.js";
import App from "./App.jsx";
import "./index.css";

initTheme(); // apply light/dark before first paint to avoid a flash

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
