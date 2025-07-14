'use client';

import React, { useState } from "react";
import CodePanel from "../components/CodePanel";
import ExplanationPanel from "../components/ExplanationPanel";

export default function Home() {
  const [code, setCode] = useState(`# Block 1: Function signature and variable\ntypedef int i32;\ni32 add(i32 a, i32 b) {\n    // Block 2: Calculation\n    i32 result = a + b;\n    // Block 3: Return\n    return result;\n}`);
  const [aiExplanation, setAIExplanation] = useState("");
  const [aiLoading, setAILoading] = useState(false);

  // Handler to trigger AI explanation from CodePanel
  const handleAIExplain = async (code: string, lang: string) => {
    setAILoading(true);
    setAIExplanation("");
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
      setAIExplanation(
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "No explanation returned from Gemini."
      );
    } catch (e: any) {
      setAIExplanation(`Error: ${e.message}`);
    }
    setAILoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="w-full px-6 py-4 bg-white/80 dark:bg-gray-900/80 shadow flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Interactive Code Explainer</h1>
      </header>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-2 py-6">
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-8 h-[600px] transition-all duration-300">
          <CodePanel
            code={code}
            setCode={setCode}
            onAIExplain={handleAIExplain}
            aiLoading={aiLoading}
          />
          <ExplanationPanel
            aiExplanation={aiExplanation}
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
