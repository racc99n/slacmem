import React from "react";
import ReactDOM from "react-dom/client";
import { LiffProvider } from "react-liff";
import App from "./App";

// LIFF ID ควรเก็บไว้ใน Environment Variable
const liffId = process.env.LIFF_ID;

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <LiffProvider liffId={liffId}>
      <App />
    </LiffProvider>
  </React.StrictMode>
);
