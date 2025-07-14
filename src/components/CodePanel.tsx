import React from "react";
import CodeMirror from "@uiw/react-codemirror";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView, Decoration, ViewUpdate } from "@codemirror/view";
import { Extension, RangeSetBuilder } from "@codemirror/state";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import * as shiki from "shiki";

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
}

const getLanguageExtension = (code: string): Extension => {
  if (/^\s*def |^\s*class |import |print\(/m.test(code)) return python();
  return cpp();
};

function getHighlightDecorations(code: string, highlightRange?: [number, number]): Extension {
  return EditorView.decorations.compute([], (state) => {
    const builder = new RangeSetBuilder<Decoration>();
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = state.doc.line(i + 1); // CodeMirror lines are 1-based
      if (
        highlightRange &&
        i >= highlightRange[0] &&
        i <= highlightRange[1]
      ) {
        builder.add(line.from, line.to, Decoration.line({ attributes: { class: "block-highlight-animated" } }));
      }
      // All other lines remain normal
    }
    return builder.finish();
  });
}

// Lydia Hallie-inspired color/gradient palette
const BLOCK_COLORS = [
  'linear-gradient(90deg, #f9d423 0%, #ff4e50 100%)',
  'linear-gradient(90deg, #a1c4fd 0%, #c2e9fb 100%)',
  'linear-gradient(90deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(90deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(90deg, #f857a6 0%, #ff5858 100%)',
  'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
  'linear-gradient(90deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(90deg, #5ee7df 0%, #b490ca 100%)',
  'linear-gradient(90deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(90deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(90deg, #7f53ac 0%, #647dee 100%)',
  'linear-gradient(90deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(90deg, #c471f5 0%, #fa71cd 100%)',
  'linear-gradient(90deg, #48c6ef 0%, #6f86d6 100%)',
  'linear-gradient(90deg, #9795f0 0%, #fbc7d4 100%)',
  'linear-gradient(90deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(90deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(90deg, #f857a6 0%, #ff5858 100%)',
  'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
  'linear-gradient(90deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(90deg, #5ee7df 0%, #b490ca 100%)',
  'linear-gradient(90deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(90deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(90deg, #7f53ac 0%, #647dee 100%)',
  'linear-gradient(90deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(90deg, #c471f5 0%, #fa71cd 100%)',
  'linear-gradient(90deg, #48c6ef 0%, #6f86d6 100%)',
  'linear-gradient(90deg, #9795f0 0%, #fbc7d4 100%)',
  'linear-gradient(90deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(90deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(90deg, #f857a6 0%, #ff5858 100%)',
  'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
  'linear-gradient(90deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(90deg, #5ee7df 0%, #b490ca 100%)',
  'linear-gradient(90deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(90deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(90deg, #7f53ac 0%, #647dee 100%)',
  'linear-gradient(90deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(90deg, #c471f5 0%, #fa71cd 100%)',
  'linear-gradient(90deg, #48c6ef 0%, #6f86d6 100%)',
  'linear-gradient(90deg, #9795f0 0%, #fbc7d4 100%)',
  'linear-gradient(90deg, #fbc2eb 0%, #a6c1ee 100%)',
  'linear-gradient(90deg, #f7971e 0%, #ffd200 100%)',
  'linear-gradient(90deg, #f857a6 0%, #ff5858 100%)',
  'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
  'linear-gradient(90deg, #30cfd0 0%, #330867 100%)',
  'linear-gradient(90deg, #5ee7df 0%, #b490ca 100%)',
  'linear-gradient(90deg, #f6d365 0%, #fda085 100%)',
  'linear-gradient(90deg, #f093fb 0%, #f5576c 100%)',
  'linear-gradient(90deg, #4facfe 0%, #00f2fe 100%)',
  'linear-gradient(90deg, #43e97b 0%, #38f9d7 100%)',
  'linear-gradient(90deg, #fa709a 0%, #fee140 100%)',
  'linear-gradient(90deg, #7f53ac 0%, #647dee 100%)',
];

