/* eslint-disable */
'use client';

import React, { useState, useCallback, useEffect } from "react";
import CodePanel from "../components/CodePanel";
import ExplanationPanel from "../components/ExplanationPanel";
import { CustomCodeVisualizer } from "../components/CodePanel";
import Link from 'next/link';

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
  const mainPrompt = `Split the code below into as many small, logical blocks as possible (functions, classes, or related statements). For large code, do not group unrelated code together. Each block must be a contiguous set of lines from the original code. Preserve all whitespace and empty lines. Output a JSON array of code blocks as strings, in order. Do not add, remove, or modify any lines. Be accurate.`;
  const fallbackPrompt = `If you cannot find logical blocks, split the code into the smallest possible units (statements or lines). Output a JSON array of code blocks as strings, in order. Do not add, remove, or modify any lines. Be accurate.`;

  async function getBlocks(prompt: string) {
    const body = {
      contents: [
        {
          parts: [
            { text: prompt },
            { text: '\n\nCode:\n' + code }
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
      arr = [code];
    }
    if (!Array.isArray(arr) || arr.length === 0) {
      arr = [code];
    }
    return arr;
  }

  let arr = await getBlocks(mainPrompt);
  if (arr.length === 1 && arr[0] === code) {
    arr = await getBlocks(fallbackPrompt);
  }
  return arr;
};

// Helper: Robustly map Gemini blocks to original code lines and guarantee every line is assigned
function mapBlocksToOriginalLines(originalCode: string, geminiBlocks: string[]) {
  const codeLines = originalCode.split('\n');
  const used = Array(codeLines.length).fill(false);
  const mappedBlocks = [];
  const lineToBlockIndex = Array(codeLines.length).fill(-1);
  let searchStart = 0;
  let lastNonEmptyBlockIdx = -1;

  for (const blockText of geminiBlocks) {
    const blockLines = blockText.split('\n');
    const blockLineCount = blockLines.length;
    let found = false;

    // 1. Exact match (all whitespace, all lines)
    for (let i = searchStart; i <= codeLines.length - blockLineCount; i++) {
      const candidate = codeLines.slice(i, i + blockLineCount);
      if (
        candidate.length === blockLines.length &&
        candidate.every((line, idx) => line === blockLines[idx]) &&
        candidate.every((_, idx) => !used[i + idx])
      ) {
        // Attach trailing empty lines to the previous block if not at start
        if (candidate.every(line => line.trim() === '') && mappedBlocks.length > 0) {
          for (let k = i; k < i + blockLineCount; k++) {
            used[k] = true;
            lineToBlockIndex[k] = mappedBlocks.length - 1;
          }
          searchStart = i + blockLineCount;
          found = true;
          break;
        }
        mappedBlocks.push({
          text: candidate.join('\n'),
          start: i,
          end: i + blockLineCount - 1,
        });
        for (let k = i; k < i + blockLineCount; k++) {
          used[k] = true;
          lineToBlockIndex[k] = mappedBlocks.length - 1;
        }
        searchStart = i + blockLineCount;
        found = true;
        if (candidate.some(line => line.trim() !== '')) lastNonEmptyBlockIdx = mappedBlocks.length - 1;
        break;
      }
    }

    // 2. Fuzzy match (ignore whitespace, preserve line count)
    if (!found) {
      for (let i = searchStart; i <= codeLines.length - blockLineCount; i++) {
        const candidate = codeLines.slice(i, i + blockLineCount);
        if (
          candidate.length === blockLines.length &&
          candidate.every((line, idx) => line.trim() === blockLines[idx].trim()) &&
          candidate.every((_, idx) => !used[i + idx])
        ) {
          // Attach trailing empty lines to the previous block if not at start
          if (candidate.every(line => line.trim() === '') && mappedBlocks.length > 0) {
            for (let k = i; k < i + blockLineCount; k++) {
              used[k] = true;
              lineToBlockIndex[k] = mappedBlocks.length - 1;
            }
            searchStart = i + blockLineCount;
            found = true;
            break;
          }
          mappedBlocks.push({
            text: candidate.join('\n'),
            start: i,
            end: i + blockLineCount - 1,
          });
          for (let k = i; k < i + blockLineCount; k++) {
            used[k] = true;
            lineToBlockIndex[k] = mappedBlocks.length - 1;
          }
          searchStart = i + blockLineCount;
          found = true;
          if (candidate.some(line => line.trim() !== '')) lastNonEmptyBlockIdx = mappedBlocks.length - 1;
          break;
        }
      }
    }

    // 3. Fuzzy match ignoring empty lines in both block and code
    if (!found) {
      const blockNonEmpty = blockLines.map((l, idx) => ({ l, idx })).filter(x => x.l.trim() !== '');
      for (let i = searchStart; i <= codeLines.length - blockNonEmpty.length; i++) {
        let match = true;
        for (let j = 0; j < blockNonEmpty.length; j++) {
          const codeIdx = i + j;
          if (
            codeLines[codeIdx].trim() !== blockNonEmpty[j].l.trim() ||
            used[codeIdx]
          ) {
            match = false;
            break;
          }
        }
        if (match) {
          // Map block lines to code lines, skipping empty lines in block
          let codeIdx = i;
          let blockIdx = 0;
          let start = -1, end = -1;
          while (blockIdx < blockLines.length && codeIdx < codeLines.length) {
            if (blockLines[blockIdx].trim() === '') {
              blockIdx++;
              continue;
            }
            if (codeLines[codeIdx].trim() === blockLines[blockIdx].trim() && !used[codeIdx]) {
              if (start === -1) start = codeIdx;
              end = codeIdx;
              used[codeIdx] = true;
              lineToBlockIndex[codeIdx] = mappedBlocks.length;
              blockIdx++;
              codeIdx++;
            } else {
              codeIdx++;
            }
          }
          if (start !== -1 && end !== -1) {
            mappedBlocks.push({
              text: codeLines.slice(start, end + 1).join('\n'),
              start,
              end,
            });
            found = true;
            searchStart = end + 1;
            if (codeLines.slice(start, end + 1).some(line => line.trim() !== '')) lastNonEmptyBlockIdx = mappedBlocks.length - 1;
            break;
          }
        }
      }
    }

    // 4. If block is only empty lines, attach to previous block if possible
    if (!found && blockLines.every(l => l.trim() === '') && mappedBlocks.length > 0) {
      let count = 0;
      for (let i = searchStart; i < codeLines.length && count < blockLines.length; i++) {
        if (!used[i] && codeLines[i].trim() === '') {
          used[i] = true;
          lineToBlockIndex[i] = mappedBlocks.length - 1;
          count++;
        }
      }
      if (count === blockLines.length) {
        found = true;
        searchStart += count;
      }
    }

    // 5. Last fallback: assign next unmatched lines
    if (!found) {
      const unmatched = [];
      for (let i = 0; i < codeLines.length && unmatched.length < blockLines.length; i++) {
        if (!used[i]) {
          unmatched.push(i);
          used[i] = true;
          lineToBlockIndex[i] = mappedBlocks.length;
        }
      }
      if (unmatched.length) {
        mappedBlocks.push({
          text: unmatched.map(i => codeLines[i]).join('\n'),
          start: unmatched[0],
          end: unmatched[unmatched.length - 1],
        });
        if (unmatched.some(i => codeLines[i].trim() !== '')) lastNonEmptyBlockIdx = mappedBlocks.length - 1;
      }
    }
  }

  // Add any remaining unmatched lines as their own blocks, but attach empty lines to previous block if possible
  for (let i = 0; i < codeLines.length; i++) {
    if (!used[i]) {
      if (codeLines[i].trim() === '' && mappedBlocks.length > 0) {
        lineToBlockIndex[i] = mappedBlocks.length - 1;
        used[i] = true;
        continue;
      }
      mappedBlocks.push({
        text: codeLines[i],
        start: i,
        end: i,
      });
      lineToBlockIndex[i] = mappedBlocks.length - 1;
      used[i] = true;
      if (codeLines[i].trim() !== '') lastNonEmptyBlockIdx = mappedBlocks.length - 1;
    }
  }
  mappedBlocks.sort((a, b) => a.start - b.start);
  return { mappedBlocks, lineToBlockIndex };
}

// Backend URLs for different languages
const BACKEND_URLS: Record<string, string> = {
  c: 'https://ccodes.onrender.com/api/code/', // C backend (production)
  python: 'https://python-codes.onrender.com/api/code/', // Python backend (production)
  java: 'https://javacodes.onrender.com/api/code/', // Java backend (production)
  cpp: 'https://cpp-codes-74kf.onrender.com/api/code/', // C++ backend (production)
  leetcode: 'https://leetcode-bot-a4i1.onrender.com/api/code/', // LeetCode bot backend
  // Add more as needed
};

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
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('selectedLanguage');
      if (storedLang) return storedLang;
    }
    return 'python';
  });
  const [showLangWarning, setShowLangWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchingCode, setFetchingCode] = useState(false);

  // Prefill code and language from codeId and lang in URL, using correct backend
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const codeId = urlParams.get('codeId');
      const lang = urlParams.get('lang');
      if (codeId && lang) {
        // Check if this is a LeetCode language (c, cpp, java, python)
        const leetcodeLanguages = ['c', 'cpp', 'java', 'python'];
        const backendUrl = leetcodeLanguages.includes(lang) 
          ? 'https://leetcode-bot-a4i1.onrender.com/api/code/' 
          : BACKEND_URLS[lang];
        
        if (backendUrl) {
          setFetchingCode(true);
          fetch(`${backendUrl}${codeId}?lang=${lang}`)
            .then(res => {
              if (!res.ok) throw new Error('Not found');
              return res.json();
            })
            .then(data => {
              if (data && data.code && data.lang) {
                setText(data.code);
                setSelectedLanguage(data.lang);
                localStorage.setItem('codeInput', data.code);
                localStorage.setItem('selectedLanguage', data.lang);
              }
            })
            .catch(() => {
              setError('Code not found or backend error.');
            })
            .finally(() => setFetchingCode(false));
        }
      }
    }
  }, []);

  // 1. Reset blockData and currentBlock when code or language changes
  React.useEffect(() => {
    setCurrentBlock(0);
    setBlockData([]);
    setError(null);
  }, [text, selectedLanguage]);

  // On window/tab close, remove all localStorage data
  useEffect(() => {
    const handleUnload = () => {
      localStorage.clear();
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
      let prompt = `For each of the following code blocks, write a clear, beginner-friendly, and detailed explanation in valid Markdown format. Do not mention AI, models, or that this is an automated explanation. Do not mention parsing, block splitting, or any technical process. Focus on what the code does, why, and how, in simple terms. If a block is complex, break down the logic step by step. Never say “this is a basic block overview” or similar. Return only a JSON array of explanation strings, one for each block, in order.`;
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
          explanation: 'Could not generate an explanation for this block.'
        }));
        setBlockData(fallbackExplanations);
        setLineToBlockIndex(lineToBlockIndex);
        setAILoading(false);
        return;
      }
      // Map explanations to blocks by array index (preserve order exactly)
      const explanations: string[] = Array.isArray(arr) ? arr.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return (item as { explanation?: string })?.explanation || JSON.stringify(item);
        }
        return String(item);
      }) : [];
      // Use the original mappedBlocks order, not filtered nonEmptyBlocks, to preserve block order
      const mapped = blocksToExplain.map((b, i) => ({
        start: b.start,
        end: b.end,
        text: b.text,
        explanation: explanations[i] || ''
      }));
      setBlockData(mapped);
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

  // Remove the blockSplitWarning and its display in the JSX

  // Loader overlay component
  function LoaderOverlay({ show }: { show: boolean }) {
    return show ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-gray-900/80 backdrop-blur-sm transition-opacity duration-300" aria-busy="true" role="status">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <svg className="animate-spin h-12 w-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-lg font-semibold text-blue-700 dark:text-blue-200">Generating explanation...</span>
        </div>
      </div>
    ) : null;
  }

  // Add a loader overlay for fetching code
  function FetchingOverlay({ show }: { show: boolean }) {
    return show ? (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 dark:bg-gray-900/80 backdrop-blur-sm transition-opacity duration-300" aria-busy="true" role="status">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <svg className="animate-spin h-12 w-12 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <span className="text-lg font-semibold text-blue-700 dark:text-blue-200">Fetching code...</span>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-100 to-gray-300 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-white/80 dark:bg-gray-900/80 shadow flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {/* Logo: Colorful code icon, clickable */}
          <Link href="/" passHref legacyBehavior>
            <a onClick={() => { setText(DEFAULT_CODE_SAMPLES['python']); setSelectedLanguage('python'); }} className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 via-purple-400 to-pink-400 shadow text-white mr-2 cursor-pointer" aria-label="Home">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="5" width="3" height="14" rx="1.5" fill="currentColor"/>
                <rect x="18" y="5" width="3" height="14" rx="1.5" fill="currentColor"/>
                <rect x="8" y="3" width="8" height="3" rx="1.5" fill="currentColor"/>
                <rect x="8" y="18" width="8" height="3" rx="1.5" fill="currentColor"/>
              </svg>
            </a>
          </Link>
          <span className="text-lg sm:text-xl md:text-2xl font-bold tracking-tight text-gray-900 dark:text-white select-none">
            Interactive Code Explainer
          </span>
          <span className="ml-2 px-2 py-0.5 rounded bg-yellow-300 text-yellow-900 text-xs font-bold align-middle" style={{letterSpacing: '0.05em'}}>Beta</span>
        </div>
      </header>
      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center w-full px-1 sm:px-2 py-4 sm:py-6">
        <FetchingOverlay show={fetchingCode} />
        {/* Error display */}
        {error && (
          <div className="mb-4 p-4 rounded-lg bg-gradient-to-r from-red-100 via-yellow-100 to-red-100 dark:from-red-900 dark:via-yellow-900 dark:to-red-900 text-red-900 dark:text-yellow-100 border-2 border-red-300 dark:border-red-700 font-bold text-base shadow-lg max-w-2xl w-full text-center animate-fade-in" role="alert" aria-live="polite">
            {error}
          </div>
        )}
        <LoaderOverlay show={aiLoading} />
        {!(blockData.length > 0 && validHighlightRange) ? (
          <div className="w-full max-w-lg sm:max-w-xl md:max-w-2xl mx-auto flex flex-col gap-4 sm:gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2 gap-2 sm:gap-0">
              <span>Code Input</span>
              <select
                className="ml-0 sm:ml-4 px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                value={selectedLanguage}
                onChange={e => {
                  const newLang = e.target.value;
                  setText(DEFAULT_CODE_SAMPLES[newLang] || '');
                  setSelectedLanguage(newLang);
                }}
                aria-label="Select programming language"
                disabled={fetchingCode || aiLoading}
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
              readOnly={fetchingCode || aiLoading}
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
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-grow items-stretch justify-stretch w-full lg:w-[70vw] max-w-full min-w-0" style={{height: '480px', maxHeight: '480px', minHeight: '320px'}}>
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
              <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 w-full lg:w-[30vw] mt-4 lg:mt-0 max-w-full min-w-0" style={{height: '480px', maxHeight: '480px', minHeight: '320px'}}>
                <div className="break-words whitespace-pre-wrap overflow-x-auto max-w-full h-full" style={{height: '100%'}}>
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
        &copy; {new Date().getFullYear()} Interactive code explainer (Beta).
      </footer>
      {/* Removed Debug Log panel and all related state, logic, and UI from the page. */}
    </div>
  );
}
