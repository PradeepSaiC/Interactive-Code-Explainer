
const {Code2} = require("lucide-react");

const NavBar = () => {
  return (
    <div>
                <div className="bg-[#09090B] shadow-2xl h-16 text-zinc-100 flex items-center">
    <div>
             <a href="#" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors">
            <Code2 size={20} />
          </a>
    </div>
    <div className="flex flex-col">
            <h1 className="p-2 text-2xl ml-2 text-gray-100 font-semibold text-lg leading-tight tracking-tight">Interative Code Explainer (Beta)</h1>
                        <p className="text-xs text-gray-400 font-medium">Break & Understand what every code block is doing</p>
    </div>
        </div>
    </div>
  )
}

export default NavBar;
