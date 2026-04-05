import React, { useState, useRef, useEffect } from "react";
import { Editor } from "@monaco-editor/react";
import { GoogleGenAI } from "@google/genai";
const Playground = () => {
  const editorRef = useRef(null);
  const [language, setLanguage] = useState("javascript");
  const [explaination, setExplaination] = useState("");
  const [code, setCode] = useState("");
  const [list, setList] = useState([]);
  const [output, setOutput] = useState("");
    const [idx, setIdx] = useState(0);
    const decorationRef = useRef([]);

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
    setExplaination("Generating explaination....\nThis might take few seconds");
    try{
          const ai = new GoogleGenAI({
            apiKey:process.env.GEMINI_API_KEY,
          
          });
       const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Act as a senior software engineer and an expert code teacher.

Your task is to help me understand the given code by breaking it into meaningful logical blocks and explaining each part clearly in a beginner-friendly way.

STRICT INSTRUCTIONS:

1. EXECUTION FLOW FIRST:
   - Always follow the actual execution flow of the program.
   - Start from the entry point (like main function or global execution).
   - Then move step-by-step as the program runs.

2. DEPENDENCY HANDLING:
   - If something is required to understand the flow (like structures, classes, helper functions, imports, constants, etc.), explain them BEFORE they are used.
   - Do NOT randomly explain everything at the top — only explain when needed for understanding.

3. COMPLETE COVERAGE:
   - Do NOT skip any part of the code.
   - Every line must belong to some block.
   - Include function definitions, variable declarations, loops, conditions, etc.

4. MEANINGFUL GROUPING:
   - Group lines into logical blocks (not too small, not too large).
   - Each block should represent a meaningful step in execution.

5. BEGINNER-FRIENDLY EXPLANATION:
   - Use very simple language.
   - Avoid jargon or explain it if used.
   - Explain what, why, and how in each block.

6. FUNCTION HANDLING:
   - Do NOT explain functions before they are encountered in execution.
   - When a function is called, then explain:
     - What it does
     - Its parameters
     - Its return value
     - Internal working (if needed)
     strict note : dont leave any fuction without explaining explain it only when called.

7. OUTPUT:
   - At the end, provide the exact output of the code.
   - If input is required, assume reasonable sample input and use it.

8. RESPONSE FORMAT (STRICT JSON ONLY):
   Return ONLY a valid JSON object. No extra text.

FORMAT:
{
  "blocks": [
    {
      "explanation": "Clear beginner-friendly explanation of what this block does and why",
      "lines": [start_line, end_line]
    },    {
      "explanation": "Clear beginner-friendly explanation of what this block does and why",
      "lines": [start_line, end_line]
    },.....  ],
  "codeOutput": "Exact output of the code if input is needed you only choose some inputs and give output"
}

Now analyze and explain the following code:

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
              defaultValue=""
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
                  disabled={idx === 0 }
                  className={`px-4 py-2 cursor-pointer text-sm font-medium border rounded-md 
                    ${idx === 0 ? 'bg-gray-300 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'}`}
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
                  disabled={idx === list.length - 1 || list.length === 0}
                  className={`px-4 py-2 cursor-pointer text-sm font-medium border rounded-md 
                    ${(idx === list.length - 1 || list.length === 0) ? 'bg-gray-300 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed' : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'}`}
                >
                  Next
                </button>
              </div>

              <div>
                <button
                disabled={status}
                  onClick={() => {
                    const numberedCode = code
                      .split("\n")
                      .map((line, index) => `${index + 1}: ${line}`)
                      .join("\n");
                    generateExplaination(numberedCode);
                  }}
                  className="px-2 md:px-4 py-2 cursor-pointer rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-purple-500 shadow-md hover:from-indigo-600 hover:to-purple-600 hover:shadow-lg transition-all duration-200 active:scale-95"
                >
                  Generate Explanation
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
