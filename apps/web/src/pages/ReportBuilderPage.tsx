import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { reports, analysis, projects } from '@rdp/api-client';
import toast from 'react-hot-toast';
import type { AnalysisResult } from '@rdp/shared-types';
import {
  FileText, Plus, Trash2, ChevronUp, ChevronDown, Download,
  GripVertical, Type, BarChart3, FileDown,
} from 'lucide-react';

interface ReportSection {
  id: string;
  type: 'text' | 'analysis' | 'heading';
  title: string;
  content: string;
  analysisId?: number;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const formatLabel = (type: string) =>
  type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function AnalysisSummary({ result }: { result: AnalysisResult }) {
  if (!result.results) return <p className="text-sm text-gray-400">No results available.</p>;

  const entries = Object.entries(result.results);
  const tableEntries = entries.filter(
    ([, v]) => typeof v === 'object' && v !== null && !Array.isArray(v),
  );
  const scalarEntries = entries.filter(
    ([, v]) => typeof v !== 'object' || v === null,
  );

  return (
    <div className="space-y-3">
      {scalarEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {scalarEntries.map(([key, val]) => (
            <div key={key} className="bg-gray-50 rounded p-2">
              <p className="text-xs text-gray-500">{formatLabel(key)}</p>
              <p className="text-sm font-medium">
                {typeof val === 'number' ? val.toFixed(4) : String(val ?? 'N/A')}
              </p>
            </div>
          ))}
        </div>
      )}
      {tableEntries.map(([key, val]) => {
        const obj = val as Record<string, unknown>;
        const subKeys = Object.keys(obj);
        if (subKeys.length === 0) return null;
        const firstVal = obj[subKeys[0]];
        if (typeof firstVal === 'object' && firstVal !== null) {
          // nested table like coefficients
          const innerObj = firstVal as Record<string, unknown>;
          const cols = Object.keys(innerObj);
          return (
            <div key={key}>
              <p className="text-xs font-semibold text-gray-600 mb-1">{formatLabel(key)}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border px-2 py-1 text-left">Variable</th>
                      {cols.map((c) => (
                        <th key={c} className="border px-2 py-1 text-left">{formatLabel(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subKeys.map((sk) => {
                      const row = obj[sk] as Record<string, unknown>;
                      return (
                        <tr key={sk}>
                          <td className="border px-2 py-1 font-medium">{sk}</td>
                          {cols.map((c) => (
                            <td key={c} className="border px-2 py-1">
                              {typeof row[c] === 'number' ? (row[c] as number).toFixed(4) : String(row[c] ?? '')}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        }
        // simple key-value object
        return (
          <div key={key}>
            <p className="text-xs font-semibold text-gray-600 mb-1">{formatLabel(key)}</p>
            <div className="grid grid-cols-2 gap-1">
              {subKeys.map((sk) => (
                <div key={sk} className="flex justify-between bg-gray-50 rounded px-2 py-1 text-xs">
                  <span className="text-gray-500">{formatLabel(sk)}</span>
                  <span className="font-medium">
                    {typeof obj[sk] === 'number' ? (obj[sk] as number).toFixed(4) : String(obj[sk] ?? '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function ReportBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);

  const [title, setTitle] = useState('Untitled Report');
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [exporting, setExporting] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projects.get(projectId),
  });

  const { data: analysisList } = useQuery({
    queryKey: ['analyses', projectId],
    queryFn: () => analysis.listByProject(projectId),
  });

  const { data: reportList, refetch: refetchReports } = useQuery({
    queryKey: ['reports', projectId],
    queryFn: () => reports.listByProject(projectId),
  });

  const completedAnalyses = analysisList?.filter((a) => a.status === 'completed') ?? [];

  const addSection = (type: ReportSection['type']) => {
    const newSection: ReportSection = {
      id: generateId(),
      type,
      title: type === 'heading' ? 'Section Title' : type === 'analysis' ? 'Analysis Results' : 'Text Section',
      content: '',
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (id: string, updates: Partial<ReportSection>) => {
    setSections(sections.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const removeSection = (id: string) => {
    setSections(sections.filter((s) => s.id !== id));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const copy = [...sections];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    setSections(copy);
  };

  const buildSectionsPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    sections.forEach((s, i) => {
      const key = `${String(i + 1).padStart(2, '0')}_${s.title.replace(/\s+/g, '_').slice(0, 40)}`;
      if (s.type === 'heading') {
        payload[key] = { type: 'heading', text: s.title };
      } else if (s.type === 'text') {
        payload[key] = s.content;
      } else if (s.type === 'analysis' && s.analysisId) {
        const result = completedAnalyses.find((a) => a.id === s.analysisId);
        payload[key] = {
          type: 'analysis',
          analysis_type: result?.analysis_type,
          parameters: result?.parameters,
          results: result?.results,
        };
      }
    });
    return payload;
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    if (sections.length === 0) {
      toast.error('Add at least one section before exporting.');
      return;
    }
    setExporting(true);
    try {
      const report = await reports.create({
        project_id: projectId,
        title,
        sections: buildSectionsPayload(),
        export_format: format,
      });
      refetchReports();
      // Trigger authenticated download (window.open won't send auth header)
      await reports.download(report.id, report.title, format);
      toast.success(`Report exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleSave = async () => {
    if (sections.length === 0) {
      toast.error('Add at least one section before saving.');
      return;
    }
    try {
      await reports.create({
        project_id: projectId,
        title,
        sections: buildSectionsPayload(),
      });
      refetchReports();
      toast.success('Report saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link to={`/projects/${projectId}`} className="text-primary-600 hover:text-primary-800 text-sm">
          &larr; Back to Project
        </Link>
        <h1 className="text-2xl font-bold mt-2">Report Builder</h1>
        <p className="text-gray-500 text-sm">{project?.name}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left sidebar - controls */}
        <div className="space-y-4">
          {/* Report title */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border rounded-md px-3 py-2 text-sm"
            />
          </div>

          {/* Add sections */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold text-sm mb-3">Add Section</h3>
            <div className="space-y-2">
              <button
                onClick={() => addSection('heading')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
              >
                <Type className="w-4 h-4" /> Heading
              </button>
              <button
                onClick={() => addSection('text')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
              >
                <FileText className="w-4 h-4" /> Text Block
              </button>
              <button
                onClick={() => addSection('analysis')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-gray-50"
              >
                <BarChart3 className="w-4 h-4" /> Analysis Result
              </button>
            </div>
          </div>

          {/* Export */}
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <h3 className="font-semibold text-sm mb-3">Export</h3>
            <div className="space-y-2">
              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <FileDown className="w-4 h-4" /> Save Draft
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export PDF
              </button>
              <button
                onClick={() => handleExport('docx')}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Download className="w-4 h-4" /> Export DOCX
              </button>
            </div>
          </div>

          {/* Previous reports */}
          {reportList && reportList.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <h3 className="font-semibold text-sm mb-3">Saved Reports</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {reportList.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm border rounded p-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{r.title}</p>
                      <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
                    </div>
                    {r.file_path && (
                      <button
                        onClick={() => reports.download(r.id, r.title, r.export_format ?? 'pdf').catch(() => toast.error('Download failed'))}
                        className="text-primary-600 hover:text-primary-800"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main content - section editor */}
        <div className="md:col-span-2">
          {sections.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600 mb-2">No sections yet</h3>
              <p className="text-sm text-gray-400 mb-4">
                Add headings, text blocks, and analysis results to build your report.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => addSection('heading')}
                  className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
                >
                  + Heading
                </button>
                <button
                  onClick={() => addSection('text')}
                  className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
                >
                  + Text
                </button>
                <button
                  onClick={() => addSection('analysis')}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
                >
                  + Analysis
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {sections.map((section, idx) => (
                <div key={section.id} className="bg-white rounded-lg shadow-sm border">
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
                    <GripVertical className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium uppercase text-gray-500">
                      {section.type}
                    </span>
                    <div className="flex-1" />
                    <button
                      onClick={() => moveSection(idx, -1)}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveSection(idx, 1)}
                      disabled={idx === sections.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeSection(section.id)}
                      className="p-1 text-gray-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Section body */}
                  <div className="p-4">
                    {section.type === 'heading' && (
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(section.id, { title: e.target.value })}
                        className="w-full text-xl font-bold border-b border-transparent focus:border-primary-400 outline-none pb-1"
                        placeholder="Section heading..."
                      />
                    )}

                    {section.type === 'text' && (
                      <div>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateSection(section.id, { title: e.target.value })}
                          className="w-full text-sm font-medium text-gray-600 mb-2 border-b border-transparent focus:border-gray-300 outline-none"
                          placeholder="Section label..."
                        />
                        <textarea
                          value={section.content}
                          onChange={(e) => updateSection(section.id, { content: e.target.value })}
                          className="w-full border rounded-md px-3 py-2 text-sm min-h-[120px] resize-y"
                          placeholder="Write your text here... Supports plain text for report content, methodology descriptions, interpretations, etc."
                        />
                      </div>
                    )}

                    {section.type === 'analysis' && (
                      <div>
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateSection(section.id, { title: e.target.value })}
                          className="w-full text-sm font-medium text-gray-600 mb-2 border-b border-transparent focus:border-gray-300 outline-none"
                          placeholder="Section label..."
                        />
                        <select
                          value={section.analysisId ?? ''}
                          onChange={(e) =>
                            updateSection(section.id, {
                              analysisId: e.target.value ? Number(e.target.value) : undefined,
                            })
                          }
                          className="w-full border rounded-md px-3 py-2 text-sm mb-3"
                        >
                          <option value="">-- Select an analysis result --</option>
                          {completedAnalyses.map((a) => (
                            <option key={a.id} value={a.id}>
                              {formatLabel(a.analysis_type)} - {new Date(a.created_at).toLocaleString()}
                            </option>
                          ))}
                        </select>
                        {section.analysisId && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            {(() => {
                              const result = completedAnalyses.find((a) => a.id === section.analysisId);
                              if (!result) return <p className="text-sm text-gray-400">Analysis not found.</p>;
                              return (
                                <div>
                                  <div className="flex items-center gap-2 mb-3">
                                    <BarChart3 className="w-4 h-4 text-primary-600" />
                                    <span className="text-sm font-semibold">{formatLabel(result.analysis_type)}</span>
                                    <span className="text-xs text-gray-400">
                                      ({new Date(result.created_at).toLocaleString()})
                                    </span>
                                  </div>
                                  <AnalysisSummary result={result} />
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add more */}
              <div className="flex gap-2 justify-center py-4">
                <button
                  onClick={() => addSection('heading')}
                  className="px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50"
                >
                  <Plus className="w-3 h-3 inline mr-1" /> Heading
                </button>
                <button
                  onClick={() => addSection('text')}
                  className="px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50"
                >
                  <Plus className="w-3 h-3 inline mr-1" /> Text
                </button>
                <button
                  onClick={() => addSection('analysis')}
                  className="px-3 py-1.5 text-xs border rounded-md hover:bg-gray-50"
                >
                  <Plus className="w-3 h-3 inline mr-1" /> Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
