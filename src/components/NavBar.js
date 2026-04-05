const { Code2, RefreshCw } = require("lucide-react");

const NavBar = () => {
  return (
    <div style={{borderBottom:"1px solid #1E2939"}} className="w-screen">
      <div className="bg-[#09090B] shadow-2xl h-16 text-zinc-100 flex items-center w-screen justify-between">
        <div className="flex items-center gap-3 p-4">
          <a
            href="#"
            className="w-10 h-10 md:w-9 md:h-9 flex items-center justify-center rounded-lg  bg-gradient-to-tr from-indigo-500 to-purple-600 text-white  shadow-lg shadow-indigo-500/20 transition-colors"
          >
            <Code2 size={20} />
          </a>
          <div className="flex flex-col items-start justify-center">
            <h1 className="text-sm md:text-xl text-gray-100 font-semibold text-lg leading-tight tracking-tight">Interative Code Explainer (Beta)</h1>
            <p className="text-xs text-gray-400 font-medium">Break & Understand what every code block is doing</p>
          </div>
        </div>
        <div className="p-4 flex items-center">
          
          <button
            title="Refresh"
            onClick={() => window.location.reload()}
            className="w-9 h-9 cursor-pointer flex items-center justify-center rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
          >
            <RefreshCw size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NavBar;
