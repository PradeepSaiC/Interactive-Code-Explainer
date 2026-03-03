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
      
      setExplaination(`Sorry, unable to generate explaination.
        The standard Lorem Ipsum passage, used since the 1500s

"Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
Section 1.10.32 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC

"Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?"
1914 translation by H. Rackham

"But I must explain to you how all this mistaken idea of denouncing pleasure and praising pain was born and I will give you a complete account of the system, and expound the actual teachings of the great explorer of the truth, the master-builder of human happiness. No one rejects, dislikes, or avoids pleasure itself, because it is pleasure, but because those who do not know how to pursue pleasure rationally encounter consequences that are extremely painful. Nor again is there anyone who loves or pursues or desires to obtain pain of itself, because it is pain, but because occasionally circumstances occur in which toil and pain can procure him some great pleasure. To take a trivial example, which of us ever undertakes laborious physical exercise, except to obtain some advantage from it? But who has any right to find fault with a man who chooses to enjoy a pleasure that has no annoying consequences, or one who avoids a pain that produces no resultant pleasure?"
Section 1.10.33 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC

"At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat."
1914 translation by H. Rackham

"On the other hand, we denounce with righteous indignation and dislike men who are so beguiled and demoralized by the charms of pleasure of the moment, so blinded by desire, that they cannot foresee the pain and trouble that are bound to ensue; and equal blame belongs to those who fail in their duty through weakness of will, which is the same as saying through shrinking from toil and pain. These cases are perfectly simple and easy to distinguish. In a free hour, when our power of choice is untrammelled and when nothing prevents our being able to do what we like best, every pleasure is to be welcomed and every pain avoided. But in certain circumstances and owing to the claims of duty or the obligations of business it will frequently occur that pleasures have to be repudiated and annoyances accepted. The wise man therefore always holds in these matters to this principle of selection: he rejects pleasures to secure other greater pleasures, or else he endures pains to avoid worse pains."
        `);
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
              : explaination}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Body;
