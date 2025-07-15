import React, { useRef } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { Extension } from "@codemirror/state";

import { useEffect, useState } from "react";
// (No Framer Motion: use only CSS transitions for block highlighting)
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';

// Add this to your globals.css:
// .block-highlight { background-color: rgba(255, 255, 0, 0.15); }
// .dark .block-highlight { background-color: rgba(255, 255, 100, 0.10); }

interface CodePanelProps {
  code: string;
  setCode: (val: string) => void;
  onAIExplain: () => void;
  aiLoading: boolean;
  highlightRange?: [number, number];
  hasBlocks?: boolean;
  currentBlock?: number;
  totalBlocks?: number;
  onPrevBlock?: () => void;
  onNextBlock?: () => void;
  setCurrentBlockForLine?: (line: number) => void;
  readOnly?: boolean;
  highlightClass?: string;
}

interface CustomCodeVisualizerProps {
  code: string;
  blockData: { start: number; end: number; text: string; explanation: string }[];
  currentBlock: number;
  onPrevBlock: () => void;
  onNextBlock: () => void;
  totalBlocks: number;
  language: string;
  lineToBlockIndex?: number[];
  themeIdx?: number;
}

const getLanguageExtension = (code: string): Extension => {
  if (/^\s*def |^\s*class |import |print\(/m.test(code)) return python();
  return cpp();
};

// Remove the getHighlightDecorations function entirely if it is not used

// Lydia Hallie-inspired THEMES array: each theme is a gradient+text color pair, all high-contrast
const THEMES = [
  // Light gradients for dark text
  { gradient: 'linear-gradient(90deg, #f9f9f9 0%, #ffe29f 100%)', textColor: '#222' },
  { gradient: 'linear-gradient(90deg, #e0eafc 0%, #cfdef3 100%)', textColor: '#222' },
  { gradient: 'linear-gradient(90deg, #fbc2eb 0%, #a6c1ee 100%)', textColor: '#222' },
  { gradient: 'linear-gradient(90deg, #f6d365 0%, #fda085 100%)', textColor: '#222' },
  { gradient: 'linear-gradient(90deg, #fceabb 0%, #f8b500 100%)', textColor: '#222' },
  // Dark gradients for white text
  { gradient: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', textColor: '#fff' },
  { gradient: 'linear-gradient(90deg, #232526 0%, #414345 100%)', textColor: '#fff' },
  { gradient: 'linear-gradient(90deg, #141e30 0%, #243b55 100%)', textColor: '#fff' },
  { gradient: 'linear-gradient(90deg, #0f2027 0%, #2c5364 100%)', textColor: '#fff' },
  { gradient: 'linear-gradient(90deg, #1a2980 0%, #26d0ce 100%)', textColor: '#fff' },
  // More Lydia Hallie-style variants
  { gradient: 'linear-gradient(90deg, #f7971e 0%, #ffd200 100%)', textColor: '#222' },
  { gradient: 'linear-gradient(90deg, #f857a6 0%, #ff5858 100%)', textColor: '#fff' },
  { gradient: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)', textColor: '#fff' },
  { gradient: 'linear-gradient(90deg, #30cfd0 0%, #330867 100%)', textColor: '#fff' },
  { gradient: 'linear-gradient(90deg, #5ee7df 0%, #b490ca 100%)', textColor: '#222' },
  { gradient: 'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)', textColor: '#fff' },
  { gradient: 'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)', textColor: '#222' },
  { gradient: 'linear-gradient(90deg, #fa709a 0%, #fee140 100%)', textColor: '#222' },
  { gradient: 'linear-gradient(90deg, #7f53ac 0%, #647dee 100%)', textColor: '#fff' },
];

// Helper to pick a random color for each block, never the same twice in a row
function getBlockColor(idx: number, prevIdx: number | null) {
  let colorIdx = Math.floor(Math.random() * THEMES.length);
  // Avoid same color as previous
  if (prevIdx !== null && colorIdx === prevIdx) {
    colorIdx = (colorIdx + 1) % THEMES.length;
  }
  return { color: THEMES[colorIdx].gradient, colorIdx };
}

// Add a helper to escape HTML
function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const CustomCodeVisualizer: React.FC<CustomCodeVisualizerProps> = ({
  code,
  blockData,
  currentBlock,
  onPrevBlock,
  onNextBlock,
  totalBlocks,
  lineToBlockIndex,
  themeIdx,
}) => {
  const [highlightedLines, setHighlightedLines] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const firstHighlightRef = useRef<HTMLDivElement>(null);
  // Remove audioRef, <audio> element, and useEffect for playing sound on currentBlock change.

  // Threshold for a 'long' line (in characters)
  const LONG_LINE_THRESHOLD = 80;

  useEffect(() => {
    setHighlightedLines(code.split("\n").map(escapeHtml));
  }, [code]);

  // Scroll current block into view on block change (mobile and desktop)
  useEffect(() => {
    if (firstHighlightRef.current) {
      firstHighlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentBlock, code]);

  // Remove the useEffect that plays audio on currentBlock change.

  // Use lineToBlockIndex if provided, else fallback to blockData's start/end
  let blockLineSet: Set<number>;
  if (lineToBlockIndex) {
    blockLineSet = new Set(lineToBlockIndex.map((bIdx, i) => bIdx === currentBlock ? i : null).filter(i => i !== null));
  } else {
    const block = blockData[currentBlock];
    if (block) {
      const start = block.start ?? 0;
      const end = block.end ?? 0;
      blockLineSet = new Set();
      for (let i = start; i <= end; ++i) blockLineSet.add(i);
    } else {
      blockLineSet = new Set();
    }
  }

  // (Removed start/end/adjustedStart/adjustedEnd logic; handled by lineToBlockIndex and per-line rendering)

  // Pick a theme index for the session (random on each explanation generation)
  // Use themeIdx from props if provided, else pick random
  let themeIndex = typeof themeIdx === 'number' ? themeIdx : Math.floor(Math.random() * THEMES.length);
  if (isNaN(themeIndex) || themeIndex < 0 || themeIndex >= THEMES.length) themeIndex = 0;
  const blockGradient = THEMES[themeIndex].gradient;
  const blockTextColor = THEMES[themeIndex].textColor;
  const blockHighlightClass = "block-highlight-animated border-l-4 border-blue-400";

  return (
    <div className="relative h-full w-full flex flex-col p-0 m-0">
      {/* Sound effect audio element */}
      {/* Remove audioRef, <audio> element, and useEffect for playing sound on currentBlock change. */}
      <div
        className="flex-1 bg-gradient-to-br from-blue-50/80 to-purple-100/80 dark:from-gray-900 dark:to-gray-950 w-full h-full flex flex-col justify-stretch p-2 sm:p-4 md:p-6 lg:p-10 border-0 shadow-none rounded-none min-w-0 code-content"
        style={{ paddingBottom: '4.5rem' }}
      >
        <div
          ref={scrollRef}
          style={{ position: 'relative', maxHeight: '28rem', overflowY: 'auto', minHeight: '10rem' }}
          className="font-mono text-sm sm:text-base leading-relaxed select-none w-full h-full min-h-0 flex-1 px-0 py-0 m-0 border-0 transition-all duration-500"
        >
          {highlightedLines.map((line, idx) => {
            const isCurrentBlock = lineToBlockIndex
              ? lineToBlockIndex[idx] === currentBlock
              : (() => {
                  const block = blockData[currentBlock];
                  return block && idx >= block.start && idx <= block.end;
                })();
            const wrapStyles: React.CSSProperties = {
              wordBreak: 'break-all',
              whiteSpace: 'pre-wrap',
              position: 'relative',
              zIndex: 1,
            };
            return (
              <div
                key={`block-line-${idx}`}
                style={{ position: 'relative', minHeight: '1.5em' }}
                ref={isCurrentBlock && blockLineSet.has(idx) && [...blockLineSet][0] === idx ? firstHighlightRef : undefined}
              >
                {isCurrentBlock && (
                  <div
                    className="block-highlight-animated"
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      width: '100%',
                      height: '100%',
                      zIndex: 0,
                      pointerEvents: 'none',
                    }}
                  />
                )}
                <span
                  style={wrapStyles}
                  className={
                    isCurrentBlock
                      ? ''
                      : 'code-line-blur text-gray-700 dark:text-gray-300'
                  }
                  dangerouslySetInnerHTML={{ __html: line }}
                />
              </div>
            );
          })}
        </div>
        {/* Desktop navigation controls */}
        <div className="hidden sm:flex mt-3 sm:mt-4 flex-row items-center justify-center gap-2 sm:gap-4 w-full">
          <button
            className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 font-bold shadow cursor-pointer min-w-[44px] min-h-[44px] text-base flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={onPrevBlock}
            disabled={currentBlock === 0}
            aria-label="Previous block"
          >
            <FaChevronLeft aria-hidden="true" /> Prev
          </button>
          <button
            className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-green-400 hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white disabled:opacity-50 font-bold shadow transition-colors duration-200 cursor-pointer min-w-[44px] min-h-[44px] text-base flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={onNextBlock}
            disabled={currentBlock === totalBlocks - 1}
            aria-label="Next block"
          >
            Next <FaChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      {/* Mobile sticky bottom navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 w-full z-50 bg-white/95 dark:bg-gray-900/95 shadow-[0_-2px_12px_0_rgba(56,189,248,0.10)] border-t border-gray-200 dark:border-gray-700 flex flex-row justify-center items-center gap-3 py-2 px-4" style={{backdropFilter: 'blur(8px)'}} aria-label="Block navigation">
        <button
          className="inline-flex items-center justify-center min-w-[70px] min-h-[44px] px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 shadow hover:bg-blue-100 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition text-sm font-bold"
          onClick={onPrevBlock}
          disabled={currentBlock === 0}
          aria-label="Previous block"
        >
          <FaChevronLeft aria-hidden="true" className="text-sm mr-1" />
          <span className="text-xs">Prev</span>
        </button>
        <div className="text-gray-400 text-xs select-none px-2 flex-shrink-0">Block {currentBlock + 1} / {totalBlocks}</div>
        <button
          className="inline-flex items-center justify-center min-w-[70px] min-h-[44px] px-3 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 shadow hover:bg-green-100 dark:hover:bg-emerald-900 hover:text-green-700 dark:hover:text-green-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 transition text-sm font-bold"
          onClick={onNextBlock}
          disabled={currentBlock === totalBlocks - 1}
          aria-label="Next block"
        >
          <span className="text-xs">Next</span>
          <FaChevronRight aria-hidden="true" className="text-sm ml-1" />
        </button>
      </nav>
    </div>
  );
};

const CodePanel: React.FC<CodePanelProps> = ({ code, setCode, onAIExplain, aiLoading, highlightRange, hasBlocks, currentBlock, totalBlocks, onPrevBlock, onNextBlock, setCurrentBlockForLine, readOnly, highlightClass }) => {
  const codeLines = code.split('\n');
  const validHighlight =
    highlightRange &&
    Array.isArray(highlightRange) &&
    highlightRange[0] >= 0 &&
    highlightRange[1] >= highlightRange[0] &&
    codeLines.length > 0 &&
    highlightRange[1] < codeLines.length &&
    hasBlocks;
  const extensions: Extension[] = [getLanguageExtension(code)];
  if (validHighlight) {
    // The getHighlightDecorations function was removed, so this block is now effectively a no-op.
    // If specific highlighting is needed, it should be re-added or handled differently.
    // For now, we'll keep the structure but remove the call to the non-existent function.
    // extensions.push(getHighlightDecorations(code, highlightRange)); // This line is removed
  }

  // Handler for cursor activity
  const handleUpdate = React.useCallback((vu: unknown) => {
    if (vu && typeof vu === 'object' && 'selectionSet' in vu && setCurrentBlockForLine) {
      const vuState = vu as unknown;
      const line = (vuState as any).state.doc.lineAt((vuState as any).state.selection.main.head).number - 1;
      setCurrentBlockForLine(line);
    }
  }, [setCurrentBlockForLine]);

  return (
    <div className="h-full w-full p-2 sm:p-4 bg-gray-900 text-white rounded-lg shadow-xl flex flex-col border border-gray-800/60 min-w-0 code-panel">
      <div className="flex-1 overflow-auto transition-opacity duration-200 min-w-0">
        <CodeMirror
          value={code}
          height="100%"
          theme={oneDark}
          extensions={extensions}
          onChange={setCode}
          onUpdate={setCurrentBlockForLine ? handleUpdate : undefined}
          className="rounded-lg font-mono text-sm sm:text-base min-h-[120px] sm:min-h-[180px] border border-gray-800 h-full min-w-0"
          basicSetup={{ lineNumbers: true, highlightActiveLine: true }}
          readOnly={readOnly ?? false}
        />
      </div>
      <div className="mt-3 sm:mt-4 flex flex-row items-center justify-center gap-2 sm:gap-4 w-full">
        {hasBlocks && onPrevBlock && (
          <button
            className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 min-w-[44px] min-h-[44px] text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={onPrevBlock}
            disabled={currentBlock === 0 || aiLoading}
            aria-label="Previous block"
          >
            Prev
          </button>
        )}
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition disabled:opacity-50 min-w-[44px] min-h-[44px] text-base"
          onClick={onAIExplain}
          disabled={aiLoading}
          aria-label="Generate AI explanation"
        >
          {aiLoading ? (
            <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Loading...</span>
          ) : (
            "Generate Explanation"
          )}
        </button>
        {hasBlocks && onNextBlock && (
          <button
            className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 min-w-[44px] min-h-[44px] text-base focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            onClick={onNextBlock}
            disabled={currentBlock === ((totalBlocks ?? 1) - 1) || aiLoading}
            aria-label="Next block"
          >
            Next
          </button>
        )}
      </div>
      {hasBlocks && currentBlock !== undefined && totalBlocks !== undefined && (
        <div className="flex justify-center mt-2 text-gray-400 text-xs select-none">
          Block {currentBlock + 1} / {totalBlocks}
        </div>
      )}
    </div>
  );
};

export default CodePanel; 