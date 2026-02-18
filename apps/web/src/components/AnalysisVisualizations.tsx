import Plot from 'react-plotly.js';
import type { AnalysisType } from '@rdp/shared-types';

interface Props {
  analysisType: AnalysisType;
  results: Record<string, unknown>;
}

export default function AnalysisVisualizations({ analysisType, results }: Props) {
  const charts = generateCharts(analysisType, results);
  if (charts.length === 0) return null;

  return (
    <div className="space-y-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase">Visualizations</h2>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {charts.map((chart, i) => (
          <div key={i} className="bg-white rounded-lg border p-4">
            <Plot
              data={chart.data}
              layout={{
                ...chart.layout,
                autosize: true,
                margin: { t: 40, r: 20, b: 50, l: 60 },
                font: { family: 'Inter, system-ui, sans-serif', size: 12 },
                paper_bgcolor: 'transparent',
                plot_bgcolor: '#fafafa',
              }}
              config={{ responsive: true, displayModeBar: true, displaylogo: false }}
              style={{ width: '100%', height: '400px' }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface ChartSpec {
  data: any[];
  layout: Record<string, any>;
}

function generateCharts(type: AnalysisType, results: Record<string, unknown>): ChartSpec[] {
  const charts: ChartSpec[] = [];

  switch (type) {
    case 'descriptive_statistics': {
      const summary = results.summary as Record<string, Record<string, number>> | undefined;
      if (!summary) break;
      const cols = Object.keys(summary);
      // Box plot-like comparison
      charts.push({
        data: cols.map((col) => ({
          type: 'bar' as const,
          name: col,
          x: ['Mean', 'Median', 'Std Dev', 'Min', 'Max', 'Q1', 'Q3'],
          y: [summary[col].mean, summary[col].median, summary[col].std, summary[col].min, summary[col].max, summary[col].q1, summary[col].q3],
        })),
        layout: { title: 'Descriptive Statistics Summary', barmode: 'group' },
      });
      // Skewness & Kurtosis
      charts.push({
        data: [
          { type: 'bar' as const, name: 'Skewness', x: cols, y: cols.map((c) => summary[c].skewness), marker: { color: '#6366f1' } },
          { type: 'bar' as const, name: 'Kurtosis', x: cols, y: cols.map((c) => summary[c].kurtosis), marker: { color: '#f59e0b' } },
        ],
        layout: { title: 'Distribution Shape', barmode: 'group' },
      });
      break;
    }

    case 'frequency_table': {
      const table = results.table as Array<{ value: string; frequency: number; percentage: number; cumulative_percentage: number }> | undefined;
      if (!table) break;
      charts.push({
        data: [{ type: 'bar' as const, x: table.map((r) => r.value), y: table.map((r) => r.frequency), marker: { color: '#6366f1' } }],
        layout: { title: `Frequency Distribution: ${results.column || ''}`, xaxis: { title: 'Value' }, yaxis: { title: 'Frequency' } },
      });
      charts.push({
        data: [{ type: 'pie' as const, labels: table.map((r) => r.value), values: table.map((r) => r.frequency), hole: 0.3 }],
        layout: { title: `Proportions: ${results.column || ''}` },
      });
      break;
    }

    case 'independent_t_test':
    case 'paired_t_test':
    case 'one_sample_t_test':
    case 'z_test': {
      const gs = results.group_stats as Record<string, { mean: number; std: number; n: number }> | undefined;
      if (gs) {
        const groups = Object.keys(gs);
        charts.push({
          data: [{
            type: 'bar' as const,
            x: groups,
            y: groups.map((g) => gs[g].mean),
            error_y: { type: 'data' as const, array: groups.map((g) => gs[g].std), visible: true },
            marker: { color: ['#6366f1', '#f59e0b', '#10b981', '#ef4444'].slice(0, groups.length) },
          }],
          layout: { title: `${results.test || 'Test'} - Group Means`, yaxis: { title: 'Mean (± SD)' } },
        });
      }
      break;
    }

    case 'chi_square_test': {
      const ct = results.contingency_table as Record<string, Record<string, number>> | undefined;
      if (ct) {
        const rows = Object.keys(ct);
        const cols = rows.length > 0 ? Object.keys(ct[rows[0]]) : [];
        charts.push({
          data: [{
            type: 'heatmap' as const,
            z: rows.map((r) => cols.map((c) => ct[r]?.[c] ?? 0)),
            x: cols,
            y: rows,
            colorscale: 'Blues',
          }],
          layout: { title: 'Contingency Table Heatmap' },
        });
      }
      break;
    }

    case 'one_way_anova':
    case 'two_way_anova': {
      const gs = results.group_stats as Record<string, { mean: number; std: number; n: number }> | undefined;
      if (gs) {
        const groups = Object.keys(gs);
        charts.push({
          data: [{
            type: 'bar' as const,
            x: groups,
            y: groups.map((g) => gs[g].mean),
            error_y: { type: 'data' as const, array: groups.map((g) => gs[g].std), visible: true },
            marker: { color: groups.map((_, i) => `hsl(${(i * 360) / groups.length}, 70%, 60%)`) },
          }],
          layout: { title: `${results.test || 'ANOVA'} - Group Comparison`, yaxis: { title: 'Mean (± SD)' } },
        });
      }
      break;
    }

    case 'linear_regression':
    case 'multiple_linear_regression':
    case 'polynomial_regression': {
      const coefs = results.coefficients as Record<string, { coefficient: number; p_value: number }> | undefined;
      if (coefs) {
        const names = Object.keys(coefs).filter((n) => n !== 'const');
        charts.push({
          data: [{
            type: 'bar' as const,
            x: names,
            y: names.map((n) => coefs[n].coefficient),
            marker: { color: names.map((n) => coefs[n].p_value < 0.05 ? '#10b981' : '#94a3b8') },
          }],
          layout: { title: 'Regression Coefficients', yaxis: { title: 'Coefficient' }, xaxis: { title: 'Variable' } },
        });
        // P-value chart
        charts.push({
          data: [{
            type: 'bar' as const,
            x: names,
            y: names.map((n) => coefs[n].p_value),
            marker: { color: names.map((n) => coefs[n].p_value < 0.05 ? '#10b981' : '#ef4444') },
          }, {
            type: 'scatter' as const,
            mode: 'lines' as const,
            x: [names[0], names[names.length - 1]],
            y: [0.05, 0.05],
            line: { dash: 'dash', color: '#ef4444' },
            name: 'α = 0.05',
          }],
          layout: { title: 'P-Values', yaxis: { title: 'P-value' }, showlegend: true },
        });
      }
      break;
    }

    case 'ridge_regression':
    case 'lasso_regression':
    case 'elastic_net': {
      const coefs = results.coefficients as Record<string, number> | undefined;
      if (coefs) {
        const names = Object.keys(coefs);
        charts.push({
          data: [{
            type: 'bar' as const,
            x: names,
            y: names.map((n) => coefs[n]),
            marker: { color: '#6366f1' },
          }],
          layout: { title: `${results.test || 'Regularized Regression'} - Coefficients`, yaxis: { title: 'Coefficient' } },
        });
      }
      break;
    }

    case 'pearson_correlation':
    case 'spearman_correlation': {
      const corrMatrix = results.correlation_matrix as Record<string, Record<string, number>> | undefined;
      if (corrMatrix) {
        const vars = Object.keys(corrMatrix);
        charts.push({
          data: [{
            type: 'heatmap' as const,
            z: vars.map((r) => vars.map((c) => corrMatrix[r]?.[c] ?? 0)),
            x: vars,
            y: vars,
            colorscale: 'RdBu',
            zmin: -1,
            zmax: 1,
            text: vars.map((r) => vars.map((c) => (corrMatrix[r]?.[c] ?? 0).toFixed(3))),
            texttemplate: '%{text}',
          }],
          layout: { title: 'Correlation Matrix', width: undefined, height: 450 },
        });
      }
      break;
    }

    case 'normality_test': {
      // Display test results as a summary bar
      const tests: { name: string; p: number | null }[] = [
        { name: 'Shapiro-Wilk', p: (results.shapiro_wilk as { p_value: number | null })?.p_value ?? null },
        { name: 'K-S', p: (results.kolmogorov_smirnov as { p_value: number | null })?.p_value ?? null },
        { name: "D'Agostino", p: (results.dagostino_pearson as { p_value: number | null })?.p_value ?? null },
      ].filter((t) => t.p !== null);
      if (tests.length > 0) {
        charts.push({
          data: [{
            type: 'bar' as const,
            x: tests.map((t) => t.name),
            y: tests.map((t) => t.p!),
            marker: { color: tests.map((t) => (t.p! > 0.05 ? '#10b981' : '#ef4444')) },
          }, {
            type: 'scatter' as const,
            mode: 'lines' as const,
            x: [tests[0].name, tests[tests.length - 1].name],
            y: [0.05, 0.05],
            line: { dash: 'dash', color: '#ef4444' },
            name: 'α = 0.05',
          }],
          layout: { title: 'Normality Test P-Values (green = normal)', yaxis: { title: 'P-value' }, showlegend: true },
        });
      }
      break;
    }

    case 'pca': {
      const variance = results.explained_variance_ratio as number[] | undefined;
      if (variance) {
        const cumulative = variance.reduce((acc: number[], v: number) => {
          acc.push((acc.length > 0 ? acc[acc.length - 1] : 0) + v);
          return acc;
        }, []);
        charts.push({
          data: [
            { type: 'bar' as const, name: 'Individual', x: variance.map((_, i) => `PC${i + 1}`), y: variance, marker: { color: '#6366f1' } },
            { type: 'scatter' as const, mode: 'lines+markers' as const, name: 'Cumulative', x: variance.map((_, i) => `PC${i + 1}`), y: cumulative, line: { color: '#f59e0b' } },
          ],
          layout: { title: 'Scree Plot - Explained Variance', yaxis: { title: 'Variance Ratio' }, showlegend: true },
        });
      }
      break;
    }

    case 'cluster_analysis':
    case 'clustering_ml':
    case 'gaussian_mixture': {
      const info = results.cluster_info as Record<string, { size: number }> | undefined;
      if (info) {
        const names = Object.keys(info);
        charts.push({
          data: [{ type: 'pie' as const, labels: names, values: names.map((n) => info[n].size), hole: 0.3 }],
          layout: { title: 'Cluster Distribution' },
        });
      }
      break;
    }

    case 'classification':
    case 'naive_bayes':
    case 'decision_tree':
    case 'gradient_boosting':
    case 'knn_classifier': {
      // Feature importance
      const importance = results.feature_importance as Record<string, number> | undefined;
      if (importance) {
        const sorted = Object.entries(importance).sort((a, b) => b[1] - a[1]);
        charts.push({
          data: [{
            type: 'bar' as const,
            x: sorted.map(([, v]) => v),
            y: sorted.map(([k]) => k),
            orientation: 'h' as const,
            marker: { color: '#6366f1' },
          }],
          layout: { title: 'Feature Importance', xaxis: { title: 'Importance' }, yaxis: { automargin: true } },
        });
      }
      // Accuracy comparison
      const trainAcc = results.train_accuracy as number | undefined;
      const testAcc = results.test_accuracy as number | undefined;
      const cvAcc = results.cv_accuracy_mean as number | undefined;
      if (trainAcc !== undefined && testAcc !== undefined) {
        charts.push({
          data: [{
            type: 'bar' as const,
            x: ['Train', 'Test', ...(cvAcc !== undefined ? ['CV Mean'] : [])],
            y: [trainAcc, testAcc, ...(cvAcc !== undefined ? [cvAcc] : [])],
            marker: { color: ['#6366f1', '#10b981', '#f59e0b'] },
          }],
          layout: { title: 'Model Accuracy', yaxis: { title: 'Accuracy', range: [0, 1] } },
        });
      }
      // Classification report heatmap
      const report = results.classification_report as Record<string, Record<string, number>> | undefined;
      if (report) {
        const classes = Object.keys(report).filter((k) => !['accuracy', 'macro avg', 'weighted avg'].includes(k));
        const metrics = ['precision', 'recall', 'f1-score'];
        if (classes.length > 0) {
          charts.push({
            data: [{
              type: 'heatmap' as const,
              z: classes.map((c) => metrics.map((m) => report[c]?.[m] ?? 0)),
              x: metrics,
              y: classes,
              colorscale: 'Greens',
              zmin: 0,
              zmax: 1,
              text: classes.map((c) => metrics.map((m) => (report[c]?.[m] ?? 0).toFixed(3))),
              texttemplate: '%{text}',
            }],
            layout: { title: 'Classification Report' },
          });
        }
      }
      break;
    }

    case 'arima':
    case 'sarima':
    case 'auto_arima': {
      const forecast = results.forecast as number[] | undefined;
      if (forecast) {
        charts.push({
          data: [{
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            y: forecast,
            x: forecast.map((_, i) => `t+${i + 1}`),
            line: { color: '#6366f1' },
            name: 'Forecast',
          }],
          layout: { title: `${results.test || 'Time Series'} Forecast`, yaxis: { title: 'Value' }, xaxis: { title: 'Horizon' } },
        });
      }
      break;
    }

    case 'arch':
    case 'garch':
    case 'egarch':
    case 'tgarch': {
      const vol = results.conditional_volatility as number[] | undefined;
      const varForecast = results.variance_forecast as number[] | undefined;
      if (vol) {
        charts.push({
          data: [{
            type: 'scatter' as const,
            mode: 'lines' as const,
            y: vol,
            line: { color: '#ef4444' },
            name: 'Conditional Volatility',
          }],
          layout: { title: `${results.test || 'Volatility'} - Conditional Volatility`, yaxis: { title: 'Volatility' } },
        });
      }
      if (varForecast) {
        charts.push({
          data: [{
            type: 'bar' as const,
            y: varForecast,
            x: varForecast.map((_, i) => `t+${i + 1}`),
            marker: { color: '#f59e0b' },
          }],
          layout: { title: 'Variance Forecast', yaxis: { title: 'Variance' }, xaxis: { title: 'Horizon' } },
        });
      }
      break;
    }

    case 'exponential_smoothing': {
      const forecast = results.forecast as number[] | undefined;
      if (forecast) {
        charts.push({
          data: [{
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            y: forecast,
            x: forecast.map((_, i) => `t+${i + 1}`),
            line: { color: '#10b981' },
            name: 'Forecast',
          }],
          layout: { title: 'Exponential Smoothing Forecast', yaxis: { title: 'Value' } },
        });
      }
      break;
    }

    case 'var': {
      const forecast = results.forecast as Record<string, number[]> | undefined;
      if (forecast) {
        const vars = Object.keys(forecast);
        charts.push({
          data: vars.map((v, i) => ({
            type: 'scatter' as const,
            mode: 'lines+markers' as const,
            name: v,
            y: forecast[v],
            x: forecast[v].map((_, j) => `t+${j + 1}`),
            line: { color: `hsl(${(i * 360) / vars.length}, 70%, 50%)` },
          })),
          layout: { title: 'VAR Forecast', yaxis: { title: 'Value' }, showlegend: true },
        });
      }
      break;
    }

    case 'decomposition': {
      const trend = results.trend as (number | null)[] | undefined;
      const seasonal = results.seasonal as number[] | undefined;
      const residual = results.residual as (number | null)[] | undefined;
      if (trend && seasonal && residual) {
        charts.push({
          data: [
            { type: 'scatter' as const, mode: 'lines' as const, name: 'Trend', y: trend.filter((v): v is number => v !== null), line: { color: '#6366f1' } },
            { type: 'scatter' as const, mode: 'lines' as const, name: 'Seasonal', y: seasonal, line: { color: '#10b981' } },
            { type: 'scatter' as const, mode: 'lines' as const, name: 'Residual', y: residual.filter((v): v is number => v !== null), line: { color: '#f59e0b' } },
          ],
          layout: { title: 'Time Series Decomposition', showlegend: true, yaxis: { title: 'Value' } },
        });
      }
      break;
    }

    case 'kaplan_meier': {
      const survivalData = results.survival_function as Record<string, number> | undefined;
      if (survivalData) {
        const times = Object.keys(survivalData).map(Number).sort((a, b) => a - b);
        charts.push({
          data: [{
            type: 'scatter' as const,
            mode: 'lines' as const,
            x: times,
            y: times.map((t) => survivalData[String(t)]),
            line: { shape: 'hv' as const, color: '#6366f1' },
            name: 'Survival',
          }],
          layout: { title: 'Kaplan-Meier Survival Curve', xaxis: { title: 'Time' }, yaxis: { title: 'Survival Probability', range: [0, 1] } },
        });
      }
      break;
    }

    case 'cox_regression': {
      const coefs = results.coefficients as Record<string, { coef: number; hazard_ratio: number; p_value: number }> | undefined;
      if (coefs) {
        const names = Object.keys(coefs);
        charts.push({
          data: [{
            type: 'bar' as const,
            x: names,
            y: names.map((n) => coefs[n].hazard_ratio),
            marker: { color: names.map((n) => coefs[n].p_value < 0.05 ? '#ef4444' : '#94a3b8') },
          }, {
            type: 'scatter' as const,
            mode: 'lines' as const,
            x: [names[0], names[names.length - 1]],
            y: [1, 1],
            line: { dash: 'dash', color: '#000' },
            name: 'HR = 1',
          }],
          layout: { title: 'Hazard Ratios', yaxis: { title: 'Hazard Ratio' }, showlegend: true },
        });
      }
      break;
    }

    case 'meta_analysis': {
      const studies = results.studies as Array<{ study: string; effect_size: number; ci_lower: number; ci_upper: number }> | undefined;
      if (studies) {
        charts.push({
          data: [{
            type: 'scatter' as const,
            mode: 'markers' as const,
            x: studies.map((s) => s.effect_size),
            y: studies.map((s) => s.study),
            error_x: {
              type: 'data' as const,
              symmetric: false,
              array: studies.map((s) => s.ci_upper - s.effect_size),
              arrayminus: studies.map((s) => s.effect_size - s.ci_lower),
            },
            marker: { size: 10, color: '#6366f1' },
          }],
          layout: { title: 'Forest Plot', xaxis: { title: 'Effect Size', zeroline: true } },
        });
      }
      break;
    }

    case 'regression_ml': {
      const importance = results.feature_importance as Record<string, number> | undefined;
      if (importance) {
        const sorted = Object.entries(importance).sort((a, b) => b[1] - a[1]);
        charts.push({
          data: [{
            type: 'bar' as const,
            x: sorted.map(([, v]) => v),
            y: sorted.map(([k]) => k),
            orientation: 'h' as const,
            marker: { color: '#6366f1' },
          }],
          layout: { title: 'Feature Importance', xaxis: { title: 'Importance' }, yaxis: { automargin: true } },
        });
      }
      break;
    }

    default:
      break;
  }

  return charts;
}
