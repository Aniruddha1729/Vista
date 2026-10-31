import App from "./App";
import Home from "./pages/Home";

function Root() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  return path === "/events" ? <Home /> : <App />;
}

export default Root;
