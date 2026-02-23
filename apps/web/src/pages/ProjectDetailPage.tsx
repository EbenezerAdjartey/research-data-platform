import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projects, datasets, analysis } from '@rdp/api-client';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import type { AnalysisType } from '@rdp/shared-types';
import { ANALYSIS_CATEGORIES } from '@rdp/shared-types';
import { Upload, FileSpreadsheet, Play, ChevronDown, Table, Trash2, FileText, Search } from 'lucide-react';
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
          {/* Upload */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">
              {uploadMutation.isPending
                ? 'Uploading...'
                : 'Drop files here or click to upload'}
            </p>
            <p className="text-xs text-gray-400 mt-1">CSV, Excel, SPSS, SAS, Stata</p>
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
