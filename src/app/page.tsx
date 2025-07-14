'use client';

import React, { useState } from "react";
import CodePanel from "../components/CodePanel";
import ExplanationPanel from "../components/ExplanationPanel";

// Placeholder for Tree-sitter block extraction
function extractBlocksFromCode(code: string) {
  // TODO: Replace with real Tree-sitter logic
  // For now, split by lines with '// Block' or '# Block' as markers
  const lines = code.split(/\r?\n/);
  const blocks = [];
  let current: { code: string[]; start: number; end: number } | null = null;
  lines.forEach((line, idx) => {
    if (/^\s*(\/\/|#) Block/.test(line)) {
      if (current) {
        current.end = idx - 1;
        blocks.push(current);
      }
      current = { code: [line], start: idx, end: idx };
    } else if (current) {
      current.code.push(line);
      current.end = idx;
    }
  });
  if (current) blocks.push(current);
  return blocks.length ? blocks : [{ code: lines, start: 0, end: lines.length - 1 }];
}

export default function Home() {
  const [code, setCode] = useState(`# Block 1: Function signature and variable\ntypedef int i32;\ni32 add(i32 a, i32 b) {\n    // Block 2: Calculation\n    i32 result = a + b;\n    // Block 3: Return\n    return result;\n}`);
  const [blockExplanations, setBlockExplanations] = useState<string[]>([]);
  const [aiLoading, setAILoading] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(0);

  // Handler to trigger AI explanation for all blocks
  const handleAIExplain = async () => {
    setAILoading(true);
    setBlockExplanations([]);
    setCurrentBlock(0);
    const blocks = extractBlocksFromCode(code);
    const GEMINI_API_KEY = "AIzaSyCLLTHV9_W_whqPZ0kVOk6qTEhm_ZM7Lls";
    const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + GEMINI_API_KEY;
    const prompt = `Analyze the following code. Split it into logical blocks (functions, statements, etc). For each block, return a JSON object with: block_id (or line range), code (the code for the block), and explanation (a beginner-friendly explanation). Return a JSON array of these objects.\n\nCode:\n${code}`;
    const body = {
      contents: [{ parts: [{ text: prompt }] }],
    };
    try {
      const res = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Gemini API error: " + res.status);
      const data = await res.json();
      // Try to parse Gemini's response as JSON array
      let arr: any[] = [];
      try {
        arr = JSON.parse(data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]");
      } catch {
        arr = [];
      }
      setBlockExplanations(arr.map((b) => b.explanation || "No explanation."));
    } catch (e: any) {
      setBlockExplanations([`Error: ${e.message}`]);
    }
    setAILoading(false);
  };

  // For highlighting: get start/end lines for current block
  const blocks = extractBlocksFromCode(code);
  const highlightRange = blocks[currentBlock] ? [blocks[currentBlock].start, blocks[currentBlock].end] : [0, 0];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="w-full px-6 py-4 bg-white/80 dark:bg-gray-900/80 shadow flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Interactive Code Explainer</h1>
      </header>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-2 py-6">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 h-[80vh] md:h-[80vh] transition-all duration-300">
          <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="px-6 pt-6 pb-2 text-2xl font-bold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700">Code Input</div>
            <div className="flex-1 flex flex-col px-6 pb-4 overflow-hidden">
              <CodePanel
                code={code}
                setCode={setCode}
                onAIExplain={handleAIExplain}
                aiLoading={aiLoading}
                highlightRange={highlightRange}
              />
              {blockExplanations.length > 1 && (
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50"
                    onClick={() => setCurrentBlock((b) => Math.max(0, b - 1))}
                    disabled={currentBlock === 0}
                  >
                    Prev
                  </button>
                  <span className="text-gray-600 dark:text-gray-300 self-center select-none">Block {currentBlock + 1} / {blockExplanations.length}</span>
                  <button
                    className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50"
                    onClick={() => setCurrentBlock((b) => Math.min(blockExplanations.length - 1, b + 1))}
                    disabled={currentBlock === blockExplanations.length - 1}
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
          <ExplanationPanel
            aiExplanation={blockExplanations[currentBlock] || ""}
            aiLoading={aiLoading}
          />
        </div>
      </main>
      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800">
        &copy; {new Date().getFullYear()} Code Explainer. Powered by Next.js, Shiki, Mermaid, and Tailwind CSS.
      </footer>
    </div>
  );
}
