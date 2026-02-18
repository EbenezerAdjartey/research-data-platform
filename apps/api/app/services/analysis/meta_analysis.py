import numpy as np
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("meta_analysis")
class MetaAnalysis(AnalysisEngine):
    def validate(self):
        for key in ("effect_size_column", "variance_column"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        es_col = self.parameters["effect_size_column"]
        var_col = self.parameters["variance_column"]
        study_col = self.parameters.get("study_column")
        model = self.parameters.get("model", "random")

        data = self.df[[es_col, var_col] + ([study_col] if study_col else [])].dropna()
        effect_sizes = data[es_col].values
        variances = data[var_col].values
        weights_fixed = 1.0 / variances

        # Fixed effects
        pooled_fixed = float(np.sum(weights_fixed * effect_sizes) / np.sum(weights_fixed))
        se_fixed = float(np.sqrt(1.0 / np.sum(weights_fixed)))

        # Q statistic for heterogeneity
        q = float(np.sum(weights_fixed * (effect_sizes - pooled_fixed) ** 2))
        k = len(effect_sizes)
        df = k - 1
        from scipy.stats import chi2
        q_p_value = float(1 - chi2.cdf(q, df)) if df > 0 else 1.0

        # I-squared
        i_squared = float(max(0, (q - df) / q * 100)) if q > 0 else 0.0

        # Random effects (DerSimonian-Laird)
        c = np.sum(weights_fixed) - np.sum(weights_fixed ** 2) / np.sum(weights_fixed)
        tau_squared = max(0, (q - df) / c) if c > 0 else 0.0
        weights_random = 1.0 / (variances + tau_squared)
        pooled_random = float(np.sum(weights_random * effect_sizes) / np.sum(weights_random))
        se_random = float(np.sqrt(1.0 / np.sum(weights_random)))

        result = {
            "test": "Meta-Analysis",
            "model": model,
            "k_studies": k,
            "fixed_effects": {
                "pooled_effect": pooled_fixed,
                "se": se_fixed,
                "ci_lower": pooled_fixed - 1.96 * se_fixed,
                "ci_upper": pooled_fixed + 1.96 * se_fixed,
            },
            "random_effects": {
                "pooled_effect": pooled_random,
                "se": se_random,
                "ci_lower": pooled_random - 1.96 * se_random,
                "ci_upper": pooled_random + 1.96 * se_random,
                "tau_squared": float(tau_squared),
            },
            "heterogeneity": {
                "q": q,
                "q_p_value": q_p_value,
                "i_squared": i_squared,
                "df": df,
            },
        }

        if study_col:
            result["studies"] = []
            for i, row in data.iterrows():
                result["studies"].append({
                    "name": str(row[study_col]),
                    "effect_size": float(row[es_col]),
                    "variance": float(row[var_col]),
                    "weight_fixed": float(1.0 / row[var_col]),
                    "weight_random": float(1.0 / (row[var_col] + tau_squared)),
                })

        return result
