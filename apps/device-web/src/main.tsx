import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { mountTerminalQuickstart } from "./terminal-quickstart";
import "@ahoy/player-ui-dial/styles.css";
import "./styles.css";
import "./terminal-quickstart.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register("/sw.js");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

mountTerminalQuickstart();
