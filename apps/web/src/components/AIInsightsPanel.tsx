import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { ai } from '@rdp/api-client';
import type { AIAskResponse } from '@rdp/shared-types';
import { Sparkles, ArrowRight, Loader2, AlertCircle, RotateCcw, KeyRound, Clock } from 'lucide-react';

interface Props {
  projectId: number;
  datasetId: number | null;
  datasetName?: string;
}

interface ParsedError {
  status: number;
  detail: string;
}

function parseError(error: unknown): ParsedError {
  const apiErr = error as { status?: number; body?: string } | null;
  const status = apiErr?.status ?? 0;
  const raw = apiErr?.body ?? (error as Error)?.message ?? '';
  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.detail) detail = String(parsed.detail);
  } catch {
    // not JSON
  }
  return { status, detail: detail || 'Something went wrong. Please try again.' };
}

const EXAMPLE_QUESTIONS = [
  'What are the summary statistics for all numeric columns?',
  'Is there a correlation between the two main variables?',
  'Are there significant differences between groups?',
];

export default function AIInsightsPanel({ projectId, datasetId, datasetName }: Props) {
  const [question, setQuestion] = useState('');
  const [response, setResponse] = useState<AIAskResponse | null>(null);

  const { data: statusData, isLoading: statusLoading } = useQuery({
    queryKey: ['ai-status'],
    queryFn: ai.status,
    retry: false,
    staleTime: 60_000,
  });

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

  const err = askMutation.isError ? parseError(askMutation.error) : null;
  const aiConfigured = statusData?.configured ?? true; // assume configured until proven otherwise

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-purple-600" />
        <h3 className="font-semibold text-sm">Ask AI</h3>
        {!statusLoading && (
          <span className={`text-xs ml-auto px-2 py-0.5 rounded-full ${
            aiConfigured
              ? 'text-green-700 bg-green-50'
              : 'text-amber-700 bg-amber-50'
          }`}>
            {aiConfigured ? 'Claude ready' : 'Not configured'}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Not configured banner — shown upfront, no click required */}
        {!statusLoading && !aiConfigured && (
          <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
            <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">API key required</p>
              <p className="text-xs mt-0.5">
                Add <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> to{' '}
                <code className="bg-amber-100 px-1 rounded">apps/api/.env</code>, then restart the server.
              </p>
            </div>
          </div>
        )}

        {!datasetId ? (
          <p className="text-sm text-gray-400 text-center py-3">
            Select a dataset to ask AI questions about it.
          </p>
        ) : aiConfigured ? (
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
            {!response && !askMutation.isPending && !err && (
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
        ) : null}

        {/* Response */}
        {response && (
          <div className="space-y-3 pt-1 border-t">
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3 space-y-2">
              <p className="text-xs text-gray-500 font-medium truncate">
                Q: {response.question}
              </p>

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

              {response.reasoning && (
                <p className="text-xs text-gray-500 italic leading-relaxed">
                  {response.reasoning}
                </p>
              )}

              <p className="text-sm text-gray-800 leading-relaxed">
                {response.interpretation}
              </p>

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

        {/* Error — status-aware */}
        {err && (
          err.status === 503 ? (
            <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
              <KeyRound className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">API key required</p>
                <p className="text-xs mt-0.5">
                  Add <code className="bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> to{' '}
                  <code className="bg-amber-100 px-1 rounded">apps/api/.env</code> and restart the server.
                </p>
              </div>
            </div>
          ) : err.status === 429 ? (
            <div className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-md p-3">
              <Clock className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Rate limit reached</p>
                <p className="text-xs mt-0.5">{err.detail}</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-md p-3">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{err.detail}</span>
            </div>
          )
        )}
      </div>
    </div>
  );
}
