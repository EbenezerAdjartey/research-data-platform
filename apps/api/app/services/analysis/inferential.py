import numpy as np
from scipy import stats
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("independent_t_test")
class IndependentTTest(AnalysisEngine):
    def validate(self):
        for key in ("group_column", "value_column"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        group_col = self.parameters["group_column"]
        value_col = self.parameters["value_column"]
        groups = self.df.groupby(group_col)[value_col].apply(lambda x: x.dropna().values)

        if len(groups) != 2:
            raise ValueError("Independent t-test requires exactly 2 groups")

        g1, g2 = list(groups.values)
        stat, p_value = stats.ttest_ind(g1, g2, equal_var=self.parameters.get("equal_var", True))
        cohens_d = (np.mean(g1) - np.mean(g2)) / np.sqrt(
            ((len(g1) - 1) * np.var(g1, ddof=1) + (len(g2) - 1) * np.var(g2, ddof=1))
            / (len(g1) + len(g2) - 2)
        )

        group_names = list(groups.index)
        return {
            "test": "Independent Samples t-test",
            "t_statistic": float(stat),
            "p_value": float(p_value),
            "degrees_of_freedom": int(len(g1) + len(g2) - 2),
            "cohens_d": float(cohens_d),
            "group_stats": {
                str(group_names[0]): {"mean": float(np.mean(g1)), "std": float(np.std(g1, ddof=1)), "n": int(len(g1))},
                str(group_names[1]): {"mean": float(np.mean(g2)), "std": float(np.std(g2, ddof=1)), "n": int(len(g2))},
            },
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("paired_t_test")
class PairedTTest(AnalysisEngine):
    def validate(self):
        for key in ("column1", "column2"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        c1 = self.df[self.parameters["column1"]].dropna()
        c2 = self.df[self.parameters["column2"]].dropna()
        idx = c1.index.intersection(c2.index)
        c1, c2 = c1[idx].values, c2[idx].values
        stat, p_value = stats.ttest_rel(c1, c2)
        diff = c1 - c2
        cohens_d = float(np.mean(diff) / np.std(diff, ddof=1))

        return {
            "test": "Paired Samples t-test",
            "t_statistic": float(stat),
            "p_value": float(p_value),
            "degrees_of_freedom": int(len(c1) - 1),
            "cohens_d": cohens_d,
            "n_pairs": int(len(c1)),
            "mean_difference": float(np.mean(diff)),
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("one_sample_t_test")
class OneSampleTTest(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")
        if "population_mean" not in self.parameters:
            raise ValueError("Parameter 'population_mean' is required")

    def execute(self):
        values = self.df[self.parameters["column"]].dropna().values
        pop_mean = self.parameters["population_mean"]
        stat, p_value = stats.ttest_1samp(values, pop_mean)

        return {
            "test": "One-sample t-test",
            "t_statistic": float(stat),
            "p_value": float(p_value),
            "degrees_of_freedom": int(len(values) - 1),
            "sample_mean": float(np.mean(values)),
            "population_mean": float(pop_mean),
            "n": int(len(values)),
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("chi_square_test")
class ChiSquareTest(AnalysisEngine):
    def validate(self):
        for key in ("column1", "column2"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        ct = self.df.groupby([self.parameters["column1"], self.parameters["column2"]]).size().unstack(fill_value=0)
        chi2, p_value, dof, expected = stats.chi2_contingency(ct.values)
        n = ct.values.sum()
        k = min(ct.shape)
        cramers_v = float(np.sqrt(chi2 / (n * (k - 1)))) if k > 1 else 0.0

        return {
            "test": "Chi-square Test of Independence",
            "chi_square": float(chi2),
            "p_value": float(p_value),
            "degrees_of_freedom": int(dof),
            "cramers_v": cramers_v,
            "contingency_table": ct.to_dict(),
            "expected_frequencies": {str(k): dict(v) for k, v in zip(ct.index, expected.tolist())},
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("one_way_anova")
class OneWayANOVA(AnalysisEngine):
    def validate(self):
        for key in ("group_column", "value_column"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        group_col = self.parameters["group_column"]
        value_col = self.parameters["value_column"]
        groups = [g.dropna().values for _, g in self.df.groupby(group_col)[value_col]]

        if len(groups) < 2:
            raise ValueError("ANOVA requires at least 2 groups")

        f_stat, p_value = stats.f_oneway(*groups)
        grand_mean = np.mean(np.concatenate(groups))
        n_total = sum(len(g) for g in groups)
        ss_between = sum(len(g) * (np.mean(g) - grand_mean) ** 2 for g in groups)
        ss_total = sum(np.sum((g - grand_mean) ** 2) for g in groups)
        eta_squared = float(ss_between / ss_total) if ss_total > 0 else 0.0

        group_names = self.df[group_col].unique()
        group_stats = {}
        for name, g in zip(group_names, groups):
            group_stats[str(name)] = {
                "mean": float(np.mean(g)),
                "std": float(np.std(g, ddof=1)),
                "n": int(len(g)),
            }

        return {
            "test": "One-way ANOVA",
            "f_statistic": float(f_stat),
            "p_value": float(p_value),
            "df_between": int(len(groups) - 1),
            "df_within": int(n_total - len(groups)),
            "eta_squared": eta_squared,
            "group_stats": group_stats,
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("z_test")
class ZTest(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")
        if "population_mean" not in self.parameters:
            raise ValueError("Parameter 'population_mean' is required")
        if "population_std" not in self.parameters:
            raise ValueError("Parameter 'population_std' is required")

    def execute(self):
        values = self.df[self.parameters["column"]].dropna().values
        pop_mean = self.parameters["population_mean"]
        pop_std = self.parameters["population_std"]
        n = len(values)
        sample_mean = float(np.mean(values))
        z_stat = (sample_mean - pop_mean) / (pop_std / np.sqrt(n))
        p_value = float(2 * (1 - stats.norm.cdf(abs(z_stat))))

        return {
            "test": "Z-test",
            "z_statistic": float(z_stat),
            "p_value": p_value,
            "sample_mean": sample_mean,
            "population_mean": float(pop_mean),
            "population_std": float(pop_std),
            "n": n,
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("pearson_correlation")
class PearsonCorrelation(AnalysisEngine):
    def validate(self):
        if "columns" not in self.parameters:
            raise ValueError("Parameter 'columns' is required (list of column names)")

    def execute(self):
        columns = self.parameters["columns"]
        if isinstance(columns, str):
            columns = [columns]
        data = self.df[columns].dropna()
        corr_matrix = data.corr(method="pearson")
        p_matrix = {}
        for i, c1 in enumerate(columns):
            p_matrix[c1] = {}
            for j, c2 in enumerate(columns):
                if i == j:
                    p_matrix[c1][c2] = 0.0
                else:
                    r, p = stats.pearsonr(data[c1], data[c2])
                    p_matrix[c1][c2] = float(p)

        return {
            "test": "Pearson Correlation",
            "correlation_matrix": corr_matrix.to_dict(),
            "p_value_matrix": p_matrix,
            "n_observations": int(len(data)),
        }


@register_engine("normality_test")
class NormalityTest(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        values = self.df[self.parameters["column"]].dropna().values

        # Shapiro-Wilk
        if len(values) <= 5000:
            sw_stat, sw_p = stats.shapiro(values)
        else:
            sw_stat, sw_p = None, None

        # Kolmogorov-Smirnov
        ks_stat, ks_p = stats.kstest(values, "norm", args=(np.mean(values), np.std(values, ddof=1)))

        # D'Agostino-Pearson
        if len(values) >= 20:
            dp_stat, dp_p = stats.normaltest(values)
        else:
            dp_stat, dp_p = None, None

        # Anderson-Darling
        ad_result = stats.anderson(values, dist="norm")

        return {
            "test": "Normality Tests",
            "column": self.parameters["column"],
            "n": int(len(values)),
            "skewness": float(stats.skew(values)),
            "kurtosis": float(stats.kurtosis(values)),
            "shapiro_wilk": {"statistic": float(sw_stat) if sw_stat else None, "p_value": float(sw_p) if sw_p else None},
            "kolmogorov_smirnov": {"statistic": float(ks_stat), "p_value": float(ks_p)},
            "dagostino_pearson": {"statistic": float(dp_stat) if dp_stat else None, "p_value": float(dp_p) if dp_p else None},
            "anderson_darling": {"statistic": float(ad_result.statistic), "critical_values": dict(zip([str(s) for s in ad_result.significance_level], [float(c) for c in ad_result.critical_values]))},
        }


@register_engine("manova")
class MANOVA(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required (list of columns)")
        if "group_column" not in self.parameters:
            raise ValueError("Parameter 'group_column' is required")

    def execute(self):
        from statsmodels.multivariate.manova import MANOVA as StatsMANOVA

        dep_cols = self.parameters["dependent"]
        if isinstance(dep_cols, str):
            dep_cols = [dep_cols]
        group = self.parameters["group_column"]

        data = self.df[dep_cols + [group]].dropna()
        dep_str = " + ".join([f"Q('{c}')" for c in dep_cols])
        formula = f"{dep_str} ~ C(Q('{group}'))"
        manova = StatsMANOVA.from_formula(formula, data)
        result = manova.mv_test()

        tests = {}
        for key in result.results:
            table = result.results[key]["stat"]
            tests[str(key)] = table.to_dict()

        return {
            "test": "MANOVA",
            "dependent_variables": dep_cols,
            "group_variable": group,
            "results": tests,
            "n_observations": int(len(data)),
        }


@register_engine("ancova")
class ANCOVA(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "group_column" not in self.parameters:
            raise ValueError("Parameter 'group_column' is required")
        if "covariate" not in self.parameters:
            raise ValueError("Parameter 'covariate' is required")

    def execute(self):
        import statsmodels.api as sm
        from statsmodels.formula.api import ols

        dep = self.parameters["dependent"]
        group = self.parameters["group_column"]
        covariate = self.parameters["covariate"]

        data = self.df[[dep, group, covariate]].dropna()
        formula = f"Q('{dep}') ~ C(Q('{group}')) + Q('{covariate}')"
        model = ols(formula, data=data).fit()
        anova_table = sm.stats.anova_lm(model, typ=2)

        results = {}
        for source in anova_table.index:
            results[str(source)] = {
                "sum_sq": float(anova_table.loc[source, "sum_sq"]),
                "df": float(anova_table.loc[source, "df"]),
                "F": float(anova_table.loc[source, "F"]) if not np.isnan(anova_table.loc[source, "F"]) else None,
                "p_value": float(anova_table.loc[source, "PR(>F)"]) if not np.isnan(anova_table.loc[source, "PR(>F)"]) else None,
            }

        return {
            "test": "ANCOVA",
            "anova_table": results,
            "r_squared": float(model.rsquared),
            "adj_r_squared": float(model.rsquared_adj),
            "n_observations": int(model.nobs),
        }


@register_engine("two_way_anova")
class TwoWayANOVA(AnalysisEngine):
    def validate(self):
        for key in ("factor1", "factor2", "dependent"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        import statsmodels.api as sm
        from statsmodels.formula.api import ols

        f1 = self.parameters["factor1"]
        f2 = self.parameters["factor2"]
        dep = self.parameters["dependent"]

        formula = f"Q('{dep}') ~ C(Q('{f1}')) * C(Q('{f2}'))"
        model = ols(formula, data=self.df.dropna(subset=[f1, f2, dep])).fit()
        anova_table = sm.stats.anova_lm(model, typ=2)

        results = {}
        for source in anova_table.index:
            results[str(source)] = {
                "sum_sq": float(anova_table.loc[source, "sum_sq"]),
                "df": float(anova_table.loc[source, "df"]),
                "F": float(anova_table.loc[source, "F"]) if not np.isnan(anova_table.loc[source, "F"]) else None,
                "p_value": float(anova_table.loc[source, "PR(>F)"]) if not np.isnan(anova_table.loc[source, "PR(>F)"]) else None,
            }

        return {"test": "Two-way ANOVA", "anova_table": results, "r_squared": float(model.rsquared)}
