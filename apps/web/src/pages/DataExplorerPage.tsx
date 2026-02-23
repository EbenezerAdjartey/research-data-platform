import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { projects, datasets } from '@rdp/api-client';
import {
  ArrowUpDown, ArrowUp, ArrowDown, Search, Filter, Table,
  ChevronLeft, ChevronRight, Database, Columns, Play,
} from 'lucide-react';

type SortDir = 'asc' | 'desc' | null;

export default function DataExplorerPage() {
  const { id, datasetId } = useParams<{ id: string; datasetId: string }>();
  const projectId = Number(id);
  const dsId = Number(datasetId);

  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCol, setFilterCol] = useState<string>('');
  const [filterValue, setFilterValue] = useState('');
  const [page, setPage] = useState(0);
  const [colInfoOpen, setColInfoOpen] = useState(false);
  const pageSize = 50;

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projects.get(projectId),
  });

  const { data: datasetInfo } = useQuery({
    queryKey: ['datasets', projectId],
    queryFn: () => datasets.list(projectId),
    select: (list) => list.find((d) => d.id === dsId),
  });

  const { data: preview, isLoading } = useQuery({
    queryKey: ['preview', projectId, dsId],
    queryFn: () => datasets.preview(projectId, dsId, 500),
  });

  const columns = preview?.columns ?? [];
  const dtypes = preview?.dtypes ?? {};

  // Filter rows
  const filteredRows = useMemo(() => {
    if (!preview?.rows) return [];
    let rows = [...preview.rows];

    // Global search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? '').toLowerCase().includes(term),
        ),
      );
    }

    // Column filter
    if (filterCol && filterValue) {
      const fv = filterValue.toLowerCase();
      rows = rows.filter((row) =>
        String(row[filterCol] ?? '').toLowerCase().includes(fv),
      );
    }

    // Sort
    if (sortCol && sortDir) {
      rows.sort((a, b) => {
        const va = a[sortCol] ?? '';
        const vb = b[sortCol] ?? '';
        const na = Number(va);
        const nb = Number(vb);
        if (!isNaN(na) && !isNaN(nb)) {
          return sortDir === 'asc' ? na - nb : nb - na;
        }
        const sa = String(va);
        const sb = String(vb);
        return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
    }

    return rows;
  }, [preview?.rows, searchTerm, filterCol, filterValue, sortCol, sortDir]);

  const totalPages = Math.ceil(filteredRows.length / pageSize);
  const paginatedRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') {
        setSortCol(null);
        setSortDir(null);
      }
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-gray-300" />;
    if (sortDir === 'asc') return <ArrowUp className="w-3 h-3 text-primary-600" />;
    return <ArrowDown className="w-3 h-3 text-primary-600" />;
  };

  return (
    <div>
      <div className="mb-6">
        <Link to={`/projects/${projectId}`} className="text-primary-600 hover:text-primary-800 text-sm">
          &larr; Back to Project
        </Link>
        <div className="flex items-start justify-between mt-2">
          <div>
            <h1 className="text-2xl font-bold">Data Explorer</h1>
            <p className="text-gray-500 text-sm">
              {project?.name} &middot; {datasetInfo?.filename ?? `Dataset #${dsId}`}
            </p>
          </div>
          <Link
            to={`/projects/${projectId}`}
            state={{ selectDatasetId: dsId }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
          >
            <Play className="w-4 h-4" /> Run Analysis
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      {datasetInfo && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Database className="w-4 h-4" />
              <span className="text-xs">Rows</span>
            </div>
            <p className="text-xl font-bold">{datasetInfo.row_count.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Columns className="w-4 h-4" />
              <span className="text-xs">Columns</span>
            </div>
            <p className="text-xl font-bold">{datasetInfo.col_count}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Table className="w-4 h-4" />
              <span className="text-xs">Format</span>
            </div>
            <p className="text-xl font-bold uppercase">{datasetInfo.format}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="flex items-center gap-2 text-gray-500 mb-1">
              <Filter className="w-4 h-4" />
              <span className="text-xs">Showing</span>
            </div>
            <p className="text-xl font-bold">{filteredRows.length.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Column info toggle */}
      <div className="mb-4">
        <button
          onClick={() => setColInfoOpen(!colInfoOpen)}
          className="text-sm text-primary-600 hover:text-primary-800 flex items-center gap-1"
        >
          <Columns className="w-4 h-4" />
          {colInfoOpen ? 'Hide' : 'Show'} Column Info
        </button>
        {colInfoOpen && datasetInfo?.column_metadata && (
          <div className="mt-2 bg-white rounded-lg shadow-sm border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-2 border-b">Column</th>
                  <th className="text-left px-4 py-2 border-b">Type</th>
                  <th className="text-left px-4 py-2 border-b">Null Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(datasetInfo.column_metadata).map(([col, meta]) => (
                  <tr key={col} className="border-b last:border-0">
                    <td className="px-4 py-2 font-medium">{col}</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">{meta.dtype}</span>
                    </td>
                    <td className="px-4 py-2">
                      {meta.null_count > 0 ? (
                        <span className="text-amber-600">{meta.null_count}</span>
                      ) : (
                        <span className="text-green-600">0</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            placeholder="Search all columns..."
            className="w-full border rounded-md pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterCol}
          onChange={(e) => { setFilterCol(e.target.value); setPage(0); }}
          className="border rounded-md px-3 py-2 text-sm"
        >
          <option value="">Filter by column...</option>
          {columns.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {filterCol && (
          <input
            type="text"
            value={filterValue}
            onChange={(e) => { setFilterValue(e.target.value); setPage(0); }}
            placeholder={`Filter ${filterCol}...`}
            className="border rounded-md px-3 py-2 text-sm"
          />
        )}
      </div>

      {/* Data table */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center text-gray-400">
          Loading data...
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-3 py-2 text-left text-xs text-gray-500 w-12">#</th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-3 py-2 text-left cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort(col)}
                    >
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-semibold">{col}</span>
                        <SortIcon col={col} />
                      </div>
                      <span className="text-[10px] text-gray-400 font-normal">{dtypes[col]}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-400">{page * pageSize + rowIdx + 1}</td>
                    {columns.map((col) => {
                      const val = row[col];
                      const isNull = val === null || val === undefined || val === '';
                      return (
                        <td key={col} className={`px-3 py-2 ${isNull ? 'text-gray-300 italic' : ''}`}>
                          {isNull ? 'null' : String(val)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {paginatedRows.length === 0 && (
                  <tr>
                    <td colSpan={columns.length + 1} className="px-3 py-8 text-center text-gray-400">
                      No matching rows found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <p className="text-xs text-gray-500">
                Showing {page * pageSize + 1}-{Math.min((page + 1) * pageSize, filteredRows.length)} of{' '}
                {filteredRows.length} rows
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                  className="p-1 border rounded hover:bg-white disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-gray-600">
                  Page {page + 1} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 border rounded hover:bg-white disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
