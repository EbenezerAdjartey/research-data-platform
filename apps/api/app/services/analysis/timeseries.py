import numpy as np
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("arima")
class ARIMAAnalysis(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        from statsmodels.tsa.arima.model import ARIMA

        col = self.parameters["column"]
        order = tuple(self.parameters.get("order", [1, 1, 1]))
        forecast_steps = self.parameters.get("forecast_steps", 10)

        series = self.df[col].dropna().values
        model = ARIMA(series, order=order)
        fitted = model.fit()
        forecast = fitted.forecast(steps=forecast_steps)

        return {
            "test": "ARIMA",
            "order": list(order),
            "aic": float(fitted.aic),
            "bic": float(fitted.bic),
            "coefficients": {k: float(v) for k, v in fitted.params.items()},
            "residual_std": float(np.std(fitted.resid)),
            "forecast": [float(v) for v in forecast],
            "n_observations": int(len(series)),
        }


@register_engine("sarima")
class SARIMAAnalysis(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        from statsmodels.tsa.statespace.sarimax import SARIMAX

        col = self.parameters["column"]
        order = tuple(self.parameters.get("order", [1, 1, 1]))
        seasonal_order = tuple(self.parameters.get("seasonal_order", [1, 1, 1, 12]))
        forecast_steps = self.parameters.get("forecast_steps", 10)

        series = self.df[col].dropna().values
        model = SARIMAX(series, order=order, seasonal_order=seasonal_order)
        fitted = model.fit(disp=False)
        forecast = fitted.forecast(steps=forecast_steps)

        return {
            "test": "SARIMA",
            "order": list(order),
            "seasonal_order": list(seasonal_order),
            "aic": float(fitted.aic),
            "bic": float(fitted.bic),
            "forecast": [float(v) for v in forecast],
            "n_observations": int(len(series)),
        }


@register_engine("auto_arima")
class AutoARIMA(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        import pmdarima as pm

        col = self.parameters["column"]
        seasonal = self.parameters.get("seasonal", False)
        m = self.parameters.get("seasonal_period", 1)
        forecast_steps = self.parameters.get("forecast_steps", 10)

        series = self.df[col].dropna().values
        model = pm.auto_arima(series, seasonal=seasonal, m=m, suppress_warnings=True, stepwise=True)
        forecast = model.predict(n_periods=forecast_steps)

        return {
            "test": "Auto ARIMA",
            "order": list(model.order),
            "seasonal_order": list(model.seasonal_order) if seasonal else None,
            "aic": float(model.aic()),
            "bic": float(model.bic()),
            "forecast": [float(v) for v in forecast],
            "n_observations": int(len(series)),
        }


@register_engine("arch")
class ARCHAnalysis(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        from arch import arch_model

        col = self.parameters["column"]
        p = int(self.parameters.get("p", 1))
        forecast_steps = self.parameters.get("forecast_steps", 10)

        series = self.df[col].dropna().values
        model = arch_model(series, vol="ARCH", p=p, mean="Constant")
        fitted = model.fit(disp="off")
        forecasts = fitted.forecast(horizon=forecast_steps)

        return {
            "test": "ARCH",
            "p": p,
            "aic": float(fitted.aic),
            "bic": float(fitted.bic),
            "log_likelihood": float(fitted.loglikelihood),
            "parameters": {k: float(v) for k, v in fitted.params.items()},
            "p_values": {k: float(v) for k, v in fitted.pvalues.items()},
            "conditional_volatility": [float(v) for v in fitted.conditional_volatility[-20:]],
            "variance_forecast": [float(v) for v in forecasts.variance.values[-1]],
            "n_observations": int(len(series)),
        }


@register_engine("garch")
class GARCHAnalysis(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        from arch import arch_model

        col = self.parameters["column"]
        p = int(self.parameters.get("p", 1))
        q = int(self.parameters.get("q", 1))
        forecast_steps = self.parameters.get("forecast_steps", 10)

        series = self.df[col].dropna().values
        model = arch_model(series, vol="Garch", p=p, q=q, mean="Constant")
        fitted = model.fit(disp="off")
        forecasts = fitted.forecast(horizon=forecast_steps)

        return {
            "test": "GARCH",
            "p": p,
            "q": q,
            "aic": float(fitted.aic),
            "bic": float(fitted.bic),
            "log_likelihood": float(fitted.loglikelihood),
            "parameters": {k: float(v) for k, v in fitted.params.items()},
            "p_values": {k: float(v) for k, v in fitted.pvalues.items()},
            "conditional_volatility": [float(v) for v in fitted.conditional_volatility[-20:]],
            "variance_forecast": [float(v) for v in forecasts.variance.values[-1]],
            "n_observations": int(len(series)),
        }


@register_engine("egarch")
class EGARCHAnalysis(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        from arch import arch_model

        col = self.parameters["column"]
        p = int(self.parameters.get("p", 1))
        q = int(self.parameters.get("q", 1))
        forecast_steps = self.parameters.get("forecast_steps", 10)

        series = self.df[col].dropna().values
        model = arch_model(series, vol="EGARCH", p=p, q=q, mean="Constant")
        fitted = model.fit(disp="off")
        forecasts = fitted.forecast(horizon=forecast_steps)

        return {
            "test": "EGARCH",
            "p": p,
            "q": q,
            "aic": float(fitted.aic),
            "bic": float(fitted.bic),
            "log_likelihood": float(fitted.loglikelihood),
            "parameters": {k: float(v) for k, v in fitted.params.items()},
            "p_values": {k: float(v) for k, v in fitted.pvalues.items()},
            "conditional_volatility": [float(v) for v in fitted.conditional_volatility[-20:]],
            "variance_forecast": [float(v) for v in forecasts.variance.values[-1]],
            "n_observations": int(len(series)),
        }


@register_engine("tgarch")
class TGARCHAnalysis(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        from arch import arch_model

        col = self.parameters["column"]
        p = int(self.parameters.get("p", 1))
        o = int(self.parameters.get("o", 1))
        q = int(self.parameters.get("q", 1))
        forecast_steps = self.parameters.get("forecast_steps", 10)

        series = self.df[col].dropna().values
        model = arch_model(series, vol="Garch", p=p, o=o, q=q, mean="Constant")
        fitted = model.fit(disp="off")
        forecasts = fitted.forecast(horizon=forecast_steps)

        return {
            "test": "TGARCH (GJR-GARCH)",
            "p": p,
            "o": o,
            "q": q,
            "aic": float(fitted.aic),
            "bic": float(fitted.bic),
            "log_likelihood": float(fitted.loglikelihood),
            "parameters": {k: float(v) for k, v in fitted.params.items()},
            "p_values": {k: float(v) for k, v in fitted.pvalues.items()},
            "conditional_volatility": [float(v) for v in fitted.conditional_volatility[-20:]],
            "variance_forecast": [float(v) for v in forecasts.variance.values[-1]],
            "n_observations": int(len(series)),
        }


@register_engine("exponential_smoothing")
class ExponentialSmoothing(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        from statsmodels.tsa.holtwinters import ExponentialSmoothing as ES

        col = self.parameters["column"]
        trend = self.parameters.get("trend", "add")
        seasonal = self.parameters.get("seasonal", None)
        seasonal_periods = int(self.parameters.get("seasonal_periods", 12))
        forecast_steps = self.parameters.get("forecast_steps", 10)

        series = self.df[col].dropna().values
        model = ES(series, trend=trend, seasonal=seasonal,
                   seasonal_periods=seasonal_periods if seasonal else None)
        fitted = model.fit(optimized=True)
        forecast = fitted.forecast(forecast_steps)

        return {
            "test": "Exponential Smoothing (Holt-Winters)",
            "trend": trend,
            "seasonal": seasonal,
            "aic": float(fitted.aic),
            "bic": float(fitted.bic),
            "sse": float(fitted.sse),
            "forecast": [float(v) for v in forecast],
            "smoothing_level": float(fitted.params.get("smoothing_level", 0)),
            "smoothing_trend": float(fitted.params.get("smoothing_trend", 0)) if trend else None,
            "smoothing_seasonal": float(fitted.params.get("smoothing_seasonal", 0)) if seasonal else None,
            "n_observations": int(len(series)),
        }


@register_engine("var")
class VARAnalysis(AnalysisEngine):
    def validate(self):
        if "columns" not in self.parameters:
            raise ValueError("Parameter 'columns' is required (list of column names)")

    def execute(self):
        from statsmodels.tsa.api import VAR as StatsVAR

        columns = self.parameters["columns"]
        if isinstance(columns, str):
            columns = [columns]
        maxlags = self.parameters.get("maxlags", None)
        forecast_steps = self.parameters.get("forecast_steps", 10)

        data = self.df[columns].dropna()
        model = StatsVAR(data)
        fitted = model.fit(maxlags=maxlags, ic="aic")
        forecast = fitted.forecast(data.values[-fitted.k_ar:], steps=forecast_steps)

        return {
            "test": "Vector Autoregression (VAR)",
            "order": int(fitted.k_ar),
            "aic": float(fitted.aic),
            "bic": float(fitted.bic),
            "variables": columns,
            "forecast": {col: [float(v) for v in forecast[:, i]] for i, col in enumerate(columns)},
            "n_observations": int(len(data)),
        }


@register_engine("granger_causality")
class GrangerCausality(AnalysisEngine):
    def validate(self):
        if "column1" not in self.parameters:
            raise ValueError("Parameter 'column1' is required")
        if "column2" not in self.parameters:
            raise ValueError("Parameter 'column2' is required")

    def execute(self):
        from statsmodels.tsa.stattools import grangercausalitytests

        col1 = self.parameters["column1"]
        col2 = self.parameters["column2"]
        maxlag = int(self.parameters.get("maxlag", 4))

        data = self.df[[col1, col2]].dropna()
        results_12 = grangercausalitytests(data[[col1, col2]], maxlag=maxlag, verbose=False)
        results_21 = grangercausalitytests(data[[col2, col1]], maxlag=maxlag, verbose=False)

        def extract_results(res):
            out = {}
            for lag, val in res.items():
                tests = val[0]
                out[f"lag_{lag}"] = {
                    "ssr_ftest_p": float(tests["ssr_ftest"][1]),
                    "ssr_chi2test_p": float(tests["ssr_chi2test"][1]),
                    "lrtest_p": float(tests["lrtest"][1]),
                }
            return out

        return {
            "test": "Granger Causality",
            f"{col2}_causes_{col1}": extract_results(results_12),
            f"{col1}_causes_{col2}": extract_results(results_21),
            "maxlag": maxlag,
            "n_observations": int(len(data)),
        }


@register_engine("decomposition")
class TimeSeriesDecomposition(AnalysisEngine):
    def validate(self):
        if "column" not in self.parameters:
            raise ValueError("Parameter 'column' is required")

    def execute(self):
        from statsmodels.tsa.seasonal import seasonal_decompose

        col = self.parameters["column"]
        period = self.parameters.get("period", 12)
        model_type = self.parameters.get("model", "additive")

        series = self.df[col].dropna()
        result = seasonal_decompose(series, model=model_type, period=period)

        return {
            "test": "Time Series Decomposition",
            "model": model_type,
            "period": period,
            "trend": [float(v) if not np.isnan(v) else None for v in result.trend],
            "seasonal": [float(v) for v in result.seasonal],
            "residual": [float(v) if not np.isnan(v) else None for v in result.resid],
            "n_observations": int(len(series)),
        }
