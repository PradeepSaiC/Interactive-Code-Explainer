'use client';

import React, { useState, useCallback, useEffect } from "react";
import CodePanel from "../components/CodePanel";
import ExplanationPanel from "../components/ExplanationPanel";
import { CustomCodeVisualizer } from "../components/CodePanel";

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

// Remove all Tree-sitter and paragraph splitting logic from the frontend
// Use Gemini for both block splitting and explanation

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const splitBlocksWithGemini = async (code: string, language: string) => {
  const prompt = `Divide the following code into explainable blocks. Return a JSON array of code blocks, in order. Each block should be a string of code. Do not include explanations or extra text.\n\nCode:\n${code}`;
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
      "X-goog-api-key": GEMINI_API_KEY || ""
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
    // If parsing fails, treat the entire code as a single block
    arr = [code];
  }
  if (!Array.isArray(arr) || arr.length === 0) {
    // If still no blocks, treat the entire code as a single block
    arr = [code];
  }
  return arr;
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
      if (geminiBlockTexts.length === 1 && geminiBlockTexts[0] === text) {
        setBlockSplitWarning('Could not split code into blocks. Showing explanation for the entire code.');
      } else {
        setBlockSplitWarning(null);
      }
      // Robustly map Gemini blocks to original code lines
      const { mappedBlocks: blocksToExplain, lineToBlockIndex } = mapBlocksToOriginalLines(text, geminiBlockTexts);
      // Filter out empty blocks (but keep misc block if it covers any lines)
      const nonEmptyBlocks = blocksToExplain.filter(b => b.text.trim().length > 0 && b.start <= b.end);
      if (nonEmptyBlocks.length === 0) {
        setError("No non-empty code blocks found.");
        setAILoading(false);
        return;
      }
      // 3. Get explanations for each block
      // Use explicit block numbering and a reference example in the prompt
      const numberedBlocks = nonEmptyBlocks.map((b, i) => `Block ${i + 1} (lines ${b.start + 1}-${b.end + 1}):\n${b.text}`).join('\n\n');
      let prompt = "";
      if (selectedLanguage === 'c' || selectedLanguage === 'cpp') {
        prompt =
          "You are an expert programming tutor. For each of the following code blocks, write a clear, beginner-friendly, and detailed explanation in valid Markdown format.\\n" +
          "- IMPORTANT: Return EXPLANATIONS, not the code itself. Do not return the code blocks as-is.\\n" +
          "- If the explanation includes code examples, always wrap them in triple backticks with the language tag (e.g., `" + selectedLanguage + "`).\\n" +
          "- For inline code references, use single backticks (like `variable_name`).\\n" +
          "- Never output language names (like 'c++' or 'cpp') on their own line.\\n" +
          "- Never output escape characters (like \\n) as text; use real newlines.\\n" +
          "- Do not include any formatting that would break Markdown rendering.\\n" +
          "- Return only a JSON array of explanation strings, one for each block, in order.\\n" +
          "- Each explanation should explain what the code does, not repeat the code.\\n" +
          "- Focus on explaining the purpose, logic, and functionality of each code block.\\n\\n" +
          "Example input:\\nBlock 1:\\nint foo() {\\n    return 42;\\n}\\n\\nBlock 2:\\nint main() {\\n    printf(\\\"%d\\\", foo());\\n    return 0;\\n}\\n\\n" +
          "Example output:[\\\"This block defines a function called `foo` that returns the number 42. The function has no parameters and simply returns a constant value.\\\",\\\"This block is the main function, which is the entry point of the program. It calls the `foo` function and prints the result (42) to the console using `printf`. The function then returns 0 to indicate successful execution.\\\"]\\n\\n" +
          "Now, here are the blocks to explain:\\n" + numberedBlocks;
      } else if (selectedLanguage === 'java') {
        prompt =
          "You are an expert programming tutor. For each of the following code blocks, write a clear, beginner-friendly, and detailed explanation in valid Markdown format.\\n" +
          "- IMPORTANT: Return EXPLANATIONS, not the code itself. Do not return the code blocks as-is.\\n" +
          "- If the explanation includes code examples, always wrap them in triple backticks with the language tag (e.g., `java`).\\n" +
          "- For inline code references, use single backticks (like `variable_name`).\\n" +
          "- Never output language names (like 'java') on their own line.\\n" +
          "- Never output escape characters (like \\n) as text; use real newlines.\\n" +
          "- Do not include any formatting that would break Markdown rendering.\\n" +
          "- Return only a JSON array of explanation strings, one for each block, in order.\\n" +
          "- Each explanation should explain what the code does, not repeat the code.\\n" +
          "- Focus on explaining the purpose, logic, and functionality of each code block.\\n\\n" +
          "Example input: Block 1: public class HelloWorld {\\n    public static void main(String[] args) {\\n        System.out.println(\\\"Hello, World!\\\");\\n    }\\n    private void greet() {\\n        System.out.println(\\\"Greetings!\\\");\\n    }\\n}\\n" +
          "Example output: [\\\"This block defines the main method, which is the entry point of the program. It prints 'Hello, World!' to the console.\\\", \\\"This block defines a private method called greet that prints 'Greetings!' to the console.\\\"]\\n\\n" +
          "Now, here are the blocks to explain: " + numberedBlocks;
      } else if (selectedLanguage === 'javascript') {
        prompt =
          "You are an expert programming tutor. For each of the following code blocks, write a clear, beginner-friendly, and detailed explanation in valid Markdown format.\\n" +
          "- IMPORTANT: Return EXPLANATIONS, not the code itself. Do not return the code blocks as-is.\\n" +
          "- If the explanation includes code examples, always wrap them in triple backticks with the language tag (e.g., `javascript`).\\n" +
          "- For inline code references, use single backticks (like `variable_name`).\\n" +
          "- Never output language names (like 'javascript' or 'js') on their own line.\\n" +
          "- Never output escape characters (like \\n) as text; use real newlines.\\n" +
          "- Do not include any formatting that would break Markdown rendering.\\n" +
          "- Return only a JSON array of explanation strings, one for each block, in order.\\n" +
          "- Each explanation should explain what the code does, not repeat the code.\\n" +
          "- Focus on explaining the purpose, logic, and functionality of each code block.\\n\\n" +
          "Example input:\\nBlock 1:\\nfunction foo() {\\n    return 42;\\n}\\n\\nBlock 2:\\nconsole.log(foo());\\n\\n" +
          "Example output:[\\\"This block defines a function called `foo` that returns the number 42. The function has no parameters and simply returns a constant value.\\\",\\\"This block calls the `foo` function and prints its return value (42) to the console using `console.log`.\\\"]\\n\\n" +
          "Now, here are the blocks to explain:\\n" + numberedBlocks;
      } else {
        prompt =
          "You are an expert programming tutor. For each of the following code blocks, write a clear, beginner-friendly, and detailed explanation in valid Markdown format.\\n" +
          "- IMPORTANT: Return EXPLANATIONS, not the code itself. Do not return the code blocks as-is.\\n" +
          "- If the explanation includes code examples, always wrap them in triple backticks with the language tag (e.g., `" + selectedLanguage + "`).\\n" +
          "- For inline code references, use single backticks (like `variable_name`).\\n" +
          "- Never output language names (like 'python' or 'java') on their own line.\\n" +
          "- Never output escape characters (like \\n) as text; use real newlines.\\n" +
          "- Do not include any formatting that would break Markdown rendering.\\n" +
          "- Return only a JSON array of explanation strings, one for each block, in order.\\n" +
          "- Each explanation should explain what the code does, not repeat the code.\\n" +
          "- Focus on explaining the purpose, logic, and functionality of each code block.\\n\\n" +
          "Example input:\\nBlock 1:\\ndef foo():\\n    return 42\\n\\nBlock 2:\\nprint(foo())\\n\\n" +
          "Example output:[\\\"This block defines a function called `foo` that returns the number 42. The function has no parameters and simply returns a constant value.\\\",\\\"This block calls the `foo` function and prints its return value (42) to the console using the `print` function.\\\"]\\n\\n" +
          "Now, here are the blocks to explain:\\n" + numberedBlocks;
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
          "X-goog-api-key": GEMINI_API_KEY || ""
        },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error("Gemini API error (explanation): " + res.status);
      const data = await res.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (selectedLanguage === 'c') {
        // addLog('Gemini explanation rawText (C): ' + rawText); // Removed
      }
      let arr: unknown[] = [];
      let cleanedText = rawText.trim();
      
      // Handle Gemini responses wrapped in markdown code blocks
      // Pattern: ```json [ ... ] ```
      const jsonCodeBlockMatch = cleanedText.match(/```json\s*(\[[\s\S]*?\])\s*```/);
      if (jsonCodeBlockMatch) {
        try {
          arr = JSON.parse(jsonCodeBlockMatch[1]);
        } catch (e) {
          // addLog('[Gemini] Failed to parse JSON from code block: ' + e); // Removed
        }
      } else {
        // Fallback: try to extract JSON array from the text
        // Remove code block markers if present
        cleanedText = cleanedText.replace(/```json|```/g, '').trim();
        // Try to parse the first valid JSON array
        const firstBracket = cleanedText.indexOf('[');
        const lastBracket = cleanedText.lastIndexOf(']');
        if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
          const arrayString = cleanedText.substring(firstBracket, lastBracket + 1);
          try {
            arr = JSON.parse(arrayString);
          } catch (e) {
            // Fallback: try to split manually if not valid JSON
            // addLog('[Gemini] Fallback: manual split of array string'); // Removed
            arr = arrayString
              .slice(1, -1) // remove [ and ]
              .split(/"\s*,\s*"/)
              .map((s: string) => s.replace(/^"/, '').replace(/"$/, '').replace(/\\n/g, '\n'));
          }
        }
      }
      
      // addLog(`[Gemini] nonEmptyBlocks.length: ${nonEmptyBlocks.length}, arr.length: ${Array.isArray(arr) ? arr.length : 'not array'}`); // Removed
      // addLog('[Gemini] Raw response: ' + rawText); // Removed
      // addLog('[Gemini] Parsed array: ' + JSON.stringify(arr)); // Removed
      
      // Check if Gemini returned code blocks instead of explanations
      if (Array.isArray(arr) && arr.length > 0) {
        const firstItem = arr[0];
        if (typeof firstItem === 'string') {
          // More specific check: look for code that starts with common programming patterns
          // and doesn't contain explanation-like text
          const codeStartPatterns = [
            /^#include/, /^int main/, /^def /, /^function /, /^class /, /^public /, /^private /, /^protected /,
            /^import /, /^from /, /^console\.log/, /^printf/, /^System\.out/, /^return /, /^if \(/, /^for \(/, /^while \(/,
            /^const /, /^let /, /^var /, /^std::/, /^using namespace/, /^namespace /, /^package /, /^public class/
          ];
          const explanationPatterns = [
            /this block/, /this code/, /this function/, /this method/, /this class/, /explains/, /defines/, /creates/,
            /prints/, /returns/, /calculates/, /initializes/, /declares/, /assigns/, /calls/, /executes/
          ];
          
          const startsWithCode = codeStartPatterns.some(pattern => pattern.test(firstItem.trim()));
          const containsExplanation = explanationPatterns.some(pattern => pattern.test(firstItem.toLowerCase()));
          
          // addLog('[Gemini] Detection debug: ' + JSON.stringify({ // Removed
          //   firstItem: firstItem.substring(0, 100) + '...', // Removed
          //   startsWithCode, // Removed
          //   containsExplanation, // Removed
          //   willTriggerFallback: startsWithCode && !containsExplanation // Removed
          // })); // Removed
          
          // Only trigger fallback if it starts with code AND doesn't contain explanation text
          if (startsWithCode && !containsExplanation) {
            // addLog('[Gemini] Detected code blocks instead of explanations, creating fallback'); // Removed
            const fallbackExplanations = nonEmptyBlocks.map((block, index) => ({
              start: block.start,
              end: block.end,
              text: block.text,
              explanation: `Block ${index + 1} (lines ${block.start + 1}-${block.end + 1}):\n\nThis code block contains:\n\`\`\`${selectedLanguage}\n${block.text}\n\`\`\`\n\n*Note: AI returned code blocks instead of explanations. This is a basic block overview.*`
            }));
            setBlockData(fallbackExplanations);
            setLineToBlockIndex(lineToBlockIndex);
            setAILoading(false);
            return;
          }
        }
      }
      
      if (!Array.isArray(arr) || arr.length !== nonEmptyBlocks.length) {
        // Fallback: create basic explanations if parsing fails
        // addLog('[Gemini] Creating fallback explanations due to parsing error'); // Removed
        const fallbackExplanations = nonEmptyBlocks.map((block, index) => ({
          start: block.start,
          end: block.end,
          text: block.text,
          explanation: `Block ${index + 1} (lines ${block.start + 1}-${block.end + 1}):\n\nThis code block contains:\n\`\`\`${selectedLanguage}\n${block.text}\n\`\`\`\n\n*Note: AI explanation parsing failed. This is a basic block overview.*`
        }));
        setBlockData(fallbackExplanations);
        setLineToBlockIndex(lineToBlockIndex);
        setAILoading(false);
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
      const explanations: string[] = arr.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          // Try to extract explanation property or stringify
          return (item as { explanation?: string })?.explanation || JSON.stringify(item);
        }
        return String(item);
      });
      const mapped = nonEmptyBlocks.map((b, i) => {
        return {
          start: b.start,
          end: b.end,
          text: b.text,
          explanation: explanations[i] || ''
        };
      });
      setBlockData(
        mapped.map((b: { start: number; end: number; text: string }, i: number) => ({ ...b, explanation: explanations[i] || '' }))
      );
      setLineToBlockIndex(lineToBlockIndex);
    } catch (e: unknown) {
      setError('An error occurred. Please try again later.');
      setBlockData([]);
    }
    setAILoading(false);
  };

  // function addLog(msg: string) { // Removed
  //   setDebugLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]); // Removed
  // } // Removed

  const [blockSplitWarning, setBlockSplitWarning] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/80 dark:bg-gray-900/80 shadow flex items-center justify-between sticky top-0 z-10">
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          <code className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono text-base sm:text-lg md:text-xl border border-gray-300 dark:border-gray-700 shadow-sm">Interactive Code Explainer</code>
        </h1>
      </header>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-1 sm:px-2 py-4 sm:py-6">
        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-red-100 via-yellow-100 to-red-100 dark:from-red-900 dark:via-yellow-900 dark:to-red-900 text-red-900 dark:text-yellow-100 border-2 border-red-300 dark:border-red-700 font-bold text-base shadow-lg max-w-2xl w-full text-center animate-fade-in" role="alert" aria-live="polite">
            {error}
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-300">See Debug Log for more details.</div>
          </div>
        )}
        {blockSplitWarning && (
          <div className="mb-4 p-3 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 font-semibold text-sm max-w-2xl w-full text-center animate-fade-in" role="alert" aria-live="polite">
            {blockSplitWarning}
          </div>
        )}
        {!(blockData.length > 0 && validHighlightRange) ? (
          <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 gap-2 sm:gap-0">
              <span>Code Input</span>
              <select
                className="ml-0 sm:ml-4 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                value={selectedLanguage}
                onChange={e => {
                  const newLang = e.target.value;
                  if (text === DEFAULT_CODE_SAMPLES[selectedLanguage]) {
                    setText(DEFAULT_CODE_SAMPLES[newLang] || '');
                  }
                  setSelectedLanguage(newLang);
                }}
                aria-label="Select programming language"
              >
                {LANGUAGE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            {showLangWarning && (
              <div className="mb-2 p-3 rounded bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-700 font-semibold text-sm" role="alert" aria-live="polite">
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
              <div className="mb-2 p-3 rounded bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700 font-semibold text-sm mt-2" role="alert" aria-live="polite">
                No valid blocks to highlight. Please check your code or try again.
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex w-full items-center mb-2 md:mb-4 mt-[-1.5rem]">
              <button
                className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition text-xl text-gray-500 dark:text-gray-300 mr-2"
                aria-label="Back to code input"
                onClick={() => { setBlockData([]); setError(null); }}
                tabIndex={0}
              >
                <span className="sr-only">Back to Edit</span>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.5 4L8.5 11L14.5 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
            <div className="w-full flex flex-col lg:flex-row gap-4 md:gap-8 transition-all duration-300 max-w-full">
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow items-stretch justify-stretch w-full lg:w-[70vw] max-w-full min-w-0">
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
              <div className="hidden lg:block w-0.5 h-full bg-gradient-to-b from-blue-200/60 to-pink-100/60 mx-0" aria-hidden="true" />
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 w-full lg:w-[30vw] mt-4 lg:mt-0 max-w-full min-w-0">
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
      <footer className="w-full py-3 sm:py-4 text-center text-xs text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-800">
        &copy; {new Date().getFullYear()} Interactive code explainer.
      </footer>
      {/* Removed Debug Log panel and all related state, logic, and UI from the page. */}
    </div>
  );
}