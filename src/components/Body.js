import React, { useState, useRef } from "react";
import { Editor } from "@monaco-editor/react";
import { GoogleGenAI } from "@google/genai";
const Body = () => {
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [explaination, setExplaination] = useState("");
  const [list, setList] = useState([]);
  const editorRef = useRef(null);
  const decorationRef = useRef([]);
  const [idx, setIdx] = useState(1);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = { editor, monaco };
  };
  const applyVisuals = (startIdx, endIdx) => {
    if (!editorRef.current) return;

    const { editor, monaco } = editorRef.current;

    decorationRef.current = editor.deltaDecorations(decorationRef.current, []);

    decorationRef.current = editor.deltaDecorations(
      [],
      [
        {
          range: new monaco.Range(startIdx, 1, endIdx, 1),
          options: {
            isWholeLine: true,
            className: "myHighlight",
          },
        },
      ],
    );
  };

  const handleEditorChange = (value) => {
    setCode(value);
  };
  const generateExplaination = async (code) => {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: ` I have to understand the code by dividing it into meaning full parts , please break
    the below code into meaningful parts so that it makes sense to me and what you have to do means
    at last you should give it in json format.
    {
    block1:{
    explaination:"some explaination",
    lines:[0,2] 
    },
    block2:{
    explaination:"some explaination",
    lines:[3,5]
    }
    }
    
    in this format you should write answer only return json object as response nothing more than that is needed.
    Here is the code ${code}  explain like senior developer,dont mention anything about current prompt details in explaination
    `,
      });

      const parsedData = Object.values(JSON.parse(response.text));

      setList(parsedData);
      setExplaination(parsedData[0].explaination);
      applyVisuals(parsedData[0].lines[0], parsedData[0].lines[1]);
    } catch (error) {
      console.log(error);
      
      setExplaination(`Sorry, unable to generate explaination.`);
    }
  };

  return (
    <div className="flex flex-wrap mb-20 md:flex-nowrap md:gap-6">
      <div className="md:w-2/4 w-full mr-6 mt-6 ml-2 border-2">
        <div className="flex justify-between p-1">
          <h2 className="text-xl md:text-2xl font-semibold">Write Your Code Below</h2>
          <button
            className="border-2 p-1 w-50 cursor-pointer"
            onClick={() => {
              const numberedCode = code
                .split("\n")
                .map((line, index) => `${index + 1}: ${line}`)
                .join("\n");
              setExplaination(
                "Generating explaination....\nThis might take few seconds",
              );
              generateExplaination(numberedCode);
            }}
          >
            Generate Explaination
          </button>
          <select
            className="border-2 p-1"
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
        </div>
        <Editor
          height={"500px"}
          language={language}
          defaultValue=""
          theme="vs-dark"
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
        />
      </div>
      <div className="border-2 w-full mr-6 mt-6 md:w-2/4 ml-2 md:mr-10 p-2">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold "> Explaination </h2>
          <div className="mr-3 text-xl">
            <button
              className="border-2 p-1 w-20"
              onClick={() => {
                if (idx <= 0) return;
                let newIdx = idx - 1;
                setIdx(newIdx);
                setExplaination(list[newIdx].explaination);
                applyVisuals(list[newIdx].lines[0], list[newIdx].lines[1]);
                if (idx === 0) {
                  setIdx(1);
                }
              }}
            >
              Prev
            </button>
            <button
              className="border-2 p-1 w-20 ml-2"
              onClick={() => {
                if (list[idx] === undefined) return;
                setExplaination(list[idx].explaination);
                applyVisuals(list[idx].lines[0], list[idx].lines[1]);
                setIdx(idx + 1);
              }}
            >
              Next
            </button>
          </div>
        </div>
        <hr className="mt-1"></hr>
        <div className="explaination bg-[#f0f0f0] m-3 rounded-[10px] p-4">
          <p>
            {explaination === ""
              ? "Explaination will be displayed here"
              : setExplaination(explaination)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Body;
