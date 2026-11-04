import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { aplicarTema, temaInicial } from "./lib/tema";
import "./styles.css";

aplicarTema(temaInicial());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
