import React from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/atom-one-dark.css"; // Higher-contrast theme for better readability

const AISkeleton = () => (
  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/40 rounded text-blue-900 dark:text-blue-100 text-sm border border-blue-200 dark:border-blue-700 animate-pulse">
    <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-3/4 mb-2" />
    <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-1/2 mb-2" />
    <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-2/3" />
  </div>
);

interface ExplanationPanelProps {
  aiExplanation: string;
  aiLoading: boolean;
}

const ExplanationPanel: React.FC<ExplanationPanelProps> = ({ aiExplanation, aiLoading }) => {
  return (
    <div className="h-full w-full p-4 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-xl flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Explanation</div>
      {aiLoading && <AISkeleton />}
      {aiExplanation && !aiLoading && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/40 rounded text-blue-900 dark:text-blue-100 text-base border border-blue-200 dark:border-blue-700 transition-opacity duration-200 animate-fade-in overflow-auto max-h-full min-h-[120px] markdown-explanation-panel"
          style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
          <ReactMarkdown
            rehypePlugins={[rehypeHighlight]}
            components={{
              code({children, className, ...props}: any) {
                const isInline = !(className && className.startsWith('language-'));
                return !isInline ? (
                  <pre className={"rounded-lg p-3 bg-gray-900 text-white text-sm my-2 " + (className || "") }
                    style={{
                      overflowX: 'auto',
                      wordBreak: 'break-word',
                      whiteSpace: 'pre-wrap',
                      maxWidth: '100%',
                    }}
                  >
                    <code {...props} style={{wordBreak: 'break-word', whiteSpace: 'pre-wrap'}}>{children}</code>
                  </pre>
                ) : (
                  <code className="bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5 text-sm" style={{wordBreak: 'break-word', whiteSpace: 'pre-wrap'}} {...props}>{children}</code>
                );
              },
              h1: ({children}) => <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>,
              h2: ({children}) => <h2 className="text-xl font-semibold mt-3 mb-2">{children}</h2>,
              h3: ({children}) => <h3 className="text-lg font-semibold mt-2 mb-1">{children}</h3>,
              ul: ({children}) => <ul className="list-disc ml-6 my-2">{children}</ul>,
              ol: ({children}) => <ol className="list-decimal ml-6 my-2">{children}</ol>,
              li: ({children}) => <li className="mb-1">{children}</li>,
              p: ({children}) => <p className="mb-2 leading-relaxed">{children}</p>,
            }}
          >
            {aiExplanation}
          </ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default ExplanationPanel; 