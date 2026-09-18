import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

import "./styles/base.css";
import "./styles/layout.css";
import "./styles/sidebar.css";
import "./styles/album-grid.css";
import "./styles/dock-drawer.css";
import "./styles/player-bar.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register("/sw.js");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
