import numpy as np
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("kaplan_meier")
class KaplanMeier(AnalysisEngine):
    def validate(self):
        for key in ("duration_column", "event_column"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        from lifelines import KaplanMeierFitter

        dur = self.parameters["duration_column"]
        event = self.parameters["event_column"]
        group_col = self.parameters.get("group_column")
        data = self.df[[dur, event] + ([group_col] if group_col else [])].dropna()

        results = {"test": "Kaplan-Meier Survival Analysis"}

        if group_col:
            groups = data[group_col].unique()
            curves = {}
            for g in groups:
                mask = data[group_col] == g
                kmf = KaplanMeierFitter()
                kmf.fit(data.loc[mask, dur], data.loc[mask, event])
                curves[str(g)] = {
                    "timeline": [float(t) for t in kmf.timeline],
                    "survival_function": [float(s) for s in kmf.survival_function_.iloc[:, 0]],
                    "median_survival": float(kmf.median_survival_time_) if not np.isinf(kmf.median_survival_time_) else None,
                    "n": int(mask.sum()),
                }
            results["curves"] = curves

            from lifelines.statistics import logrank_test
            g1, g2 = groups[0], groups[1]
            lr = logrank_test(
                data.loc[data[group_col] == g1, dur], data.loc[data[group_col] == g2, dur],
                data.loc[data[group_col] == g1, event], data.loc[data[group_col] == g2, event],
            )
            results["log_rank_test"] = {
                "test_statistic": float(lr.test_statistic),
                "p_value": float(lr.p_value),
            }
        else:
            kmf = KaplanMeierFitter()
            kmf.fit(data[dur], data[event])
            results["timeline"] = [float(t) for t in kmf.timeline]
            results["survival_function"] = [float(s) for s in kmf.survival_function_.iloc[:, 0]]
            results["median_survival"] = float(kmf.median_survival_time_) if not np.isinf(kmf.median_survival_time_) else None

        results["n_observations"] = int(len(data))
        return results


@register_engine("cox_regression")
class CoxRegression(AnalysisEngine):
    def validate(self):
        for key in ("duration_column", "event_column", "covariates"):
            if key not in self.parameters:
                raise ValueError(f"Parameter '{key}' is required")

    def execute(self):
        from lifelines import CoxPHFitter

        dur = self.parameters["duration_column"]
        event = self.parameters["event_column"]
        covariates = self.parameters["covariates"]
        cols = [dur, event] + covariates
        data = self.df[cols].dropna()

        cph = CoxPHFitter()
        cph.fit(data, duration_col=dur, event_col=event)

        coefficients = {}
        for cov in covariates:
            coefficients[cov] = {
                "coef": float(cph.params_[cov]),
                "hazard_ratio": float(np.exp(cph.params_[cov])),
                "se": float(cph.standard_errors_[cov]),
                "z": float(cph.summary.loc[cov, "z"]),
                "p_value": float(cph.summary.loc[cov, "p"]),
            }

        return {
            "test": "Cox Proportional Hazards Regression",
            "coefficients": coefficients,
            "concordance_index": float(cph.concordance_index_),
            "log_likelihood": float(cph.log_likelihood_),
            "aic": float(cph.AIC_partial_),
            "n_observations": int(len(data)),
        }
