console.log("Main.tsx: Script evaluation started at the top");
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
console.log("Main.tsx: root element found:", !!rootElement);


if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("Main.tsx: Render called");
} else {
  console.error("Main.tsx: Root element not found!");
}

