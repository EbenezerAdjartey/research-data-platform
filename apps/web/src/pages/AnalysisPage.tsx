import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { analysis, datasets } from '@rdp/api-client';
import type { AnalysisType } from '@rdp/shared-types';
import { ArrowLeft, XCircle, AlertTriangle, Database, FileText, RotateCcw } from 'lucide-react';
import AnalysisVisualizations from '@/components/AnalysisVisualizations';

export default function AnalysisPage() {
  const { id, analysisId } = useParams<{ id: string; analysisId: string }>();
  const projectId = Number(id);

  const { data: result, isLoading } = useQuery({
    queryKey: ['analysis', Number(analysisId)],
    queryFn: () => analysis.get(Number(analysisId)),
  });

  const { data: datasetList } = useQuery({
    queryKey: ['datasets', projectId],
    queryFn: () => datasets.list(projectId),
    enabled: !!result,
  });

  const sourceDataset = datasetList?.find((d) => d.id === result?.dataset_id);

  const fmt = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (isLoading) return <div className="text-center py-12 text-gray-500">Loading...</div>;
  if (!result) return <div className="text-center py-12 text-gray-500">Analysis not found.</div>;

  return (
    <div className="max-w-5xl mx-auto">
      <Link to={`/projects/${projectId}`} className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 text-sm mb-4">
        <ArrowLeft className="w-4 h-4" /> Back to Project
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">{fmt(result.analysis_type)}</h1>
              <p className="text-sm text-gray-500 mt-1">Run at {new Date(result.created_at).toLocaleString()}</p>
              {sourceDataset && (
                <Link
                  to={`/projects/${projectId}/explore/${sourceDataset.id}`}
                  className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 mt-1"
                >
                  <Database className="w-3 h-3" /> {sourceDataset.filename}
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                result.status === 'completed' ? 'bg-green-100 text-green-700'
                  : result.status === 'failed' ? 'bg-red-100 text-red-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}>{result.status}</span>
              <Link
                to={`/projects/${projectId}`}
                state={{ selectDatasetId: result.dataset_id }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
                title="Re-run this analysis"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Re-run
              </Link>
              <Link
                to={`/projects/${projectId}/reports`}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <FileText className="w-3.5 h-3.5" /> Add to Report
              </Link>
            </div>
          </div>
        </div>

        {result.error_message && (
          <div className="px-6 pb-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{result.error_message}</p>
            </div>
          </div>
        )}

        {/* Parameters table */}
        <div className="px-6 pb-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Parameters</h2>
          <table className="w-full text-sm border rounded-lg overflow-hidden">
            <tbody>
              {Object.entries(result.parameters).map(([k, v]) => (
                <tr key={k} className="border-b last:border-0 bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-600 w-1/3">{fmt(k)}</td>
                  <td className="px-4 py-2 text-gray-800">{Array.isArray(v) ? (v as string[]).join(', ') : String(v ?? '-')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {result.results && result.status === 'completed' && (
        <>
          {/* Interpretation */}
          <Interpretation analysisType={result.analysis_type as AnalysisType} results={result.results} />

          {/* Key metrics */}
          <KeyMetrics analysisType={result.analysis_type as AnalysisType} results={result.results} />

          {/* Visualizations */}
          <div className="bg-white rounded-lg shadow-sm border mb-6 p-6">
            <AnalysisVisualizations analysisType={result.analysis_type as AnalysisType} results={result.results} />
          </div>

          {/* Detailed Results Tables */}
          <div className="bg-white rounded-lg shadow-sm border mb-6">
            <div className="p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-4">Detailed Results</h2>
              <ResultsDisplay results={result.results} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Interpretation Component ───────────────────────────────── */
function Interpretation({ analysisType, results }: { analysisType: AnalysisType; results: Record<string, unknown> }) {
  const text = generateInterpretation(analysisType, results);
  if (!text.length) return null;

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg mb-6 p-6">
      <h2 className="text-sm font-semibold text-blue-800 uppercase mb-3 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4" /> Interpretation
      </h2>
      <div className="space-y-2">
        {text.map((line, i) => (
          <p key={i} className="text-sm text-blue-900 leading-relaxed">{line}</p>
        ))}
      </div>
    </div>
  );
}

function generateInterpretation(type: AnalysisType, r: Record<string, unknown>): string[] {
  const alpha = 0.05;
  const sig = (p: number) => p < alpha;
  const pFmt = (p: number) => p < 0.001 ? '< 0.001' : `= ${p.toFixed(4)}`;
  const lines: string[] = [];

  switch (type) {
    case 'descriptive_statistics': {
      const summary = r.summary as Record<string, Record<string, number>> | undefined;
      if (!summary) break;
      const cols = Object.keys(summary);
      lines.push(`Descriptive statistics were computed for ${cols.length} variable(s): ${cols.join(', ')}.`);
      for (const col of cols) {
        const s = summary[col];
        const skewInterp = Math.abs(s.skewness) < 0.5 ? 'approximately symmetric' : s.skewness > 0 ? 'positively skewed (right-tailed)' : 'negatively skewed (left-tailed)';
        const kurtInterp = s.kurtosis > 1 ? 'leptokurtic (heavy tails)' : s.kurtosis < -1 ? 'platykurtic (light tails)' : 'mesokurtic (approximately normal)';
        lines.push(`${col}: M = ${s.mean.toFixed(2)}, SD = ${s.std?.toFixed(2) ?? 'N/A'}, Mdn = ${s.median.toFixed(2)}. The distribution is ${skewInterp} (skewness = ${s.skewness.toFixed(2)}) and ${kurtInterp} (kurtosis = ${s.kurtosis.toFixed(2)}).`);
      }
      break;
    }
    case 'frequency_table': {
      const table = r.table as Array<{ value: string; frequency: number; percentage: number }> | undefined;
      if (!table) break;
      lines.push(`The frequency analysis of "${r.column}" reveals ${r.unique_values} unique values across ${r.total} observations.`);
      if (table.length > 0) {
        lines.push(`The most frequent value is "${table[0].value}" (n = ${table[0].frequency}, ${table[0].percentage}%).`);
      }
      break;
    }
    case 'independent_t_test': {
      const p = r.p_value as number;
      const t = r.t_statistic as number;
      const d = r.cohens_d as number;
      const gs = r.group_stats as Record<string, { mean: number; std: number; n: number }>;
      const groups = Object.keys(gs);
      const effectSize = Math.abs(d) < 0.2 ? 'negligible' : Math.abs(d) < 0.5 ? 'small' : Math.abs(d) < 0.8 ? 'medium' : 'large';
      lines.push(`An independent samples t-test was conducted to compare ${groups.join(' and ')}.`);
      lines.push(`There was ${sig(p) ? 'a statistically significant' : 'no statistically significant'} difference between the groups, t(${r.degrees_of_freedom}) = ${t.toFixed(3)}, p ${pFmt(p)}.`);
      lines.push(`${groups[0]} (M = ${gs[groups[0]].mean.toFixed(2)}, SD = ${gs[groups[0]].std.toFixed(2)}) ${sig(p) ? 'significantly differed from' : 'did not significantly differ from'} ${groups[1]} (M = ${gs[groups[1]].mean.toFixed(2)}, SD = ${gs[groups[1]].std.toFixed(2)}).`);
      lines.push(`The effect size was ${effectSize} (Cohen's d = ${d.toFixed(3)}).`);
      break;
    }
    case 'paired_t_test': {
      const p = r.p_value as number;
      const t = r.t_statistic as number;
      const d = r.cohens_d as number;
      const effectSize = Math.abs(d) < 0.2 ? 'negligible' : Math.abs(d) < 0.5 ? 'small' : Math.abs(d) < 0.8 ? 'medium' : 'large';
      lines.push(`A paired samples t-test was conducted with ${r.n_pairs} pairs.`);
      lines.push(`There was ${sig(p) ? 'a statistically significant' : 'no statistically significant'} difference, t(${r.degrees_of_freedom}) = ${t.toFixed(3)}, p ${pFmt(p)}, with a mean difference of ${(r.mean_difference as number).toFixed(3)}.`);
      lines.push(`The effect size was ${effectSize} (Cohen's d = ${d.toFixed(3)}).`);
      break;
    }
    case 'one_sample_t_test': {
      const p = r.p_value as number;
      const t = r.t_statistic as number;
      lines.push(`A one-sample t-test compared the sample mean (${(r.sample_mean as number).toFixed(2)}) against the population mean of ${r.population_mean}.`);
      lines.push(`The difference was ${sig(p) ? 'statistically significant' : 'not statistically significant'}, t(${r.degrees_of_freedom}) = ${t.toFixed(3)}, p ${pFmt(p)}.`);
      break;
    }
    case 'z_test': {
      const p = r.p_value as number;
      const z = r.z_statistic as number;
      lines.push(`A z-test compared the sample mean (${(r.sample_mean as number).toFixed(2)}) against the population mean of ${r.population_mean} with known population SD = ${r.population_std}.`);
      lines.push(`The result was ${sig(p) ? 'statistically significant' : 'not statistically significant'}, z = ${z.toFixed(3)}, p ${pFmt(p)}.`);
      break;
    }
    case 'chi_square_test': {
      const p = r.p_value as number;
      const chi2 = r.chi_square as number;
      const v = r.cramers_v as number;
      const effectSize = v < 0.1 ? 'negligible' : v < 0.3 ? 'small' : v < 0.5 ? 'medium' : 'large';
      lines.push(`A chi-square test of independence was performed.`);
      lines.push(`The association was ${sig(p) ? 'statistically significant' : 'not statistically significant'}, \u03C7\u00B2(${r.degrees_of_freedom}) = ${chi2.toFixed(3)}, p ${pFmt(p)}.`);
      lines.push(`The effect size was ${effectSize} (Cramer's V = ${v.toFixed(3)}).`);
      break;
    }
    case 'one_way_anova': {
      const p = r.p_value as number;
      const f = r.f_statistic as number;
      const eta = r.eta_squared as number;
      const effectSize = eta < 0.01 ? 'negligible' : eta < 0.06 ? 'small' : eta < 0.14 ? 'medium' : 'large';
      lines.push(`A one-way ANOVA was conducted.`);
      lines.push(`There was ${sig(p) ? 'a statistically significant' : 'no statistically significant'} effect, F(${r.df_between}, ${r.df_within}) = ${f.toFixed(3)}, p ${pFmt(p)}.`);
      lines.push(`The effect size was ${effectSize} (\u03B7\u00B2 = ${eta.toFixed(3)}).`);
      if (sig(p)) lines.push(`Post-hoc tests are recommended to determine which groups differ significantly.`);
      break;
    }
    case 'linear_regression':
    case 'multiple_linear_regression': {
      const r2 = r.r_squared as number;
      const adjR2 = r.adj_r_squared as number;
      const fp = r.f_p_value as number;
      const coefs = r.coefficients as Record<string, { coefficient: number; p_value: number }>;
      const sigPredictors = Object.entries(coefs).filter(([k, v]) => k !== 'const' && v.p_value < alpha);
      lines.push(`A ${type === 'multiple_linear_regression' ? 'multiple' : ''} linear regression analysis was conducted.`);
      lines.push(`The model ${sig(fp) ? 'was statistically significant' : 'was not statistically significant'}, F = ${(r.f_statistic as number).toFixed(3)}, p ${pFmt(fp)}.`);
      lines.push(`The model explained ${(r2 * 100).toFixed(1)}% of the variance (R\u00B2 = ${r2.toFixed(4)}, Adjusted R\u00B2 = ${adjR2.toFixed(4)}).`);
      if (sigPredictors.length > 0) {
        lines.push(`Significant predictors: ${sigPredictors.map(([k, v]) => `${k} (B = ${v.coefficient.toFixed(4)}, p ${pFmt(v.p_value)})`).join('; ')}.`);
      } else {
        lines.push(`No individual predictors reached statistical significance at \u03B1 = ${alpha}.`);
      }
      if (r.vif) {
        const vif = r.vif as Record<string, number>;
        const highVif = Object.entries(vif).filter(([, v]) => v > 5);
        if (highVif.length > 0) {
          lines.push(`Warning: Multicollinearity detected. Variables with VIF > 5: ${highVif.map(([k, v]) => `${k} (VIF = ${v.toFixed(1)})`).join(', ')}.`);
        }
      }
      break;
    }
    case 'logistic_regression': {
      const coefs = r.coefficients as Record<string, { coefficient: number; odds_ratio: number; p_value: number }>;
      const sigPredictors = Object.entries(coefs).filter(([k, v]) => k !== 'const' && v.p_value < alpha);
      lines.push(`A logistic regression was performed (Pseudo R\u00B2 = ${(r.pseudo_r_squared as number).toFixed(4)}).`);
      if (sigPredictors.length > 0) {
        lines.push(`Significant predictors: ${sigPredictors.map(([k, v]) => `${k} (OR = ${v.odds_ratio.toFixed(3)}, p ${pFmt(v.p_value)})`).join('; ')}.`);
        for (const [k, v] of sigPredictors) {
          const direction = v.odds_ratio > 1 ? 'increases' : 'decreases';
          lines.push(`A one-unit increase in ${k} ${direction} the odds by a factor of ${v.odds_ratio.toFixed(3)}.`);
        }
      }
      break;
    }
    case 'normality_test': {
      const sw = r.shapiro_wilk as { p_value: number | null } | undefined;
      const ks = r.kolmogorov_smirnov as { p_value: number | null } | undefined;
      lines.push(`Normality was assessed for "${r.column}" (n = ${r.n}).`);
      if (sw?.p_value != null) {
        lines.push(`Shapiro-Wilk: W, p ${pFmt(sw.p_value)} \u2014 ${sig(sw.p_value) ? 'data significantly deviates from normality' : 'no significant departure from normality'}.`);
      }
      if (ks?.p_value != null) {
        lines.push(`Kolmogorov-Smirnov: p ${pFmt(ks.p_value)} \u2014 ${sig(ks.p_value) ? 'data significantly deviates from normality' : 'no significant departure from normality'}.`);
      }
      const skew = r.skewness as number;
      const kurt = r.kurtosis as number;
      lines.push(`Skewness = ${skew.toFixed(3)}, Kurtosis = ${kurt.toFixed(3)}.`);
      break;
    }
    case 'pearson_correlation': {
      const cm = r.correlation_matrix as Record<string, Record<string, number>>;
      const pm = r.p_value_matrix as Record<string, Record<string, number>>;
      if (!cm || !pm) break;
      const vars = Object.keys(cm);
      lines.push(`Pearson correlations were computed among ${vars.length} variables.`);
      for (let i = 0; i < vars.length; i++) {
        for (let j = i + 1; j < vars.length; j++) {
          const rVal = cm[vars[i]][vars[j]];
          const pVal = pm[vars[i]][vars[j]];
          const strength = Math.abs(rVal) < 0.1 ? 'negligible' : Math.abs(rVal) < 0.3 ? 'weak' : Math.abs(rVal) < 0.5 ? 'moderate' : Math.abs(rVal) < 0.7 ? 'strong' : 'very strong';
          const direction = rVal > 0 ? 'positive' : 'negative';
          lines.push(`${vars[i]} \u2194 ${vars[j]}: r = ${rVal.toFixed(3)}, p ${pFmt(pVal)} \u2014 ${strength} ${direction} correlation${sig(pVal) ? ' (significant)' : ''}.`);
        }
      }
      break;
    }
    case 'pca': {
      const variance = r.explained_variance_ratio as number[] | undefined;
      if (variance) {
        const cumVar = variance.reduce((s, v) => s + v, 0);
        lines.push(`PCA extracted ${variance.length} components explaining ${(cumVar * 100).toFixed(1)}% of total variance.`);
        variance.forEach((v, i) => {
          lines.push(`PC${i + 1}: ${(v * 100).toFixed(1)}% of variance.`);
        });
      }
      break;
    }
    case 'classification':
    case 'naive_bayes':
    case 'decision_tree':
    case 'gradient_boosting':
    case 'knn_classifier': {
      const testAcc = r.test_accuracy as number;
      const trainAcc = r.train_accuracy as number;
      const cvMean = r.cv_accuracy_mean as number;
      const cvStd = r.cv_accuracy_std as number;
      lines.push(`${r.test || type} was performed.`);
      lines.push(`Test accuracy: ${(testAcc * 100).toFixed(1)}%. Cross-validation accuracy: ${(cvMean * 100).toFixed(1)}% (\u00B1${(cvStd * 100).toFixed(1)}%).`);
      if (trainAcc - testAcc > 0.1) {
        lines.push(`Warning: The gap between training (${(trainAcc * 100).toFixed(1)}%) and test accuracy suggests possible overfitting.`);
      }
      const importance = r.feature_importance as Record<string, number> | undefined;
      if (importance) {
        const sorted = Object.entries(importance).sort((a, b) => b[1] - a[1]);
        lines.push(`Most important features: ${sorted.slice(0, 3).map(([k, v]) => `${k} (${(v * 100).toFixed(1)}%)`).join(', ')}.`);
      }
      break;
    }
    case 'arima':
    case 'sarima':
    case 'auto_arima': {
      lines.push(`${r.test || 'Time series model'} was fitted (AIC = ${(r.aic as number).toFixed(2)}, BIC = ${(r.bic as number).toFixed(2)}).`);
      lines.push(`Order: ${JSON.stringify(r.order)}${r.seasonal_order ? `, Seasonal order: ${JSON.stringify(r.seasonal_order)}` : ''}.`);
      const forecast = r.forecast as number[] | undefined;
      if (forecast) lines.push(`${forecast.length}-step forecast generated.`);
      break;
    }
    case 'arch':
    case 'garch':
    case 'egarch':
    case 'tgarch': {
      lines.push(`${r.test || type.toUpperCase()} volatility model was fitted (AIC = ${(r.aic as number).toFixed(2)}, BIC = ${(r.bic as number).toFixed(2)}).`);
      const params = r.parameters as Record<string, number> | undefined;
      const pvals = r.p_values as Record<string, number> | undefined;
      if (params && pvals) {
        const sigParams = Object.entries(pvals).filter(([, p]) => p < alpha);
        if (sigParams.length > 0) {
          lines.push(`Significant parameters: ${sigParams.map(([k]) => `${k} = ${params[k]?.toFixed(4)}`).join(', ')}.`);
        }
      }
      break;
    }
    case 'kaplan_meier': {
      const median = r.median_survival as number | undefined;
      lines.push(`Kaplan-Meier survival analysis was conducted (n = ${r.n_observations}).`);
      if (median != null) lines.push(`Median survival time: ${median.toFixed(2)}.`);
      const logRankP = r.log_rank_p_value as number | undefined;
      if (logRankP != null) {
        lines.push(`Log-rank test: p ${pFmt(logRankP)} \u2014 ${sig(logRankP) ? 'significant difference between groups' : 'no significant difference between groups'}.`);
      }
      break;
    }
    case 'mann_whitney': {
      const p = r.p_value as number;
      lines.push(`A Mann-Whitney U test was conducted.`);
      lines.push(`The result was ${sig(p) ? 'statistically significant' : 'not statistically significant'}, U = ${(r.u_statistic as number).toFixed(1)}, p ${pFmt(p)}.`);
      break;
    }
    case 'wilcoxon': {
      const p = r.p_value as number;
      lines.push(`A Wilcoxon signed-rank test was conducted.`);
      lines.push(`The result was ${sig(p) ? 'statistically significant' : 'not statistically significant'}, p ${pFmt(p)}.`);
      break;
    }
    case 'kruskal_wallis': {
      const p = r.p_value as number;
      lines.push(`A Kruskal-Wallis H test was conducted.`);
      lines.push(`The result was ${sig(p) ? 'statistically significant' : 'not statistically significant'}, H = ${(r.h_statistic as number).toFixed(3)}, p ${pFmt(p)}.`);
      if (sig(p)) lines.push(`Post-hoc pairwise comparisons (e.g., Dunn's test) are recommended.`);
      break;
    }
    default: {
      const test = r.test as string | undefined;
      if (test) lines.push(`${test} analysis completed successfully.`);
      break;
    }
  }

  return lines;
}

/* ── Key Metrics Cards ───────────────────────────────── */
function KeyMetrics({ analysisType, results }: { analysisType: AnalysisType; results: Record<string, unknown> }) {
  const metrics = extractKeyMetrics(analysisType, results);
  if (metrics.length === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((m, i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-xs font-medium text-gray-500 uppercase">{m.label}</p>
          <p className={`text-lg font-bold mt-1 ${m.color || 'text-gray-900'}`}>{m.value}</p>
          {m.sub && <p className="text-xs text-gray-400 mt-0.5">{m.sub}</p>}
        </div>
      ))}
    </div>
  );
}

interface Metric { label: string; value: string; color?: string; sub?: string }

function extractKeyMetrics(type: AnalysisType, r: Record<string, unknown>): Metric[] {
  const metrics: Metric[] = [];
  const fmtP = (p: number) => p < 0.001 ? '< .001' : p.toFixed(4);
  const sigColor = (p: number) => p < 0.05 ? 'text-green-600' : 'text-red-500';

  if (r.p_value != null) {
    const p = r.p_value as number;
    metrics.push({ label: 'P-value', value: fmtP(p), color: sigColor(p), sub: p < 0.05 ? 'Significant' : 'Not significant' });
  }
  if (r.r_squared != null) metrics.push({ label: 'R\u00B2', value: (r.r_squared as number).toFixed(4) });
  if (r.adj_r_squared != null) metrics.push({ label: 'Adj. R\u00B2', value: (r.adj_r_squared as number).toFixed(4) });
  if (r.f_statistic != null) metrics.push({ label: 'F-statistic', value: (r.f_statistic as number).toFixed(3) });
  if (r.t_statistic != null) metrics.push({ label: 't-statistic', value: (r.t_statistic as number).toFixed(3) });
  if (r.chi_square != null) metrics.push({ label: '\u03C7\u00B2', value: (r.chi_square as number).toFixed(3) });
  if (r.cohens_d != null) metrics.push({ label: "Cohen's d", value: (r.cohens_d as number).toFixed(3) });
  if (r.eta_squared != null) metrics.push({ label: '\u03B7\u00B2', value: (r.eta_squared as number).toFixed(3) });
  if (r.cramers_v != null) metrics.push({ label: "Cramer's V", value: (r.cramers_v as number).toFixed(3) });
  if (r.test_accuracy != null) metrics.push({ label: 'Test Accuracy', value: `${((r.test_accuracy as number) * 100).toFixed(1)}%` });
  if (r.cv_accuracy_mean != null) metrics.push({ label: 'CV Accuracy', value: `${((r.cv_accuracy_mean as number) * 100).toFixed(1)}%` });
  if (r.silhouette_score != null) metrics.push({ label: 'Silhouette', value: (r.silhouette_score as number).toFixed(3) });
  if (r.aic != null) metrics.push({ label: 'AIC', value: (r.aic as number).toFixed(2) });
  if (r.bic != null) metrics.push({ label: 'BIC', value: (r.bic as number).toFixed(2) });
  if (r.n_observations != null) metrics.push({ label: 'N', value: String(r.n_observations) });

  return metrics.slice(0, 8);
}

/* ── Results Display ───────────────────────────────── */
function ResultsDisplay({ results }: { results: Record<string, unknown> }) {
  const fmtVal = (v: unknown): string => {
    if (v === null || v === undefined) return '-';
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(4);
    if (typeof v === 'boolean') return v ? 'Yes' : 'No';
    return String(v);
  };

  const fmtKey = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const renderValue = (key: string, value: unknown): React.ReactNode => {
    if (value === null || value === undefined) return <span className="text-gray-400">-</span>;

    // Array of objects → full table
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
      const cols = Object.keys(value[0] as object);
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                {cols.map((c) => <th key={c} className="px-3 py-2 text-left font-medium text-gray-600 border-b">{fmtKey(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {value.map((row, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                  {cols.map((c) => <td key={c} className="px-3 py-2">{fmtVal((row as Record<string, unknown>)[c])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // Simple array
    if (Array.isArray(value)) {
      if (value.length === 0) return <span className="text-gray-400">[]</span>;
      if (value.length <= 20) return <span className="text-gray-700 text-sm">{value.map(fmtVal).join(', ')}</span>;
      return <span className="text-gray-700 text-sm">{value.slice(0, 10).map(fmtVal).join(', ')} ... ({value.length} items)</span>;
    }

    // Nested object with nested children → collapsible sections
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const isFlat = Object.values(obj).every((v) => typeof v !== 'object' || v === null);

      if (isFlat) {
        return (
          <table className="w-full text-sm border rounded overflow-hidden">
            <tbody>
              {Object.entries(obj).map(([k, v]) => (
                <tr key={k} className="border-b last:border-0">
                  <td className="px-3 py-2 font-medium text-gray-600 bg-gray-50 w-1/3">{fmtKey(k)}</td>
                  <td className="px-3 py-2">{fmtVal(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        );
      }

      // Check if it's a "table-like" nested object (e.g., coefficients)
      const firstChild = Object.values(obj)[0];
      if (firstChild && typeof firstChild === 'object' && !Array.isArray(firstChild)) {
        const subObj = firstChild as Record<string, unknown>;
        const isTableLike = Object.values(subObj).every((v) => typeof v !== 'object' || v === null);
        if (isTableLike) {
          const rows = Object.keys(obj);
          const cols = Object.keys(subObj);
          return (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-3 py-2 text-left font-medium text-gray-600 border-b"></th>
                    {cols.map((c) => <th key={c} className="px-3 py-2 text-left font-medium text-gray-600 border-b">{fmtKey(c)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-600 bg-gray-50">{row}</td>
                      {cols.map((c) => <td key={c} className="px-3 py-2">{fmtVal((obj[row] as Record<string, unknown>)[c])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      }

      return (
        <div className="space-y-3 pl-4 border-l-2 border-gray-200">
          {Object.entries(obj).map(([k, v]) => (
            <div key={k}>
              <h4 className="text-sm font-medium text-gray-600 mb-1">{fmtKey(k)}</h4>
              {renderValue(k, v)}
            </div>
          ))}
        </div>
      );
    }

    return <span className="text-gray-700">{fmtVal(value)}</span>;
  };

  const topLevel: Record<string, unknown> = {};
  const nested: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(results)) {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      nested[k] = v;
    } else {
      topLevel[k] = v;
    }
  }

  return (
    <div className="space-y-6">
      {Object.keys(topLevel).length > 0 && (
        <table className="w-full text-sm border rounded overflow-hidden">
          <tbody>
            {Object.entries(topLevel).map(([k, v]) => (
              <tr key={k} className="border-b last:border-0">
                <td className="px-4 py-2.5 font-medium text-gray-600 bg-gray-50 w-1/3">{fmtKey(k)}</td>
                <td className="px-4 py-2.5">{renderValue(k, v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {Object.entries(nested).map(([k, v]) => (
        <div key={k}>
          <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase">{fmtKey(k)}</h3>
          {renderValue(k, v)}
        </div>
      ))}
    </div>
  );
}
