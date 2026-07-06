import React, { useState, useRef, useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import { GoogleGenAI } from "@google/genai";
const Playground = () => {
  const editorRef = useRef(null);
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const initialLanguage = searchParams.get("language") || "javascript";
  const initialCode = searchParams.get("code") ? decodeURIComponent(searchParams.get("code")) : "";
  const [language, setLanguage] = useState(initialLanguage);
  const [explaination, setExplaination] = useState("");
  const [code, setCode] = useState(initialCode);
  const [list, setList] = useState([]);
  const [output, setOutput] = useState("");
    const [idx, setIdx] = useState(0);
    const decorationRef = useRef([]);

  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const fetchProblem = async () => {
      const problemId = searchParams.get("problemId");
      if (problemId) {
        try {
          const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';
          const res = await fetch(`${backendUrl}/api/problems/${problemId}`);
          if (res.ok) {
            const data = await res.json();
            const lang = searchParams.get("language") || "javascript";
            // Map common language names to key names in solutions
            const langKey = lang.toLowerCase() === 'cpp' || lang.toLowerCase() === 'c++' ? 'cpp' : lang.toLowerCase();
            const solutionCode = data.solutions[langKey] || data.solutions[lang] || "";
            
            if (solutionCode) {
              setCode(solutionCode);
              setLanguage(lang);
            }
          }
        } catch (err) {
          console.error("Failed to fetch problem from backend", err);
        }
      }
    };
    fetchProblem();
  }, []);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = { editor, monaco };
  };
  const handleEditorChange = (value) => {
    setCode(value);
  };
    const applyVisuals = (startIdx, endIdx) => {
      if (!editorRef.current) return;

      const { editor, monaco } = editorRef.current;

      decorationRef.current = editor.deltaDecorations(decorationRef.current, []);

      const range = new monaco.Range(startIdx, 1, endIdx, 1);
      decorationRef.current = editor.deltaDecorations(
        [],
        [
          {
            range,
            options: {
              isWholeLine: true,
              className: "myHighlight",
            },
          },
        ],
      );
      // Scroll to the highlighted block
      editor.revealRangeInCenter(range);
    };
  const generateExplaination = async (code) => {
    setIsGenerating(true);
    setExplaination("Generating explaination....\nThis might take few seconds");
    try{
          const keys = (process.env.GEMINI_API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
          const randomKey = keys[Math.floor(Math.random() * keys.length)];
          const ai = new GoogleGenAI({ apiKey: randomKey });
       const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Act as a senior software engineer and code reviewer.

Your task is to analyze the given code and explain it by following the program's actual execution flow.

RULES

1. Follow execution order only.
   - Start from the entry point.
   - Explain the code exactly in the order it executes.
   - Do not explain unused code.

2. Explain dependencies only when required.
   - If a variable, class, struct, constant, import, or helper function is needed to understand the current execution, explain it immediately before it is used.
   - Do not dump all declarations at the beginning.

3. Cover the entire code.
   - Every line must belong to exactly one block.
   - Do not skip any line.

4. Create meaningful blocks.
   - Each block should represent one logical step.
   - Do not make blocks that are too small or too large.

5. Keep explanations concise and technical.
   - Explain only:
     - What this block does.
     - Why it exists.
     - How it affects execution.
   - Do NOT give examples.
   - Do NOT use analogies.
   - Do NOT use phrases like "Suppose...", "Imagine...", "For example...", "Let's say...", or similar.
   - Do NOT repeat obvious information.
   - Be direct and precise.

6. Functions
   - Do not explain a function when it is defined.
   - Explain it only when execution reaches its first call.
   - Include:
     - Purpose
     - Parameters
     - Return value
     - Internal execution
   - Explain every function exactly once, at its first execution.

7. Loops and conditions
   - Explain the purpose of the loop or condition.
   - Explain how execution flows through it.
   - Do not simulate every iteration unless necessary.

8. Output
   - If the program requires input, choose realistic sample input.
   - Return the exact output produced.

9. Response format
   Return ONLY valid JSON.
   Do not include markdown.
   Do not include code fences.
   Do not include any text outside the JSON.

Required JSON format:

{
  "blocks": [
    {
      "lines": [startLine, endLine],
      "explanation": "Concise explanation of this execution step."
    }
  ],
  "codeOutput": "Exact program output."
}

Analyze the following code:

${code}`,
      });

    const parsedData = JSON.parse(response.text);
    const {codeOutput,blocks} = parsedData;
    console.log(parsedData);
    
    setOutput(codeOutput);
    setList(blocks);
    setIdx(0);
    if (blocks && blocks.length > 0) {
      setExplaination(blocks[0].explanation);
      applyVisuals(blocks[0].lines[0], blocks[0].lines[1]);
    } else {
      setExplaination('No explanation blocks found.');
    }
  
    }catch(err){
      console.log(err);
      
      setExplaination("Hey API is currently busy.Can you please try again.")
    } finally {
      setIsGenerating(false);
    }
  };
  return (
    <main className="flex-1 flex flex-col md:flex-row overflow-hidden w-full relative  bg-[#0f172a]">
      <section className="w-full h-1/2 md:w-[45%] md:h-full flex flex-col border-b md:border-b-0 md:border-r- border-gray-800 relative z-10 shadow-2xl">
        <div className="w-full h-full flex flex-col font-mono text-sm shadow-xl">
          <div className="bg-[#2d2d2d] px-4 py-2 border-b border-[#3e3e42] flex items-center justify-between text-gray-300">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500"></span>
              <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
              <span className="w-3 h-3 rounded-full bg-green-500"></span>
            </span>
            <span className=" text-xs text-gray-400 font-medium cursor-pointer">
              <select
                className="border-2 bg-[#2d2d2d] p-1"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                }}
              >
                <option value={"javascript"}>Javascript</option>
                <option value={"python"}>Python</option>
                <option value={"cpp"}>C++</option>
                <option value={"java"}>Java</option>
                <option value={"c"}>C</option>
              </select>
            </span>
          </div>
          <div className="flex-1 relative overflow-hidden min-h-0">
            <Editor
              onChange={handleEditorChange}
              onMount={handleEditorDidMount}
              height="100%"
              theme="vs-dark"
              value={code}
              language={language}
            ></Editor>
          </div>
          <section className=" w-full  bg-white/5 backdrop-blur-md p-2 md:p-4">
            <div className="flex justify-between items-center ">
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    if (idx <= 0) return;
                    let newIdx = idx - 1;
                    setIdx(newIdx);
                    setExplaination(list[newIdx].explanation);
                    applyVisuals(list[newIdx].lines[0], list[newIdx].lines[1]);
                  }}
                  disabled={idx === 0 || isGenerating }
                  className={`px-4 py-2 cursor-pointer text-sm font-medium border rounded-md 
                    ${(idx === 0 || isGenerating) ? 'bg-gray-300 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'}`}
                >
                  Previous
                </button>
                <button
                  onClick={() => {
                    if (idx >= list.length - 1) return;
                    const newIdx = idx + 1;
                    setIdx(newIdx);
                    setExplaination(list[newIdx].explanation);
                    applyVisuals(list[newIdx].lines[0], list[newIdx].lines[1]);
                  }}
                  disabled={idx === list.length - 1 || list.length === 0 || isGenerating}
                  className={`px-4 py-2 cursor-pointer text-sm font-medium border rounded-md 
                    ${(idx === list.length - 1 || list.length === 0 || isGenerating) ? 'bg-gray-300 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'}`}
                >
                  Next
                </button>
              </div>

              <div>
                <button
                disabled={isGenerating}
                  onClick={() => {
                    const numberedCode = code
                      .split("\n")
                      .map((line, index) => `${index + 1}: ${line}`)
                      .join("\n");
                    generateExplaination(numberedCode);
                  }}
                  className={`px-2 md:px-4 py-2 cursor-pointer rounded-lg text-sm font-semibold text-white transition-all duration-200 
                    ${isGenerating 
                      ? 'bg-gray-600 cursor-not-allowed opacity-50' 
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500 shadow-md hover:from-indigo-600 hover:to-purple-600 hover:shadow-lg active:scale-95'}`}
                >
                  {isGenerating ? "Generating..." : "Generate Explanation"}
                </button>
              </div>
            </div>
          </section>
        </div>
      </section>
      <section className="flex-1 h-full bg-[#0f172a] p-4">
        <div className="flex flex-col h-full gap-4 md:flex-col-reverse">
          <div className="flex flex-col gap-4 h-full min-h-0 md:flex-col-reverse">
            <div className="flex-[3] min-h-0 bg-white/5 backdrop-blur-md border border-white/10 rounded-lg flex flex-col">
              <div className="p-3 border-b border-white/10 text-gray-300 font-semibold">
                Explanation
              </div>
              <div className="p-4 text-gray-200 overflow-y-auto flex-1 text-sm min-h-0">
                {explaination === ""
                  ? "Explanation will be displayed here"
                  : explaination}
              </div>
            </div>
            <div className="flex-[1] min-h-0 bg-black rounded-lg flex flex-col hidden md:flex max-h-32">
              <div className="p-3 bg-white/10 text-white font-semibold border-b border-white/10 ">
                Output
              </div>
              <div
                className="p-4 whitespace-pre-wrap text-green-400 font-mono text-sm overflow-y-auto flex-1 min-h-0 mb-4 md:mb-0 md:mt-2 rounded-b-lg"
                style={{ minHeight: "48px", maxHeight: "80px" }}
              >
                {output === "" ? "Output will be displayed here..." : output}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Playground;
