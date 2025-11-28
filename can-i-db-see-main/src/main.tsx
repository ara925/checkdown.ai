import { initLogging } from "./lib/logging/logger";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

initLogging();
createRoot(document.getElementById("root")!).render(<App />);
