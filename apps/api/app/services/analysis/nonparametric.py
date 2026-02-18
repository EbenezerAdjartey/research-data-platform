import numpy as np
from scipy import stats
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("mann_whitney")
class MannWhitneyTest(AnalysisEngine):
    def validate(self):
        for key in ("group_column", "value_column"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        group_col = self.parameters["group_column"]
        value_col = self.parameters["value_column"]
        groups = self.df.groupby(group_col)[value_col].apply(lambda x: x.dropna().values)

        if len(groups) != 2:
            raise ValueError("Mann-Whitney U test requires exactly 2 groups")

        g1, g2 = list(groups.values)
        stat, p_value = stats.mannwhitneyu(g1, g2, alternative=self.parameters.get("alternative", "two-sided"))
        n1, n2 = len(g1), len(g2)
        r = 1 - (2 * stat) / (n1 * n2)

        return {
            "test": "Mann-Whitney U Test",
            "u_statistic": float(stat),
            "p_value": float(p_value),
            "rank_biserial_r": float(r),
            "n1": n1, "n2": n2,
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("wilcoxon")
class WilcoxonTest(AnalysisEngine):
    def validate(self):
        for key in ("column1", "column2"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        c1 = self.df[self.parameters["column1"]].dropna()
        c2 = self.df[self.parameters["column2"]].dropna()
        idx = c1.index.intersection(c2.index)
        c1, c2 = c1[idx].values, c2[idx].values
        stat, p_value = stats.wilcoxon(c1, c2)

        return {
            "test": "Wilcoxon Signed-Rank Test",
            "w_statistic": float(stat),
            "p_value": float(p_value),
            "n_pairs": int(len(c1)),
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("kruskal_wallis")
class KruskalWallisTest(AnalysisEngine):
    def validate(self):
        for key in ("group_column", "value_column"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        group_col = self.parameters["group_column"]
        value_col = self.parameters["value_column"]
        groups = [g.dropna().values for _, g in self.df.groupby(group_col)[value_col]]
        stat, p_value = stats.kruskal(*groups)
        n = sum(len(g) for g in groups)
        eta_squared_h = float((stat - len(groups) + 1) / (n - len(groups)))

        return {
            "test": "Kruskal-Wallis H Test",
            "h_statistic": float(stat),
            "p_value": float(p_value),
            "eta_squared_h": eta_squared_h,
            "n_groups": len(groups),
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("friedman")
class FriedmanTest(AnalysisEngine):
    def validate(self):
        if "columns" not in self.parameters:
            raise ValueError("Parameter 'columns' is required (list of repeated measures columns)")
        if len(self.parameters["columns"]) < 3:
            raise ValueError("Friedman test requires at least 3 groups")

    def execute(self):
        columns = self.parameters["columns"]
        data = self.df[columns].dropna()
        arrays = [data[c].values for c in columns]
        stat, p_value = stats.friedmanchisquare(*arrays)

        return {
            "test": "Friedman Test",
            "chi_square": float(stat),
            "p_value": float(p_value),
            "n": int(len(data)),
            "k_groups": len(columns),
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }


@register_engine("spearman_correlation")
class SpearmanCorrelation(AnalysisEngine):
    def validate(self):
        for key in ("column1", "column2"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        data = self.df[[self.parameters["column1"], self.parameters["column2"]]].dropna()
        rho, p_value = stats.spearmanr(data.iloc[:, 0], data.iloc[:, 1])

        return {
            "test": "Spearman Rank Correlation",
            "rho": float(rho),
            "p_value": float(p_value),
            "n": int(len(data)),
            "significant": bool(p_value < self.parameters.get("alpha", 0.05)),
        }
