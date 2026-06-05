// #2 React 18 root bootstrap. Real views (marketplace, position dashboard,
// invest/claim, recon health) land in #24-#26.
import {StrictMode} from "react";
import {createRoot} from "react-dom/client";

import {App} from "./App.tsx";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
