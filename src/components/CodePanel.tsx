import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";

interface CodePanelProps {
  code: string;
  setCode: (val: string) => void;
  onAIExplain: (code: string, lang: string) => void;
  aiLoading: boolean;
}

const getLanguageExtension = (code: string) => {
  // Simple heuristic: check for Python or C/C++ keywords
  if (/^\s*def |^\s*class |import |print\(/m.test(code)) return python();
  return cpp();
};

const detectLanguage = (code: string) => {
  if (/^\s*def |^\s*class |import |print\(/m.test(code)) return "python";
  return "c";
};

const CodePanel: React.FC<CodePanelProps> = ({ code, setCode, onAIExplain, aiLoading }) => {
  const lang = detectLanguage(code);

  return (
    <div className="h-full w-full p-4 bg-gray-900 text-white rounded-lg shadow-xl flex flex-col border border-gray-800/60">
      <div className="flex-1 overflow-auto transition-opacity duration-200">
        <CodeMirror
          value={code}
          height="100%"
          theme={oneDark}
          extensions={[getLanguageExtension(code)]}
          onChange={setCode}
          className="rounded-lg font-mono text-base min-h-[180px] border border-gray-800 h-full"
          basicSetup={{ lineNumbers: true, highlightActiveLine: true }}
        />
      </div>
      <div className="mt-4 flex justify-center">
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-50"
          onClick={() => onAIExplain(code, lang)}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Loading...</span>
          ) : (
            "AI Explain (Gemini)"
          )}
        </button>
      </div>
    </div>
  );
};

export default CodePanel; 