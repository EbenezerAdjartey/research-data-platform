import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projects, datasets, analysis } from '@rdp/api-client';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import type { AnalysisType } from '@rdp/shared-types';
import { ANALYSIS_CATEGORIES } from '@rdp/shared-types';
import { Upload, FileSpreadsheet, Play, ChevronDown, Table, Trash2, FileText, Search, Globe, Database, Tag, Link2 } from 'lucide-react';
import DataPreviewModal from '@/components/DataPreviewModal';
import AnalysisConfigPanel from '@/components/AnalysisConfigPanel';
import { useProjectWebSocket } from '@/hooks/useProjectWebSocket';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = Number(id);
  const queryClient = useQueryClient();
  const location = useLocation();
  const [previewDatasetId, setPreviewDatasetId] = useState<number | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisType | null>(null);
  const [selectedDatasetId, setSelectedDatasetId] = useState<number | null>(
    (location.state as { selectDatasetId?: number } | null)?.selectDatasetId ?? null,
  );
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  // Open data sources state
  const [importTab, setImportTab] = useState<'upload' | 'url' | 'samples'>('upload');
  const [urlInput, setUrlInput] = useState('');

  // WebSocket for real-time analysis updates
  useProjectWebSocket(projectId);

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projects.get(projectId),
  });

  const { data: datasetList } = useQuery({
    queryKey: ['datasets', projectId],
    queryFn: () => datasets.list(projectId),
  });

  const { data: analysisList } = useQuery({
    queryKey: ['analyses', projectId],
    queryFn: () => analysis.listByProject(projectId),
  });

  // Auto-select first dataset when list loads (only if nothing pre-selected)
  useEffect(() => {
    if (datasetList?.length && selectedDatasetId === null) {
      setSelectedDatasetId(datasetList[0].id);
    }
  }, [datasetList]); // eslint-disable-line react-hooks/exhaustive-deps

  const uploadMutation = useMutation({
    mutationFn: (file: File) => datasets.upload(projectId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', projectId] });
      toast.success('File uploaded successfully');
    },
    onError: () => toast.error('Upload failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (datasetId: number) => datasets.delete(projectId, datasetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['datasets', projectId] });
      toast.success('Dataset deleted');
    },
  });

  const { data: sampleList } = useQuery({
    queryKey: ['dataset-samples'],
    queryFn: () => datasets.listSamples(),
    enabled: importTab === 'samples',
  });

  const importSampleMutation = useMutation({
    mutationFn: (sampleId: string) => datasets.importSample(projectId, sampleId),
    onSuccess: (ds) => {
      queryClient.invalidateQueries({ queryKey: ['datasets', projectId] });
      toast.success(`"${ds.filename}" imported`);
    },
    onError: () => toast.error('Failed to import sample'),
  });

  const importUrlMutation = useMutation({
    mutationFn: (url: string) => datasets.importFromUrl(projectId, url),
    onSuccess: (ds) => {
      queryClient.invalidateQueries({ queryKey: ['datasets', projectId] });
      setUrlInput('');
      toast.success(`"${ds.filename}" imported`);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Failed to import from URL';
      toast.error(msg);
    },
  });

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files.forEach((f) => uploadMutation.mutate(f)),
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/x-spss-sav': ['.sav'],
      'application/x-sas': ['.sas7bdat'],
      'application/x-stata-dta': ['.dta'],
    },
  });

  const formatLabel = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      <div className="mb-6">
        <Link to="/projects" className="text-primary-600 hover:text-primary-800 text-sm">&larr; Back to Projects</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">{project?.name}</h1>
            {project?.description && <p className="text-gray-600 mt-1">{project.description}</p>}
          </div>
          <div className="flex gap-2">
            <Link
              to={`/projects/${projectId}/reports`}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700"
            >
              <FileText className="w-4 h-4" /> Report Builder
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Datasets + Upload */}
        <div className="lg:col-span-1 space-y-6">
          {/* Data Import Panel */}
          <div className="bg-white rounded-lg shadow-sm border">
            {/* Tabs */}
            <div className="flex border-b">
              {([
                { key: 'upload', label: 'Upload', Icon: Upload },
                { key: 'url', label: 'From URL', Icon: Link2 },
                { key: 'samples', label: 'Open Data', Icon: Globe },
              ] as const).map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setImportTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                    importTab === key
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>

            {/* Upload tab */}
            {importTab === 'upload' && (
              <div
                {...getRootProps()}
                className={`p-5 text-center cursor-pointer transition-colors ${
                  isDragActive ? 'bg-primary-50' : 'hover:bg-gray-50'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="w-7 h-7 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">
                  {uploadMutation.isPending ? 'Uploading…' : 'Drop files or click to upload'}
                </p>
                <p className="text-xs text-gray-400 mt-1">CSV, Excel, SPSS, SAS, Stata</p>
              </div>
            )}

            {/* From URL tab */}
            {importTab === 'url' && (
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  Import data directly from a public CSV or JSON URL.
                </p>
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/data.csv"
                  className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  onClick={() => urlInput.trim() && importUrlMutation.mutate(urlInput.trim())}
                  disabled={!urlInput.trim() || importUrlMutation.isPending}
                  className="w-full py-2 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {importUrlMutation.isPending ? 'Importing…' : 'Import'}
                </button>
              </div>
            )}

            {/* Open Data / Samples tab */}
            {importTab === 'samples' && (
              <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
                {!sampleList ? (
                  <p className="text-xs text-gray-400 text-center py-4">Loading…</p>
                ) : (
                  sampleList.map((s) => (
                    <div key={s.id} className="border rounded-lg p-3 hover:border-primary-300 hover:bg-primary-50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <Database className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                            <p className="text-sm font-medium truncate">{s.name}</p>
                          </div>
                          <p className="text-xs text-gray-500 leading-snug mb-1.5">{s.description}</p>
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-gray-400">{s.rows} rows &middot; {s.cols} cols</span>
                            {s.tags.map((t) => (
                              <span key={t} className="inline-flex items-center gap-0.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                                <Tag className="w-2.5 h-2.5" />{t}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={() => importSampleMutation.mutate(s.id)}
                          disabled={importSampleMutation.isPending}
                          className="shrink-0 px-2.5 py-1 text-xs bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                        >
                          Import
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Dataset list */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Datasets</h3>
            </div>
            {!datasetList?.length ? (
              <p className="p-4 text-sm text-gray-500">No datasets uploaded yet.</p>
            ) : (
              <div className="divide-y">
                {datasetList.map((ds) => (
                  <div
                    key={ds.id}
                    className={`p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer ${
                      selectedDatasetId === ds.id ? 'bg-primary-50' : ''
                    }`}
                    onClick={() => setSelectedDatasetId(ds.id)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{ds.filename}</p>
                        <p className="text-xs text-gray-400">{ds.row_count} rows &middot; {ds.col_count} cols</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Link
                        to={`/projects/${projectId}/explore/${ds.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Explore Data"
                      >
                        <Search className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewDatasetId(ds.id); }}
                        className="p-1 text-gray-400 hover:text-primary-600"
                        title="Preview"
                      >
                        <Table className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(ds.id); }}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Analysis categories */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Analysis Methods</h3>
            </div>
            <div className="divide-y">
              {Object.entries(ANALYSIS_CATEGORIES).map(([key, cat]) => (
                <div key={key}>
                  <button
                    className="w-full p-3 flex items-center justify-between text-sm hover:bg-gray-50"
                    onClick={() => setExpandedCategory(expandedCategory === key ? null : key)}
                  >
                    <span className="font-medium">{cat.label}</span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform ${expandedCategory === key ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {expandedCategory === key && (
                    <div className="px-3 pb-3 space-y-1">
                      {cat.methods.map((method) => (
                        <button
                          key={method}
                          onClick={() => setSelectedAnalysis(method as AnalysisType)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                            selectedAnalysis === method
                              ? 'bg-primary-100 text-primary-700'
                              : 'hover:bg-gray-100 text-gray-600'
                          }`}
                        >
                          <Play className="w-3 h-3 inline mr-2" />
                          {formatLabel(method)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Analysis Config + Results */}
        <div className="lg:col-span-2 space-y-6">
          {selectedAnalysis && selectedDatasetId ? (
            <AnalysisConfigPanel
              analysisType={selectedAnalysis}
              datasetId={selectedDatasetId}
              projectId={projectId}
              columns={
                datasetList?.find((d) => d.id === selectedDatasetId)?.column_metadata
                  ? Object.keys(datasetList.find((d) => d.id === selectedDatasetId)!.column_metadata)
                  : []
              }
            />
          ) : (
            <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
              <p className="text-gray-500">
                {!selectedDatasetId
                  ? 'Select a dataset first, then choose an analysis method.'
                  : 'Choose an analysis method from the left panel.'}
              </p>
            </div>
          )}

          {/* Analysis history */}
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Analysis History</h3>
            </div>
            {!analysisList?.length ? (
              <p className="p-4 text-sm text-gray-500">No analyses run yet.</p>
            ) : (
              <div className="divide-y">
                {analysisList.map((a) => {
                  const ds = datasetList?.find((d) => d.id === a.dataset_id);
                  return (
                    <Link
                      key={a.id}
                      to={`/projects/${projectId}/analysis/${a.id}`}
                      className="p-4 flex items-center justify-between hover:bg-gray-50 block"
                    >
                      <div>
                        <p className="text-sm font-medium">{formatLabel(a.analysis_type)}</p>
                        <p className="text-xs text-gray-400">
                          {ds && <span className="text-gray-500">{ds.filename} &middot; </span>}
                          {new Date(a.created_at).toLocaleString()}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          a.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : a.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {a.status}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewDatasetId && (
        <DataPreviewModal
          projectId={projectId}
          datasetId={previewDatasetId}
          onClose={() => setPreviewDatasetId(null)}
        />
      )}
    </div>
  );
}
