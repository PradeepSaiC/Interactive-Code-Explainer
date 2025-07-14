import React from "react";
import ReactMarkdown from "react-markdown";

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
    <div className="h-full w-full p-4 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-xl flex flex-col border border-gray-200 dark:border-gray-700">
      <div className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">Explanation</div>
      {aiLoading && <AISkeleton />}
      {aiExplanation && !aiLoading && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/40 rounded text-blue-900 dark:text-blue-100 text-sm whitespace-pre-line border border-blue-200 dark:border-blue-700 transition-opacity duration-200 animate-fade-in">
          <ReactMarkdown>{aiExplanation}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

export default ExplanationPanel; 