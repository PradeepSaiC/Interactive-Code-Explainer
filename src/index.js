import ReactDOM from "react-dom/client";
import NavBar from "./components/NavBar";
import Playground from "./components/Playground";
const App = () => {
  return (
    <div className="w-screen h-screen flex flex-col">
      <NavBar />
      <Playground/>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(<App />);
