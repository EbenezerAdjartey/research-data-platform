import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ai } from '@rdp/api-client';
import type { AIAskResponse } from '@rdp/shared-types';
import { Sparkles, ArrowRight, Loader2, AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  projectId: number;
  datasetId: number | null;
  datasetName?: string;
}

const EXAMPLE_QUESTIONS = [
  'What are the summary statistics for all numeric columns?',
  'Is there a correlation between the two main variables?',
  'Are there significant differences between groups?',
];

export default function AIInsightsPanel({ projectId, datasetId, datasetName }: Props) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AIAskResponse | null>(null);

  const askMutation = useMutation({
    mutationFn: (q: string) =>
      ai.ask({ question: q, dataset_id: datasetId!, project_id: projectId }),
    onSuccess: (data) => {
      setResponse(data);
      setQuestion('');
    },
  });

  const submit = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || !datasetId || askMutation.isPending) return;
    setResponse(null);
    askMutation.mutate(trimmed);
  };

  const statusColors: Record<string, string> = {
    answered: 'bg-green-100 text-green-700',
    cannot_answer: 'bg-yellow-100 text-yellow-700',
    failed: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <h3 className="font-semibold text-sm">Ask AI</h3>
        <span className="text-xs text-gray-400 ml-auto">Powered by Claude</span>
      </div>

      <div className="p-4 space-y-3">
        {!datasetId ? (
          <p className="text-sm text-gray-400 text-center py-3">
            Select a dataset to ask AI questions about it.
          </p>
        ) : (
          <>
            <p className="text-xs text-gray-500">
              Asking about:{' '}
              <span className="font-medium text-gray-700">
                {datasetName ?? `Dataset #${datasetId}`}
              </span>
            </p>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(question);
              }}
              placeholder="e.g. What is the average sepal length by species?"
              className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              rows={3}
              disabled={askMutation.isPending}
            />

            <button
              onClick={() => submit(question)}
              disabled={!question.trim() || askMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {askMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Analyzing…
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Ask AI
                </>
              )}
            </button>

            {/* Example questions */}
            {!response && !askMutation.isPending && (
              <div className="space-y-1">
                <p className="text-xs text-gray-400">Try asking:</p>
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => submit(q)}
                    className="block w-full text-left text-xs text-purple-600 hover:text-purple-800 hover:underline truncate"
                  >
                    → {q}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {/* Response */}
        {response && (
          <div className="space-y-3 pt-1 border-t">
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 space-y-2">
              {/* Question echoed */}
              <p className="text-xs text-gray-500 font-medium truncate">
                Q: {response.question}
              </p>

              {/* Status badge + analysis type */}
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    statusColors[response.status] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {response.status === 'answered'
                    ? response.analysis_type?.replace(/_/g, ' ') ?? 'Answered'
                    : response.status.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Reasoning */}
              {response.reasoning && (
                <p className="text-xs text-gray-500 italic leading-relaxed">
                  {response.reasoning}
                </p>
              )}

              {/* Interpretation */}
              <p className="text-sm text-gray-800 leading-relaxed">
                {response.interpretation}
              </p>

              {/* Link to full analysis */}
              <div className="flex items-center justify-between pt-1">
                {response.analysis_id ? (
                  <Link
                    to={`/projects/${projectId}/analysis/${response.analysis_id}`}
                    className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-medium"
                  >
                    View full analysis <ArrowRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => setResponse(null)}
                  className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  <RotateCcw className="w-3 h-3" /> Ask again
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {askMutation.isError && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-md p-3">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Failed to get AI response. Please try again.</span>
          </div>
        )}
      </div>
    </div>
  );
}
