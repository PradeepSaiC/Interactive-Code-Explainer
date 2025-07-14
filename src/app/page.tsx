'use client';

import React, { useState, useCallback } from "react";
import CodePanel from "../components/CodePanel";
import ExplanationPanel from "../components/ExplanationPanel";
import { CustomCodeVisualizer } from "../components/CodePanel";

// Generic block extraction: split by double newlines (paragraphs)
function extractBlocksFromText(text: string) {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  let idx = 0;
  return paragraphs.map((para) => {
    const lines = para.split(/\r?\n/);
    const start = idx;
    const end = idx + lines.length - 1;
    idx = end + 1;
    return { code: lines, start, end };
  });
}

const LANGUAGE_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "c", label: "C" },
  { value: "plaintext", label: "Plain Text" },
];

function detectLanguage(code: string): string {
  if (/^\s*def |^\s*class |import |print\(/m.test(code)) return "python";
  if (/^\s*#include |int main\(/m.test(code)) return "c";
  return "plaintext";
}

export default function Home() {
  const [text, setText] = useState(
    `# Welcome to the Interactive Code Explainer! Paste or edit your code below. Click 'Get Explanation' to see block-by-block explanations.\ndef hello_world():\n    # Print Hello, World! to the console\n    print('Hello, World!')\n\nhello_world()`
  );
  const [blockData, setBlockData] = useState<{ start: number; end: number; text: string; explanation: string }[]>([]);
  const [aiLoading, setAILoading] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [showLangWarning, setShowLangWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Always recompute blocks on render (for initial editing, before Gemini)
  const blocks = extractBlocksFromText(text);

  // Filter blockData to only valid blocks
  const codeLineCount = text.split('\n').length;
  const validBlocks = blockData.filter(
    (b) =>
      typeof b.start === 'number' &&
      typeof b.end === 'number' &&
      b.start >= 0 &&
      b.end >= b.start &&
      b.end < codeLineCount
  );
  // Clamp currentBlock to valid range
  React.useEffect(() => {
    if (validBlocks.length > 0) {
      setCurrentBlock((prev) => Math.max(0, Math.min(prev, validBlocks.length - 1)));
    } else if (blocks.length > 0) {
      setCurrentBlock((prev) => Math.max(0, Math.min(prev, blocks.length - 1)));
    } else {
      setCurrentBlock(0);
    }
  }, [validBlocks.length, blocks.length]);
  // For highlighting: get start/end lines for current block
  const arr = validBlocks.length > 0 ? validBlocks : blocks;
  let highlightRange: [number, number] = arr[currentBlock]
    ? [arr[currentBlock].start, arr[currentBlock].end]
    : [0, 0];
  // Clamp highlightRange to valid code lines
  highlightRange = [
    Math.max(0, Math.min(highlightRange[0], codeLineCount - 1)),
    Math.max(0, Math.min(highlightRange[1], codeLineCount - 1)),
  ];
  const hasBlocks = validBlocks.length > 0 && text.trim().length > 0;
  const validHighlightRange =
    hasBlocks &&
    highlightRange[0] >= 0 &&
    highlightRange[1] < codeLineCount &&
    highlightRange[0] <= highlightRange[1];

  // Reset currentBlock on code change
  React.useEffect(() => {
    setCurrentBlock(0);
    setBlockData([]);
    setError(null);
  }, [text]);

  // Set current block based on a line number (from CodePanel)
  const setCurrentBlockForLine = useCallback(
    (line: number) => {
      const arr = blockData.length > 0 ? blockData : blocks;
      const idx = arr.findIndex((b) => line >= b.start && line <= b.end);
      if (idx !== -1 && idx !== currentBlock) setCurrentBlock(idx);
    },
    [blockData, blocks, currentBlock]
  );

  // Handler to trigger AI explanation for all blocks
  const handleAIExplain = async () => {
    const detected = detectLanguage(text);
    if (detected !== selectedLanguage) {
      setShowLangWarning(true);
      return;
    }
    setShowLangWarning(false);
    setAILoading(true);
    setBlockData([]);
    setCurrentBlock(0);
    setError(null);
    const GEMINI_API_KEY = "AIzaSyCLLTHV9_W_whqPZ0kVOk6qTEhm_ZM7Lls";
    const GEMINI_API_URL =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    // Add a sample program and expected output as reference
    const sampleCode = `def add(a, b):\n    return a + b\n\nresult = add(2, 3)\nprint(result)`;
    const sampleBlocks = [
      {
        start: 0,
        end: 1,
        text: "def add(a, b):\n    return a + b",
        explanation: "This block defines a function `add` that takes two arguments and returns their sum. Example usage:\n\n```python\nresult = add(2, 3)\nprint(result)\n```"
      },
      {
        start: 2,
        end: 3,
        text: "result = add(2, 3)\nprint(result)",
        explanation: "This block calls the `add` function and prints the result."
      }
    ];
    const prompt = `Split the following code into logical blocks (functions, classes, or paragraphs). For each block, return a JSON object with: start (start line, 0-based, must match the input code), end (end line, 0-based, must match the input code), text (the code for the block), and explanation (a beginner-friendly explanation).\n\n- The start and end line numbers must correspond to the input code, with the first line as 0.\n- Do not skip any lines.\n- Return a JSON array ONLY, no extra text.\n\nHere is a sample program and the expected output format:\n\nSample code:\n${sampleCode}\n\nSample output:\n${JSON.stringify(sampleBlocks, null, 2)}\n\nNow do the same for this code:\n${text}`;
    const body = {
      contents: [
        {
          parts: [
            { text: prompt }
          ]
        }
      ]
    };
    try {
      const res = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Gemini API error: " + res.status);
      const data = await res.json();
      // Log the full Gemini response for debugging
      console.log('Gemini full response:', data);
      // For debugging: show the raw text response in the UI
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      setError(null);
      if (!rawText) {
        setError("No response from Gemini. Try again or simplify your input.");
        setBlockData([]);
        setAILoading(false);
        return;
      }
      // Try to parse as JSON, but if it fails, just show the raw text for now
      let arr: any[] = [];
      let cleanedText = rawText.trim();
      // Remove triple backticks and json code block if present
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
      }
      try {
        arr = JSON.parse(cleanedText);
      } catch {
        setError("Gemini response (not JSON):\n" + rawText);
        setBlockData([]);
        setAILoading(false);
        return;
      }
      if (!Array.isArray(arr) || arr.length === 0) {
        setError("No blocks or explanations returned. Try again or simplify your input.\nGemini response:\n" + rawText);
        setBlockData([]);
        setAILoading(false);
        return;
      }
      setBlockData(arr.map((b) => ({
        start: b.start ?? 0,
        end: b.end ?? 0,
        text: b.text ?? "",
        explanation: b.explanation ?? "No explanation."
      })));
    } catch (e: any) {
      setError(e.message || "Unknown error while contacting Gemini API.");
      setBlockData([]);
    }
    setAILoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="w-full px-6 py-4 bg-white/80 dark:bg-gray-900/80 shadow flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          Interactive Text Explainer
        </h1>
      </header>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-2 py-6">
        {/* Only show code input at the start */}
        {!(hasBlocks && validHighlightRange) ? (
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              <span>Code Input</span>
              <select
                className="ml-4 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-base"
                value={selectedLanguage}
                onChange={e => setSelectedLanguage(e.target.value)}
              >
                {LANGUAGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <CodePanel
              code={text}
              setCode={setText}
              onAIExplain={handleAIExplain}
              aiLoading={aiLoading}
              readOnly={false}
            />
            {blockData.length > 0 && (
              <div className="mb-2 p-3 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 font-semibold text-sm mt-2">
                No valid blocks to highlight. Please check your code or try again.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex w-full items-center mb-2 md:mb-4 mt-[-1.5rem]">
              <button
                className="text-xl mr-2 focus:outline-none text-gray-400 cursor-pointer"
                aria-label="Back to Edit"
                style={{ width: '4px' }}
                onClick={() => { setBlockData([]); setError(null); }}
              >
                ←
              </button>
            </div>
            <div className="w-screen max-w-none h-[80vh] md:h-[80vh] flex flex-col md:flex-row gap-8 transition-all duration-300">
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow items-stretch justify-stretch w-full md:w-[70vw]">
                <CustomCodeVisualizer
                  code={text}
                  blockData={validBlocks}
                  currentBlock={currentBlock}
                  onPrevBlock={() => setCurrentBlock((b) => Math.max(0, Math.min(validBlocks.length - 1, b - 1)))}
                  onNextBlock={() => setCurrentBlock((b) => Math.max(0, Math.min(validBlocks.length - 1, b + 1)))}
                  totalBlocks={validBlocks.length}
                  language={selectedLanguage}
                />
              </div>
              {/* Visual separator for desktop */}
              <div className="hidden md:block w-0.5 h-full bg-gradient-to-b from-blue-200/60 to-pink-100/60 mx-0" />
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 w-full md:w-[30vw] mt-4 md:mt-0">
                <ExplanationPanel
                  aiExplanation={blockData[currentBlock]?.explanation || ""}
                  aiLoading={aiLoading}
                />
              </div>
            </div>
          </>
        )}
      </main>
      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800">
        &copy; {new Date().getFullYear()} Text Explainer. Powered by Next.js, Tailwind CSS, and Gemini.
      </footer>
    </div>
  );
}
