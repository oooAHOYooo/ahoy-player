import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@ahoy/player-ui-dial/styles.css";
import "./styles.css";

createRoot(document.getElementById("root")!).render(<App />);