// Helper to pick a random color for each block, never the same twice in a row
function getBlockColor(idx: number, prevIdx: number | null) {
  let colorIdx = Math.floor(Math.random() * BLOCK_COLORS.length);
  // Avoid same color as previous
  if (prevIdx !== null && colorIdx === prevIdx) {
    colorIdx = (colorIdx + 1) % BLOCK_COLORS.length;
  }
  return { color: BLOCK_COLORS[colorIdx], colorIdx };
}

export const CustomCodeVisualizer: React.FC<CustomCodeVisualizerProps> = ({
  code,
  blockData,
  currentBlock,
  onPrevBlock,
  onNextBlock,
  totalBlocks,
  language,
}) => {
  const [lines, setLines] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedLines, setHighlightedLines] = useState<string[]>([]);

  // Threshold for a 'long' line (in characters)
  const LONG_LINE_THRESHOLD = 80;

  useEffect(() => {
    setLines(code.split("\n"));
    setLoading(true);
    shiki
      .codeToHtml(code, { lang: language, theme: "github-dark" })
      .then((html) => {
        // Extract lines from the generated HTML
        const matches = html.match(/<span class="line">([\s\S]*?)<\/span>/g);
        if (matches) {
          setHighlightedLines(matches.map((line) => line.replace(/<span class="line">|<\/span>/g, "")));
        } else {
          setHighlightedLines(lines);
        }
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, language]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-lg animate-pulse text-blue-500">Loading code visualization...</div>
    );
  }
  // Get block range
  const block = blockData[currentBlock];
  const start = block?.start ?? 0;
  const end = block?.end ?? 0;

  // Helper: is this block a long line?
  const isLongBlock = () => {
    for (let i = start; i <= end; ++i) {
      if ((lines[i] || "").length > LONG_LINE_THRESHOLD) return true;
    }
    return false;
  };
  // If any line in the block is too long, treat it as a single block
  let adjustedStart = start;
  let adjustedEnd = end;
  for (let i = start; i <= end; ++i) {
    if ((lines[i] || "").length > LONG_LINE_THRESHOLD) {
      adjustedStart = i;
      adjustedEnd = i;
      break;
    }
  }
  const longBlock = adjustedStart === adjustedEnd && (lines[adjustedStart] || "").length > LONG_LINE_THRESHOLD;

  // Assign a color per block index (deterministic, not random)
  const colorIdx = currentBlock % BLOCK_COLORS.length;
  const blockColor = BLOCK_COLORS[colorIdx];

  return (
    <div className="relative h-full w-full flex flex-col p-0 m-0">
      <div className="flex-1 overflow-auto bg-gradient-to-br from-blue-50/80 to-purple-100/80 dark:from-gray-900 dark:to-gray-950 w-full h-full flex flex-col justify-stretch p-6 md:p-10 border-0 shadow-none rounded-none">
        <pre className="relative font-mono text-base leading-relaxed select-none w-full h-full min-h-0 flex-1 px-0 py-0 m-0 border-0 transition-all duration-500">
          {/* Static, faded lines before the block */}
          {highlightedLines.slice(0, adjustedStart).map((line, idx) => (
            <div
              key={`static-before-${idx}`}
              className="opacity-70 text-gray-500 transition-all duration-300 px-2 py-0.5"
              style={{ fontWeight: 400, fontSize: "1em", marginBottom: "2px" }}
            >
              <span dangerouslySetInnerHTML={{ __html: line }} />
            </div>
          ))}
          {/* Animated current block as a group */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`block-${adjustedStart}-${adjustedEnd}`}
              layout
              initial={{ opacity: 0, scale: 0.96, y: 40, boxShadow: '0 0 0px 0px rgba(0,0,0,0)' }}
              animate={{
                opacity: 1,
                scale: 1.04,
                y: 0,
                background: blockColor,
                boxShadow: '0 0 32px 8px rgba(0,0,0,0.10)',
              }}
              exit={{ opacity: 0, scale: 0.96, y: -40, boxShadow: '0 0 0px 0px rgba(0,0,0,0)' }}
              transition={{ duration: 0.55, type: "spring", bounce: 0.18 }}
              className="transition-all duration-500 ease-in-out px-4 py-2 rounded-2xl border-0 shadow-2xl relative z-10"
              style={{ marginBottom: "2px", fontWeight: 700, fontSize: "1.13em", background: blockColor, border: 'none' }}
            >
              {highlightedLines.slice(adjustedStart, adjustedEnd + 1).map((line, idx) => (
                <div key={`block-line-${adjustedStart + idx}`}>
                  <span dangerouslySetInnerHTML={{ __html: line }} />
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
          {/* Static, faded lines after the block */}
          {highlightedLines.slice(adjustedEnd + 1).map((line, idx) => (
            <div
              key={`static-after-${adjustedEnd + 1 + idx}`}
              className="opacity-70 text-gray-500 transition-all duration-300 px-2 py-0.5"
              style={{ fontWeight: 400, fontSize: "1em", marginBottom: "2px" }}
            >
              <span dangerouslySetInnerHTML={{ __html: line }} />
            </div>
          ))}
        </pre>
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        <button
          className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50 font-bold shadow"
          onClick={onPrevBlock}
          disabled={currentBlock === 0}
        >
          Prev
        </button>
        <button
          className="px-3 py-1 rounded bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-bold shadow-lg border-2 border-yellow-400 dark:border-blue-400 hover:scale-105 transition-transform"
          onClick={onNextBlock}
          disabled={currentBlock === totalBlocks - 1}
        >
          Next
        </button>
      </div>
      <div className="flex justify-center mt-2 text-gray-400 text-xs select-none">
        Block {currentBlock + 1} / {totalBlocks}
      </div>
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
    extensions.push(getHighlightDecorations(code, highlightRange));
  }

  // Handler for cursor activity
  const handleUpdate = React.useCallback((vu: any) => {
    if (vu.selectionSet && setCurrentBlockForLine) {
      const line = vu.state.doc.lineAt(vu.state.selection.main.head).number - 1;
      setCurrentBlockForLine(line);
    }
  }, [setCurrentBlockForLine]);

  return (
    <div className="h-full w-full p-4 bg-gray-900 text-white rounded-lg shadow-xl flex flex-col border border-gray-800/60">
      <div className="flex-1 overflow-auto transition-opacity duration-200">
        <CodeMirror
          value={code}
          height="100%"
          theme={oneDark}
          extensions={extensions}
          onChange={setCode}
          onUpdate={setCurrentBlockForLine ? handleUpdate : undefined}
          className="rounded-lg font-mono text-base min-h-[180px] border border-gray-800 h-full"
          basicSetup={{ lineNumbers: true, highlightActiveLine: true }}
          readOnly={readOnly ?? false}
        />
      </div>
      <div className="mt-4 flex items-center justify-center gap-4">
        {hasBlocks && onPrevBlock && (
          <button
            className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50"
            onClick={onPrevBlock}
            disabled={currentBlock === 0 || aiLoading}
          >
            Prev
          </button>
        )}
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 transition disabled:opacity-50"
          onClick={onAIExplain}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <span className="flex items-center gap-2"><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Loading...</span>
          ) : (
            "Generate Explanation"
          )}
        </button>
        {hasBlocks && onNextBlock && (
          <button
            className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-400 dark:border-gray-600 hover:bg-blue-100 dark:hover:bg-blue-900 disabled:opacity-50"
            onClick={onNextBlock}
            disabled={currentBlock === ((totalBlocks ?? 1) - 1) || aiLoading}
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