import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "@ahoy/player-ui-dial/styles.css";
import "./styles.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  void navigator.serviceWorker.register("/sw.js");
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
