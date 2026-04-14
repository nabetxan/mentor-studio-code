import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App(): JSX.Element {
  return <div>Plan Panel (loading...)</div>;
}

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
