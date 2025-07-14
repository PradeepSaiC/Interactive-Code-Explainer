'use client';

import React, { useState, useCallback, useEffect } from "react";
import CodePanel from "../components/CodePanel";
import ExplanationPanel from "../components/ExplanationPanel";
import { CustomCodeVisualizer } from "../components/CodePanel";
import { extractBlocks } from "../components/codeBlocks";

// Remove the extractBlocksFromText and async effect at the top

const DEFAULT_CODE_SAMPLES: Record<string, string> = {
  python: `# Welcome to the Interactive Code Explainer! Paste or edit your code below. Click 'Get Explanation' to see block-by-block explanations.\ndef hello_world():\n    # Print Hello, World! to the console\n    print('Hello, World!')\n\nhello_world()`,
  javascript: `// Welcome to the Interactive Code Explainer! Paste or edit your code below. Click 'Get Explanation' to see block-by-block explanations.\nfunction helloWorld() {\n  // Print Hello, World! to the console\n  console.log('Hello, World!');\n}\n\nhelloWorld();`,
  java: `// Welcome to the Interactive Code Explainer! Paste or edit your code below. Click 'Get Explanation' to see block-by-block explanations.\npublic class HelloWorld {\n    public static void main(String[] args) {\n        // Print Hello, World! to the console\n        System.out.println(\"Hello, World!\");\n    }\n}`,
  c: `// Welcome to the Interactive Code Explainer! Paste or edit your code below. Click 'Get Explanation' to see block-by-block explanations.\n#include <stdio.h>\n\n// Print Hello, World! to the console\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}`,
  cpp: `// Welcome to the Interactive Code Explainer! Paste or edit your code below. Click 'Get Explanation' to see block-by-block explanations.\n#include <iostream>\n\n// Print Hello, World! to the console\nint main() {\n    std::cout << \"Hello, World!\\n\";\n    return 0;\n}`
};

const LANGUAGE_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "c", label: "C" },
  { value: "cpp", label: "C++" },
];

