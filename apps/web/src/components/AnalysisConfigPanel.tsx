import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { analysis } from '@rdp/api-client';
import type { AnalysisType } from '@rdp/shared-types';
import toast from 'react-hot-toast';
import { Play } from 'lucide-react';

interface Props {
  analysisType: AnalysisType;
  datasetId: number;
  projectId: number;
  columns: string[];
}

const PARAM_CONFIGS: Record<string, { key: string; label: string; type: 'column' | 'columns' | 'number' | 'select'; options?: string[] }[]> = {
  descriptive_statistics: [
    { key: 'columns', label: 'Columns (leave empty for all numeric)', type: 'columns' },
  ],
  frequency_table: [
    { key: 'column', label: 'Column', type: 'column' },
  ],
  independent_t_test: [
    { key: 'group_column', label: 'Group Column', type: 'column' },
    { key: 'value_column', label: 'Value Column', type: 'column' },
  ],
  paired_t_test: [
    { key: 'column1', label: 'Column 1', type: 'column' },
    { key: 'column2', label: 'Column 2', type: 'column' },
  ],
  one_sample_t_test: [
    { key: 'column', label: 'Column', type: 'column' },
    { key: 'population_mean', label: 'Population Mean', type: 'number' },
  ],
  chi_square_test: [
    { key: 'column1', label: 'Column 1', type: 'column' },
    { key: 'column2', label: 'Column 2', type: 'column' },
  ],
  one_way_anova: [
    { key: 'group_column', label: 'Group Column', type: 'column' },
    { key: 'value_column', label: 'Value Column', type: 'column' },
  ],
  two_way_anova: [
    { key: 'factor1', label: 'Factor 1', type: 'column' },
    { key: 'factor2', label: 'Factor 2', type: 'column' },
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
  ],
  linear_regression: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'independent', label: 'Independent Variables', type: 'columns' },
  ],
  logistic_regression: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'independent', label: 'Independent Variables', type: 'columns' },
  ],
  mann_whitney: [
    { key: 'group_column', label: 'Group Column', type: 'column' },
    { key: 'value_column', label: 'Value Column', type: 'column' },
  ],
  wilcoxon: [
    { key: 'column1', label: 'Column 1', type: 'column' },
    { key: 'column2', label: 'Column 2', type: 'column' },
  ],
  kruskal_wallis: [
    { key: 'group_column', label: 'Group Column', type: 'column' },
    { key: 'value_column', label: 'Value Column', type: 'column' },
  ],
  spearman_correlation: [
    { key: 'column1', label: 'Column 1', type: 'column' },
    { key: 'column2', label: 'Column 2', type: 'column' },
  ],
  pca: [
    { key: 'columns', label: 'Columns', type: 'columns' },
    { key: 'n_components', label: 'Components', type: 'number' },
  ],
  factor_analysis: [
    { key: 'columns', label: 'Columns', type: 'columns' },
    { key: 'n_factors', label: 'Number of Factors', type: 'number' },
  ],
  cluster_analysis: [
    { key: 'columns', label: 'Columns', type: 'columns' },
    { key: 'n_clusters', label: 'Number of Clusters', type: 'number' },
  ],
  classification: [
    { key: 'features', label: 'Feature Columns', type: 'columns' },
    { key: 'target', label: 'Target Column', type: 'column' },
    { key: 'algorithm', label: 'Algorithm', type: 'select', options: ['random_forest', 'svm', 'mlp'] },
  ],
  arima: [
    { key: 'column', label: 'Time Series Column', type: 'column' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
  ],
  kaplan_meier: [
    { key: 'duration_column', label: 'Duration Column', type: 'column' },
    { key: 'event_column', label: 'Event Column', type: 'column' },
    { key: 'group_column', label: 'Group Column (optional)', type: 'column' },
  ],
  cox_regression: [
    { key: 'duration_column', label: 'Duration Column', type: 'column' },
    { key: 'event_column', label: 'Event Column', type: 'column' },
    { key: 'covariates', label: 'Covariates', type: 'columns' },
  ],
  meta_analysis: [
    { key: 'effect_size_column', label: 'Effect Size Column', type: 'column' },
    { key: 'variance_column', label: 'Variance Column', type: 'column' },
    { key: 'study_column', label: 'Study Label Column', type: 'column' },
  ],
  ridge_regression: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'independent', label: 'Independent Variables', type: 'columns' },
    { key: 'alpha_reg', label: 'Alpha (Regularization)', type: 'number' },
  ],
  lasso_regression: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'independent', label: 'Independent Variables', type: 'columns' },
    { key: 'alpha_reg', label: 'Alpha (Regularization)', type: 'number' },
  ],
  elastic_net: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'independent', label: 'Independent Variables', type: 'columns' },
    { key: 'alpha_reg', label: 'Alpha', type: 'number' },
    { key: 'l1_ratio', label: 'L1 Ratio (0-1)', type: 'number' },
  ],
  sarima: [
    { key: 'column', label: 'Time Series Column', type: 'column' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
    { key: 'seasonal_period', label: 'Seasonal Period', type: 'number' },
  ],
  auto_arima: [
    { key: 'column', label: 'Time Series Column', type: 'column' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
  ],
  decomposition: [
    { key: 'column', label: 'Time Series Column', type: 'column' },
    { key: 'period', label: 'Period', type: 'number' },
    { key: 'model', label: 'Model', type: 'select', options: ['additive', 'multiplicative'] },
  ],
  friedman: [
    { key: 'columns', label: 'Measurement Columns', type: 'columns' },
  ],
  discriminant_analysis: [
    { key: 'features', label: 'Feature Columns', type: 'columns' },
    { key: 'target', label: 'Group Column', type: 'column' },
  ],
  bayesian_regression: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'independent', label: 'Independent Variables', type: 'columns' },
  ],
  clustering_ml: [
    { key: 'columns', label: 'Feature Columns', type: 'columns' },
    { key: 'n_clusters', label: 'Number of Clusters', type: 'number' },
    { key: 'algorithm', label: 'Algorithm', type: 'select', options: ['kmeans', 'dbscan', 'hierarchical'] },
  ],
  multiple_linear_regression: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'independent', label: 'Independent Variables (select 2+)', type: 'columns' },
  ],
  polynomial_regression: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'independent', label: 'Independent Variables', type: 'columns' },
    { key: 'degree', label: 'Polynomial Degree', type: 'number' },
  ],
  arch: [
    { key: 'column', label: 'Series Column', type: 'column' },
    { key: 'p', label: 'ARCH Order (p)', type: 'number' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
  ],
  garch: [
    { key: 'column', label: 'Series Column', type: 'column' },
    { key: 'p', label: 'GARCH p', type: 'number' },
    { key: 'q', label: 'GARCH q', type: 'number' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
  ],
  egarch: [
    { key: 'column', label: 'Series Column', type: 'column' },
    { key: 'p', label: 'EGARCH p', type: 'number' },
    { key: 'q', label: 'EGARCH q', type: 'number' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
  ],
  tgarch: [
    { key: 'column', label: 'Series Column', type: 'column' },
    { key: 'p', label: 'p', type: 'number' },
    { key: 'o', label: 'o (asymmetry)', type: 'number' },
    { key: 'q', label: 'q', type: 'number' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
  ],
  z_test: [
    { key: 'column', label: 'Column', type: 'column' },
    { key: 'population_mean', label: 'Population Mean', type: 'number' },
    { key: 'population_std', label: 'Population Std Dev', type: 'number' },
  ],
  pearson_correlation: [
    { key: 'columns', label: 'Columns', type: 'columns' },
  ],
  normality_test: [
    { key: 'column', label: 'Column', type: 'column' },
  ],
  manova: [
    { key: 'dependent', label: 'Dependent Variables', type: 'columns' },
    { key: 'group_column', label: 'Group Column', type: 'column' },
  ],
  ancova: [
    { key: 'dependent', label: 'Dependent Variable', type: 'column' },
    { key: 'group_column', label: 'Group Column', type: 'column' },
    { key: 'covariate', label: 'Covariate', type: 'column' },
  ],
  exponential_smoothing: [
    { key: 'column', label: 'Time Series Column', type: 'column' },
    { key: 'trend', label: 'Trend', type: 'select', options: ['add', 'mul'] },
    { key: 'seasonal', label: 'Seasonal', type: 'select', options: ['add', 'mul'] },
    { key: 'seasonal_periods', label: 'Seasonal Periods', type: 'number' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
  ],
  var: [
    { key: 'columns', label: 'Time Series Columns', type: 'columns' },
    { key: 'forecast_steps', label: 'Forecast Steps', type: 'number' },
  ],
  granger_causality: [
    { key: 'column1', label: 'Column 1', type: 'column' },
    { key: 'column2', label: 'Column 2', type: 'column' },
    { key: 'maxlag', label: 'Max Lag', type: 'number' },
  ],
  naive_bayes: [
    { key: 'features', label: 'Feature Columns', type: 'columns' },
    { key: 'target', label: 'Target Column', type: 'column' },
  ],
  decision_tree: [
    { key: 'features', label: 'Feature Columns', type: 'columns' },
    { key: 'target', label: 'Target Column', type: 'column' },
    { key: 'max_depth', label: 'Max Depth (optional)', type: 'number' },
  ],
  gradient_boosting: [
    { key: 'features', label: 'Feature Columns', type: 'columns' },
    { key: 'target', label: 'Target Column', type: 'column' },
    { key: 'n_estimators', label: 'Number of Estimators', type: 'number' },
  ],
  knn_classifier: [
    { key: 'features', label: 'Feature Columns', type: 'columns' },
    { key: 'target', label: 'Target Column', type: 'column' },
    { key: 'n_neighbors', label: 'K (Neighbors)', type: 'number' },
  ],
  gaussian_mixture: [
    { key: 'columns', label: 'Feature Columns', type: 'columns' },
    { key: 'n_components', label: 'Number of Components', type: 'number' },
  ],
  regression_ml: [
    { key: 'features', label: 'Feature Columns', type: 'columns' },
    { key: 'target', label: 'Target Column', type: 'column' },
    { key: 'algorithm', label: 'Algorithm', type: 'select', options: ['random_forest', 'gradient_boosting', 'svr'] },
  ],
};

export default function AnalysisConfigPanel({ analysisType, datasetId, projectId, columns }: Props) {
  const [params, setParams] = useState<Record<string, unknown>>({});
  const queryClient = useQueryClient();

  useEffect(() => {
    setParams({});
  }, [analysisType, datasetId]);

  const runMutation = useMutation({
    mutationFn: () =>
      analysis.run({
        dataset_id: datasetId,
        project_id: projectId,
        analysis_type: analysisType,
        parameters: params,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses', projectId] });
      toast.success('Analysis completed');
    },
    onError: (err) => toast.error(`Analysis failed: ${err.message}`),
  });

  const config = PARAM_CONFIGS[analysisType] || [];
  const formatLabel = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="p-4 border-b">
        <h3 className="font-semibold">{formatLabel(analysisType)}</h3>
      </div>
      <div className="p-4 space-y-4">
        {config.map((field) => (
          <div key={field.key}>
            <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
            {field.type === 'column' ? (
              <select
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={(params[field.key] as string) || ''}
                onChange={(e) => setParams({ ...params, [field.key]: e.target.value || undefined })}
              >
                <option value="">Select column...</option>
                {columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : field.type === 'columns' ? (
              <div className="border rounded-lg p-2 max-h-[200px] overflow-y-auto space-y-1">
                {columns.length === 0 ? (
                  <p className="text-sm text-gray-400 p-1">No columns available</p>
                ) : (
                  <>
                    <button
                      type="button"
                      className="text-xs text-primary-600 hover:text-primary-800 mb-1"
                      onClick={() => {
                        const current = (params[field.key] as string[]) || [];
                        setParams({
                          ...params,
                          [field.key]: current.length === columns.length ? [] : [...columns],
                        });
                      }}
                    >
                      {((params[field.key] as string[]) || []).length === columns.length
                        ? 'Deselect All'
                        : 'Select All'}
                    </button>
                    {columns.map((c) => {
                      const selected = ((params[field.key] as string[]) || []).includes(c);
                      return (
                        <label
                          key={c}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                            selected ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                              const current = (params[field.key] as string[]) || [];
                              const next = selected
                                ? current.filter((x) => x !== c)
                                : [...current, c];
                              setParams({ ...params, [field.key]: next });
                            }}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          {c}
                        </label>
                      );
                    })}
                  </>
                )}
                {((params[field.key] as string[]) || []).length > 0 && (
                  <p className="text-xs text-gray-500 mt-1 pt-1 border-t">
                    {((params[field.key] as string[]) || []).length} selected
                  </p>
                )}
              </div>
            ) : field.type === 'number' ? (
              <input
                type="number"
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={(params[field.key] as number) || ''}
                onChange={(e) => setParams({ ...params, [field.key]: Number(e.target.value) })}
              />
            ) : field.type === 'select' ? (
              <select
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={(params[field.key] as string) || field.options?.[0] || ''}
                onChange={(e) => setParams({ ...params, [field.key]: e.target.value })}
              >
                {field.options?.map((o) => (
                  <option key={o} value={o}>{formatLabel(o)}</option>
                ))}
              </select>
            ) : null}
          </div>
        ))}

        <button
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          <Play className="w-4 h-4" />
          {runMutation.isPending ? 'Running...' : 'Run Analysis'}
        </button>
      </div>
    </div>
  );
}
