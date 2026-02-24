// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  institution?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface User {
  id: number;
  email: string;
  full_name: string;
  institution: string | null;
  subscription_status: string;
}

// Project types
export interface Project {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  description?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
}

// Dataset types
export interface Dataset {
  id: number;
  project_id: number;
  filename: string;
  format: string;
  row_count: number;
  col_count: number;
  column_metadata: Record<string, ColumnMeta>;
  created_at: string;
}

export interface ColumnMeta {
  dtype: string;
  null_count: number;
}

export interface DatasetPreview {
  columns: string[];
  dtypes: Record<string, string>;
  rows: Record<string, unknown>[];
  total_rows: number;
}

export interface SampleDatasetInfo {
  id: string;
  name: string;
  description: string;
  rows: number;
  cols: number;
  tags: string[];
}

// Analysis types
export type AnalysisType =
  | 'descriptive_statistics'
  | 'frequency_table'
  | 'independent_t_test'
  | 'paired_t_test'
  | 'one_sample_t_test'
  | 'z_test'
  | 'chi_square_test'
  | 'one_way_anova'
  | 'two_way_anova'
  | 'manova'
  | 'ancova'
  | 'pearson_correlation'
  | 'normality_test'
  | 'linear_regression'
  | 'multiple_linear_regression'
  | 'polynomial_regression'
  | 'logistic_regression'
  | 'ridge_regression'
  | 'lasso_regression'
  | 'elastic_net'
  | 'mann_whitney'
  | 'wilcoxon'
  | 'kruskal_wallis'
  | 'friedman'
  | 'spearman_correlation'
  | 'pca'
  | 'factor_analysis'
  | 'cluster_analysis'
  | 'discriminant_analysis'
  | 'arima'
  | 'sarima'
  | 'auto_arima'
  | 'decomposition'
  | 'exponential_smoothing'
  | 'var'
  | 'granger_causality'
  | 'arch'
  | 'garch'
  | 'egarch'
  | 'tgarch'
  | 'bayesian_regression'
  | 'kaplan_meier'
  | 'cox_regression'
  | 'meta_analysis'
  | 'classification'
  | 'naive_bayes'
  | 'decision_tree'
  | 'gradient_boosting'
  | 'knn_classifier'
  | 'gaussian_mixture'
  | 'regression_ml'
  | 'clustering_ml';

export interface AnalysisRequest {
  dataset_id: number;
  project_id: number;
  analysis_type: AnalysisType;
  parameters: Record<string, unknown>;
}

export type AnalysisStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AnalysisResult {
  id: number;
  dataset_id: number;
  project_id: number;
  analysis_type: AnalysisType;
  parameters: Record<string, unknown>;
  results: Record<string, unknown> | null;
  status: AnalysisStatus;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// Visualization types
export type ChartType =
  | 'bar'
  | 'scatter'
  | 'histogram'
  | 'box'
  | 'violin'
  | 'heatmap'
  | 'line'
  | 'pie'
  | 'qq'
  | 'forest';

export interface Visualization {
  id: number;
  analysis_result_id: number;
  chart_type: ChartType;
  plotly_json: Record<string, unknown>;
  created_at: string;
}

export interface VisualizationCreate {
  analysis_result_id: number;
  chart_type: ChartType;
  config: Record<string, unknown>;
}

// Report types
export interface Report {
  id: number;
  project_id: number;
  title: string;
  sections: Record<string, unknown>;
  export_format: 'pdf' | 'docx' | null;
  file_path: string | null;
  created_at: string;
}

export interface ReportCreate {
  project_id: number;
  title: string;
  sections: Record<string, unknown>;
  export_format?: 'pdf' | 'docx';
}

// Analysis category groupings for UI
export const ANALYSIS_CATEGORIES = {
  descriptive: {
    label: 'Descriptive Statistics',
    methods: ['descriptive_statistics', 'frequency_table', 'normality_test', 'pearson_correlation'],
  },
  inferential: {
    label: 'Inferential Tests',
    methods: ['independent_t_test', 'paired_t_test', 'one_sample_t_test', 'z_test', 'chi_square_test', 'one_way_anova', 'two_way_anova', 'manova', 'ancova'],
  },
  regression: {
    label: 'Regression',
    methods: ['linear_regression', 'multiple_linear_regression', 'polynomial_regression', 'logistic_regression', 'ridge_regression', 'lasso_regression', 'elastic_net'],
  },
  nonparametric: {
    label: 'Non-parametric Tests',
    methods: ['mann_whitney', 'wilcoxon', 'kruskal_wallis', 'friedman', 'spearman_correlation'],
  },
  multivariate: {
    label: 'Multivariate Analysis',
    methods: ['pca', 'factor_analysis', 'cluster_analysis', 'discriminant_analysis', 'gaussian_mixture'],
  },
  timeseries: {
    label: 'Time Series',
    methods: ['arima', 'sarima', 'auto_arima', 'decomposition', 'exponential_smoothing', 'var', 'granger_causality', 'arch', 'garch', 'egarch', 'tgarch'],
  },
  bayesian: {
    label: 'Bayesian Methods',
    methods: ['bayesian_regression'],
  },
  survival: {
    label: 'Survival Analysis',
    methods: ['kaplan_meier', 'cox_regression'],
  },
  meta: {
    label: 'Meta-Analysis',
    methods: ['meta_analysis'],
  },
  ml: {
    label: 'Machine Learning',
    methods: ['classification', 'naive_bayes', 'decision_tree', 'gradient_boosting', 'knn_classifier', 'regression_ml', 'clustering_ml'],
  },
} as const;
