# Bayesian analysis module - requires PyMC which needs special setup
# Placeholder that gracefully handles missing dependencies
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("bayesian_regression")
class BayesianRegression(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "independent" not in self.parameters:
            raise ValueError("Parameter 'independent' is required")

    def execute(self):
        try:
            import pymc as pm
            import arviz as az
        except ImportError:
            raise RuntimeError("PyMC is not installed. Install with: pip install pymc bambi")

        dep = self.parameters["dependent"]
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]
        draws = self.parameters.get("draws", 1000)
        tune = self.parameters.get("tune", 1000)

        data = self.df[indep + [dep]].dropna()

        with pm.Model():
            # Priors
            intercept = pm.Normal("intercept", mu=0, sigma=10)
            betas = {}
            for col in indep:
                betas[col] = pm.Normal(f"beta_{col}", mu=0, sigma=10)
            sigma = pm.HalfNormal("sigma", sigma=1)

            # Linear model
            mu = intercept
            for col in indep:
                mu = mu + betas[col] * data[col].values

            # Likelihood
            pm.Normal("y", mu=mu, sigma=sigma, observed=data[dep].values)

            # Inference
            trace = pm.sample(draws=draws, tune=tune, cores=1, return_inferencedata=True, progressbar=False)

        summary = az.summary(trace)

        coefficients = {}
        for var_name in ["intercept"] + [f"beta_{c}" for c in indep]:
            if var_name in summary.index:
                row = summary.loc[var_name]
                coefficients[var_name] = {
                    "mean": float(row["mean"]),
                    "sd": float(row["sd"]),
                    "hdi_3%": float(row["hdi_3%"]),
                    "hdi_97%": float(row["hdi_97%"]),
                    "r_hat": float(row["r_hat"]),
                }

        return {
            "test": "Bayesian Regression",
            "coefficients": coefficients,
            "draws": draws,
            "tune": tune,
            "n_observations": int(len(data)),
        }
