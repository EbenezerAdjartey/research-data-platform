import { useQuery } from '@tanstack/react-query';
import { datasets } from '@rdp/api-client';
import { X } from 'lucide-react';

interface Props {
  projectId: number;
  datasetId: number;
  onClose: () => void;
}

export default function DataPreviewModal({ projectId, datasetId, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['preview', projectId, datasetId],
    queryFn: () => datasets.preview(projectId, datasetId, 100),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-6xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Data Preview ({data?.total_rows} total rows)</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading preview...</div>
          ) : data ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {data.columns.map((col) => (
                    <th key={col} className="px-4 py-2 text-left font-medium text-gray-600 whitespace-nowrap">
                      <div>{col}</div>
                      <div className="text-xs text-gray-400 font-normal">{data.dtypes[col]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    {data.columns.map((col) => (
                      <td key={col} className="px-4 py-2 whitespace-nowrap text-gray-700">
                        {String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </div>
  );
}
