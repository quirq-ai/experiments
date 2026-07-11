import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Unable to start the application: #root was not found.");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