function detectLanguage(code: string): string {
  if (/^\s*def |^\s*class |import |print\(/m.test(code)) return "python";
  if (/^\s*function |console\.log|let |const |var |=>|document\.|window\.|^\/\/|^\s*\/\*/m.test(code)) return "javascript";
  if (/^\s*#include|int main\s*\(|\bprintf\b|\bscanf\b|\breturn\b|\bvoid\b|\bchar\b|\bint\b|\bfloat\b|\bdouble\b/m.test(code)) return "c";
  if (/^\s*public |System\.out|class |static void main|^\/\//m.test(code)) return "java";
  if (/^#include <iostream>|std::cout|std::endl|using namespace std|^\/\//m.test(code)) return "cpp";
  return "plaintext";
}

// Remove all Tree-sitter and paragraph splitting logic from the frontend
// Use Gemini for both block splitting and explanation

const GEMINI_API_KEY = "AIzaSyCLLTHV9_W_whqPZ0kVOk6qTEhm_ZM7Lls";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const splitBlocksWithGemini = async (code: string, language: string) => {
  const langHint = language === 'c' ? 'The following code is written in C. ' : '';
  const prompt = `${langHint}Split the following code into logical blocks (functions, classes, top-level comments, and top-level statements). Return a JSON array of code blocks, in order. Each block should be a string of code. Do not include explanations or extra text.\n\nCode:\n${code}`;
  const body = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ]
  };
  const res = await fetch(GEMINI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error("Gemini API error (block split): " + res.status);
  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  let arr: string[] = [];
  let cleanedText = rawText.trim();
  if (cleanedText.startsWith('```json')) {
    cleanedText = cleanedText.replace(/^```json/, '').replace(/```$/, '').trim();
  } else if (cleanedText.startsWith('```')) {
    cleanedText = cleanedText.replace(/^```/, '').replace(/```$/, '').trim();
  }
  try {
    arr = JSON.parse(cleanedText);
  } catch {
    throw new Error("Gemini block split response (not JSON):\n" + rawText);
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("No blocks returned.\nGemini response:\n" + rawText);
  }
  // Convert to block objects with start/end
  let idx = 0;
  const blocks = arr.map(blockText => {
    const lines = blockText.split(/\r?\n/);
    const start = idx;
    const end = idx + lines.length - 1;
    idx = end + 1;
    return { text: blockText, start, end };
  });
  return blocks;
};

// Helper: Robustly map Gemini blocks to original code lines and guarantee every line is assigned
function mapBlocksToOriginalLines(originalCode: string, geminiBlocks: string[]) {
  const codeLines = originalCode.split('\n');
  const used = Array(codeLines.length).fill(false);
  let lastIdx = 0;
  const mappedBlocks = [];
  const lineToBlockIndex = Array(codeLines.length).fill(-1);

  for (const [blockIdx, blockText] of geminiBlocks.entries()) {
    // Normalize block text for matching
    const blockLines = blockText.split('\n').map(l => l.trimEnd());
    let found = false;
    for (let i = lastIdx; i <= codeLines.length - blockLines.length; i++) {
      let match = true;
      for (let j = 0; j < blockLines.length; j++) {
        if (codeLines[i + j].trimEnd() !== blockLines[j]) {
          match = false;
          break;
        }
      }
      if (match) {
        mappedBlocks.push({
          text: codeLines.slice(i, i + blockLines.length).join('\n'),
          start: i,
          end: i + blockLines.length - 1,
        });
        for (let k = i; k < i + blockLines.length; k++) {
          used[k] = true;
          lineToBlockIndex[k] = mappedBlocks.length - 1;
        }
        lastIdx = i + blockLines.length;
        found = true;
        break;
      }
    }
    if (!found) {
      // If not found, try to assign each block line individually to unmatched lines in order
      let start = -1;
      let end = -1;
      let blockLineIdx = 0;
      for (let i = 0; i < codeLines.length && blockLineIdx < blockLines.length; i++) {
        if (!used[i] && codeLines[i].trimEnd() === blockLines[blockLineIdx]) {
          if (start === -1) start = i;
          end = i;
          used[i] = true;
          lineToBlockIndex[i] = mappedBlocks.length;
          blockLineIdx++;
        }
      }
      if (start !== -1 && end !== -1) {
        mappedBlocks.push({
          text: codeLines.slice(start, end + 1).join('\n'),
          start,
          end,
        });
      }
    }
  }
  // Add any remaining unmatched lines as their own blocks in order
  for (let i = 0; i < codeLines.length; i++) {
    if (!used[i]) {
      mappedBlocks.push({
        text: codeLines[i],
        start: i,
        end: i,
      });
      lineToBlockIndex[i] = mappedBlocks.length - 1;
      used[i] = true;
    }
  }
  // Sort blocks by start index to preserve original order
  mappedBlocks.sort((a, b) => a.start - b.start);
  return { mappedBlocks, lineToBlockIndex };
}

export default function Home() {
  // On load, get code from localStorage if present
  const [text, setText] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('codeInput');
      if (stored) return stored;
    }
    return DEFAULT_CODE_SAMPLES['python'];
  });
  const [blockData, setBlockData] = useState<{ start: number; end: number; text: string; explanation: string }[]>([]);
  const [lineToBlockIndex, setLineToBlockIndex] = useState<number[] | undefined>(undefined);
  const [aiLoading, setAILoading] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState("python");
  const [showLangWarning, setShowLangWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Remove extractedBlocks and blockApiLoading

  // Remove extractBlocksFromText and any fallback block splitting logic
  // Remove all Tree-sitter/paragraph splitting logic from the frontend
  // Only use Gemini for block splitting and explanation

  // 1. Reset blockData and currentBlock when code or language changes
  React.useEffect(() => {
    setCurrentBlock(0);
    setBlockData([]);
    setError(null);
  }, [text, selectedLanguage]);

  // On window/tab close, remove code from localStorage
  useEffect(() => {
    const handleUnload = () => {
      localStorage.removeItem('codeInput');
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // 2. Always use the latest extractedBlocks for block navigation/highlighting before Gemini
  const blocks = blockData;

  // 3. After Gemini, blockData is mapped from the latest extractedBlocks (with explanations)
  // 4. Navigation buttons and highlighting use blockData if available, else fallback to blocks
  const arr = blockData.length > 0 ? blockData : blocks;
  const totalBlocks = arr.length;
  const hasBlocks = totalBlocks > 0 && text.trim().length > 0;
  const codeLineCount = text.split('\n').length;
  let highlightRange: [number, number] = arr[currentBlock]
    ? [arr[currentBlock].start, arr[currentBlock].end]
    : [0, 0];
  highlightRange = [
    Math.max(0, Math.min(highlightRange[0], codeLineCount - 1)),
    Math.max(0, Math.min(highlightRange[1], codeLineCount - 1)),
  ];
  const validHighlightRange =
    hasBlocks &&
    highlightRange[0] >= 0 &&
    highlightRange[1] < codeLineCount &&
    highlightRange[0] <= highlightRange[1];

  // 5. Navigation handlers always clamp to valid range
  const handlePrevBlock = () => setCurrentBlock((b) => Math.max(0, Math.min(totalBlocks - 1, b - 1)));
  const handleNextBlock = () => setCurrentBlock((b) => Math.max(0, Math.min(totalBlocks - 1, b + 1)));

  // 6. Pass correct props to CustomCodeVisualizer
  // Filter blockData to only valid blocks
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

  // Set current block based on a line number (from CodePanel)
  const setCurrentBlockForLine = useCallback(
    (line: number) => {
      const arr = blockData.length > 0 ? blockData : blocks;
      const idx = arr.findIndex((b) => line >= b.start && line <= b.end);
      if (idx !== -1 && idx !== currentBlock) setCurrentBlock(idx);
    },
    [blockData, blocks, currentBlock]
  );

  // Theme index for Lydia Hallie-style color variants
  const [themeIdx, setThemeIdx] = useState<number>(() => Math.floor(Math.random() * 20));

  // Handler to trigger AI explanation for all blocks
  // Only ever set text from user input or localStorage. Never overwrite text with Gemini output or processed code.
  const handleAIExplain = async () => {
    // Pick a new random theme for this session
    setThemeIdx(Math.floor(Math.random() * 20));
    setShowLangWarning(false);
    setAILoading(true);
    setBlockData([]);
    setCurrentBlock(0);
    setError(null);
    try {
      // 1. Store code in localStorage (raw user input only)
      localStorage.setItem('codeInput', text);
      // 2. Split into blocks with Gemini (always, regardless of code type)
      const geminiBlockTexts = await splitBlocksWithGemini(text, selectedLanguage);
      // Robustly map Gemini blocks to original code lines
      const { mappedBlocks: blocksToExplain, lineToBlockIndex } = mapBlocksToOriginalLines(text, geminiBlockTexts.map(b => b.text ?? b));
      // Filter out empty blocks (but keep misc block if it covers any lines)
      const nonEmptyBlocks = blocksToExplain.filter(b => b.text.trim().length > 0 && b.start <= b.end);
      if (nonEmptyBlocks.length === 0) {
        setError("No non-empty code blocks found.");
        setAILoading(false);
        return;
      }
      // 2. Get explanations for each block
      // Use explicit block numbering and a reference example in the prompt
      const numberedBlocks = nonEmptyBlocks.map((b, i) => `Block ${i + 1} (lines ${b.start + 1}-${b.end + 1}):\n${b.text}`).join('\n\n');
      const tripleBacktick = '```';
      let prompt;
      if (selectedLanguage === 'java') {
        prompt =
          "For each of the following code blocks, write a clear, beginner-friendly, and detailed explanation in valid Markdown format.\\n" +
          "- For Java, split each class into separate blocks for each method or constructor, not just the whole class. If there are top-level comments or fields, treat them as separate blocks as well.\\n" +
          "- Format any code as a code block in Markdown with the correct language label.\\n" +
          "- For inline code, use single backticks (like this).\\n" +
          "- Never output language names (like 'java') on their own line.\\n" +
          "- Never output escape characters (like \\n) as text; use real newlines.\\n" +
          "- Do not include any formatting that would break Markdown rendering.\\n" +
          "- Return only a JSON array of explanation strings, one for each block, in order. Do not mention block numbers or repeat the code.\\n\\n" +
          "Example input: Block 1: public class HelloWorld {\\n    public static void main(String[] args) {\\n        System.out.println(\\\"Hello, World!\\\");\\n    }\\n    private void greet() {\\n        System.out.println(\\\"Greetings!\\\");\\n    }\\n}\\n" +
          "Example output: [\\\"This block defines the main method, which is the entry point of the program. It prints 'Hello, World!' to the console. Newline Newline Java code for main method.\\\", \\\"This block defines a private method called greet that prints 'Greetings!' to the console. Newline Newline Java code for greet method.\\\"]\\n\\n" +
          "Now, here are the blocks: " + numberedBlocks;
      } else if (selectedLanguage === 'c' || selectedLanguage === 'cpp') {
        prompt =
          "For each of the following code blocks, write a clear, beginner-friendly, and detailed explanation in valid Markdown format.\\n" +
          "- If the explanation includes code, always wrap it in triple backticks (`) with the language tag (e.g., `" + selectedLanguage + "`) on the same line.\\n" +
          "- For inline code, use single backticks ( like this ).\\n" +
          "- Never output language names (like 'c++' or 'cpp') on their own line.\\n" +
          "- Never output escape characters (like \\n) as text; use real newlines.\\n" +
          "- Do not include any formatting that would break Markdown rendering.\\n" +
          "- Return only a JSON array of explanation strings, one for each block, in order. Do not mention block numbers or repeat the code.\\n\\n" +
          "Example input:\\nBlock 1:\\nint foo() {\\n    return 42;\\n}\\n\\nBlock 2:\\nint main() {\\n    printf(\\\"%d\\\", foo());\\n    return 0;\\n}\\n\\n" +
          "Example output:[\\\"This block defines a function called `foo` that returns the number 42.\\n\\n```" + selectedLanguage + "\\nint foo() {\\n    return 42;\\n}\\n```\\\",\\\"This block is the main function. It prints the result of calling `foo`, which is 42, and then returns 0.\\n\\n```" + selectedLanguage + "\\nint main() {\\n    printf(\\\"%d\\\", foo());\\n    return 0;\\n}\\n```\\\"]\\n\\n" +
          "Now, here are the blocks:\\n" + numberedBlocks;
      } else {
        prompt =
          "For each of the following code blocks, write a clear, beginner-friendly, and detailed explanation in valid Markdown format.\\n" +
          "- If the explanation includes code, always wrap it in triple backticks (`) with the language tag (e.g., `" + selectedLanguage + "`) on the same line.\\n" +
          "- For inline code, use single backticks ( like this ).\\n" +
          "- Never output language names (like 'python' or 'java') on their own line.\\n" +
          "- Never output escape characters (like \\n) as text; use real newlines.\\n" +
          "- Do not include any formatting that would break Markdown rendering.\\n" +
          "- Return only a JSON array of explanation strings, one for each block, in order. Do not mention block numbers or repeat the code.\\n\\n" +
          "Example input:\\nBlock 1:\\ndef foo():\\n    return 42\\n\\nBlock 2:\\nprint(foo())\\n\\n" +
          "Example output:[\\\"This block defines a function called `foo` that returns the number 42.\\n\\n```" + selectedLanguage + "\\ndef foo():\\n    return 42\\n```\\\",\\\"This block prints the result of calling the `foo` function, which is 42.\\n\\n```" + selectedLanguage + "\\nprint(foo())\\n```\\\"]\\n\\n" +
          "Now, here are the blocks:\\n" + numberedBlocks;
      }
      const body = {
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ]
      };
      const res = await fetch(GEMINI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": GEMINI_API_KEY
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Gemini API error (explanation): " + res.status);
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (selectedLanguage === 'c') {
        console.log('Gemini explanation rawText (C):', rawText);
      }
      let arr: any[] = [];
      let cleanedText = rawText.trim();
      // Remove code block markers if present
      cleanedText = cleanedText.replace(/```json|```/g, '').trim();
      // Try to parse the first valid JSON array
      const firstBracket = cleanedText.indexOf('[');
      const lastBracket = cleanedText.lastIndexOf(']');
      let parseError = false;
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        const arrayString = cleanedText.substring(firstBracket, lastBracket + 1);
        try {
          arr = JSON.parse(arrayString);
        } catch (e) {
          // Fallback: try to split manually if not valid JSON
          console.warn('[Gemini] Fallback: manual split of array string');
          arr = arrayString
            .slice(1, -1) // remove [ and ]
            .split(/"\s*,\s*"/)
            .map((s: string) => s.replace(/^"/, '').replace(/"$/, '').replace(/\\n/g, '\n'));
          // If still not an array, set parseError
          if (!Array.isArray(arr) || arr.length === 0) parseError = true;
        }
      } else {
        parseError = true;
      }
      console.log('[Gemini] nonEmptyBlocks.length:', nonEmptyBlocks.length, 'arr.length:', Array.isArray(arr) ? arr.length : 'not array');
      if (parseError || !Array.isArray(arr) || arr.length !== nonEmptyBlocks.length) {
        setError("Gemini explanation response (not JSON or block count mismatch):\n" + rawText);
        setBlockData([]);
        setAILoading(false);
        localStorage.removeItem('codeInput');
        return;
      }
      // Map explanations to blocks by array index
      // Improved: robustly wrap code in Markdown code blocks
      function ensureMarkdownBlocks(str: string, lang: string) {
        // If triple backticks are present, assume it's already formatted
        if (/```/.test(str)) return str.replace(/\\n/g, '\n');
        // Try to detect code lines (heuristic: indented or look like code)
        const lines = str.split('\n');
        let inCode = false;
        let result = [];
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          // Filter out lines that are just language names
          if (/^(python|c|cpp|java|javascript|c\+\+)$/i.test(line.trim())) continue;
          // Heuristic: line is code if indented or looks like code
          const isCode = /^\s{2,}|^\t|^def |^class |^function |^#include|^public |^int |^print\(|^console\.log|^std::|^System\.|^\w+\(.*\)/.test(line);
          if (isCode && !inCode) {
            result.push('```' + lang);
            inCode = true;
          }
          if (!isCode && inCode) {
            result.push('```');
            inCode = false;
          }
          result.push(line);
        }
        if (inCode) result.push('```');
        return result.join('\n').replace(/\\n/g, '\n');
      }
      const mapped = nonEmptyBlocks.map((b, i) => {
        let explanation = arr[i];
        if (explanation && typeof explanation === 'object') {
          explanation = explanation.explanation || Object.values(explanation)[0] || JSON.stringify(explanation);
        }
        // Post-process: ensure code blocks are formatted for ReactMarkdown
        let lang = selectedLanguage === 'cpp' ? 'cpp' : selectedLanguage;
        explanation = typeof explanation === 'string' ? ensureMarkdownBlocks(explanation, lang) : JSON.stringify(explanation);
        return {
          start: b.start,
          end: b.end,
          text: b.text,
          explanation
        };
      });
      setBlockData(mapped);
      setLineToBlockIndex(lineToBlockIndex);
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
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-base md:text-xl border border-gray-300 dark:border-gray-700 shadow-sm">Interactive Code Explainer</code>
        </h1>
      </header>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-2 py-6">
        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 rounded bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 font-semibold text-sm max-w-2xl w-full text-center">
            {error}
          </div>
        )}
        {/* Restore original conditional rendering for main content:
            Only show the visualizer/explanation panels if blockData (with explanations) is available and valid for navigation/highlighting.
            Otherwise, always show the code input page. */}
        {!(blockData.length > 0 && validHighlightRange && !error) ? (
          <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
            <div className="flex items-center justify-between text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              <span>Code Input</span>
              <select
                className="ml-4 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-base"
                value={selectedLanguage}
                onChange={e => {
                  const newLang = e.target.value;
                  // Only replace code if it matches the default for the previous language
                  if (text === DEFAULT_CODE_SAMPLES[selectedLanguage]) {
                    setText(DEFAULT_CODE_SAMPLES[newLang] || '');
                  }
                  setSelectedLanguage(newLang);
                }}
              >
                {LANGUAGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {showLangWarning && (
              <div className="mb-2 p-3 rounded bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 font-semibold text-sm">
                The code you entered appears to be in a different language than the selected option. Please select the correct language or update your code.
              </div>
            )}
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
                className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-400 transition text-xl text-gray-500 dark:text-gray-300 mr-2"
                aria-label="Back to Edit"
                onClick={() => { setBlockData([]); setError(null); }}
                tabIndex={0}
              >
                <span className="sr-only">Back to Edit</span>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5 4L8.5 11L14.5 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="w-screen max-w-none h-[80vh] md:h-[80vh] flex flex-col md:flex-row gap-8 transition-all duration-300">
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow items-stretch justify-stretch w-full md:w-[70vw]">
                {/* When passing blockData={arr} to CustomCodeVisualizer, ensure every block has explanation: string */}
                <CustomCodeVisualizer
                  code={text}
                  blockData={validBlocks}
                  currentBlock={currentBlock}
                  onPrevBlock={handlePrevBlock}
                  onNextBlock={handleNextBlock}
                  totalBlocks={validBlocks.length}
                  language={selectedLanguage}
                  lineToBlockIndex={lineToBlockIndex}
                  themeIdx={themeIdx}
                />
              </div>
              {/* Visual separator for desktop */}
              <div className="hidden md:block w-0.5 h-full bg-gradient-to-b from-blue-200/60 to-pink-100/60 mx-0" />
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 w-full md:w-[30vw] mt-4 md:mt-0">
                {/* Instead of passing className directly to ExplanationPanel, wrap it in a div with the desired classes */}
                <div className="break-words whitespace-pre-wrap overflow-x-auto max-w-full">
                  <ExplanationPanel
                    aiExplanation={typeof blockData[currentBlock]?.explanation === 'string' ? blockData[currentBlock].explanation : (blockData[currentBlock]?.explanation ? JSON.stringify(blockData[currentBlock].explanation) : "")}
                    aiLoading={aiLoading}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      {/* Footer */}
      <footer className="w-full py-4 text-center text-xs text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800">
        &copy; {new Date().getFullYear()} Interactive code explainer.
      </footer>
    </div>
  );
}