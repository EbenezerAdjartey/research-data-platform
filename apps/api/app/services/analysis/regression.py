import numpy as np
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("linear_regression")
class LinearRegression(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "independent" not in self.parameters:
            raise ValueError("Parameter 'independent' is required (list of column names)")

    def execute(self):
        import statsmodels.api as sm

        dep = self.parameters["dependent"]
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]

        data = self.df[indep + [dep]].dropna()
        X = sm.add_constant(data[indep])
        y = data[dep]
        model = sm.OLS(y, X).fit()

        coefficients = {}
        for name, coef, se, t, p in zip(
            model.params.index, model.params, model.bse, model.tvalues, model.pvalues
        ):
            coefficients[str(name)] = {
                "coefficient": float(coef),
                "std_error": float(se),
                "t_value": float(t),
                "p_value": float(p),
            }

        return {
            "test": "Linear Regression" if len(indep) == 1 else "Multiple Linear Regression",
            "r_squared": float(model.rsquared),
            "adj_r_squared": float(model.rsquared_adj),
            "f_statistic": float(model.fvalue),
            "f_p_value": float(model.f_pvalue),
            "coefficients": coefficients,
            "aic": float(model.aic),
            "bic": float(model.bic),
            "durbin_watson": float(sm.stats.stattools.durbin_watson(model.resid)),
            "n_observations": int(model.nobs),
        }


@register_engine("multiple_linear_regression")
class MultipleLinearRegression(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "independent" not in self.parameters:
            raise ValueError("Parameter 'independent' is required (list of column names)")
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]
        if len(indep) < 2:
            raise ValueError("Multiple linear regression requires at least 2 independent variables")

    def execute(self):
        import statsmodels.api as sm
        from statsmodels.stats.outliers_influence import variance_inflation_factor

        dep = self.parameters["dependent"]
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]

        data = self.df[indep + [dep]].dropna()
        X = sm.add_constant(data[indep])
        y = data[dep]
        model = sm.OLS(y, X).fit()

        coefficients = {}
        for name, coef, se, t, p in zip(
            model.params.index, model.params, model.bse, model.tvalues, model.pvalues
        ):
            coefficients[str(name)] = {
                "coefficient": float(coef),
                "std_error": float(se),
                "t_value": float(t),
                "p_value": float(p),
            }

        # VIF for multicollinearity detection
        vif_data = {}
        X_no_const = data[indep]
        for i, col_name in enumerate(indep):
            try:
                vif_data[col_name] = float(variance_inflation_factor(X_no_const.values, i))
            except Exception:
                vif_data[col_name] = None

        return {
            "test": "Multiple Linear Regression",
            "r_squared": float(model.rsquared),
            "adj_r_squared": float(model.rsquared_adj),
            "f_statistic": float(model.fvalue),
            "f_p_value": float(model.f_pvalue),
            "coefficients": coefficients,
            "vif": vif_data,
            "aic": float(model.aic),
            "bic": float(model.bic),
            "durbin_watson": float(sm.stats.stattools.durbin_watson(model.resid)),
            "condition_number": float(model.condition_number),
            "n_observations": int(model.nobs),
        }


@register_engine("polynomial_regression")
class PolynomialRegression(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "independent" not in self.parameters:
            raise ValueError("Parameter 'independent' is required")

    def execute(self):
        import statsmodels.api as sm
        from sklearn.preprocessing import PolynomialFeatures

        dep = self.parameters["dependent"]
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]
        degree = int(self.parameters.get("degree", 2))

        data = self.df[indep + [dep]].dropna()
        X_raw = data[indep].values
        y = data[dep].values

        poly = PolynomialFeatures(degree=degree, include_bias=False)
        X_poly = poly.fit_transform(X_raw)
        feature_names = poly.get_feature_names_out(indep)

        X_with_const = sm.add_constant(X_poly)
        model = sm.OLS(y, X_with_const).fit()

        coefficients = {}
        names = ["const"] + list(feature_names)
        for name, coef, se, t, p in zip(
            names, model.params, model.bse, model.tvalues, model.pvalues
        ):
            coefficients[str(name)] = {
                "coefficient": float(coef),
                "std_error": float(se),
                "t_value": float(t),
                "p_value": float(p),
            }

        return {
            "test": "Polynomial Regression",
            "degree": degree,
            "r_squared": float(model.rsquared),
            "adj_r_squared": float(model.rsquared_adj),
            "f_statistic": float(model.fvalue),
            "f_p_value": float(model.f_pvalue),
            "coefficients": coefficients,
            "aic": float(model.aic),
            "bic": float(model.bic),
            "n_observations": int(model.nobs),
        }


@register_engine("logistic_regression")
class LogisticRegression(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "independent" not in self.parameters:
            raise ValueError("Parameter 'independent' is required")

    def execute(self):
        import statsmodels.api as sm

        dep = self.parameters["dependent"]
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]

        data = self.df[indep + [dep]].dropna()
        X = sm.add_constant(data[indep])
        y = data[dep]
        model = sm.Logit(y, X).fit(disp=0)

        coefficients = {}
        for name, coef, se, z, p in zip(
            model.params.index, model.params, model.bse, model.tvalues, model.pvalues
        ):
            coefficients[str(name)] = {
                "coefficient": float(coef),
                "odds_ratio": float(np.exp(coef)),
                "std_error": float(se),
                "z_value": float(z),
                "p_value": float(p),
            }

        return {
            "test": "Logistic Regression",
            "pseudo_r_squared": float(model.prsquared),
            "log_likelihood": float(model.llf),
            "coefficients": coefficients,
            "aic": float(model.aic),
            "bic": float(model.bic),
            "n_observations": int(model.nobs),
        }


@register_engine("ridge_regression")
class RidgeRegression(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "independent" not in self.parameters:
            raise ValueError("Parameter 'independent' is required")

    def execute(self):
        from sklearn.linear_model import Ridge
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import r2_score, mean_squared_error

        dep = self.parameters["dependent"]
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]
        alpha = self.parameters.get("alpha_reg", 1.0)

        data = self.df[indep + [dep]].dropna()
        X = data[indep].values
        y = data[dep].values

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = Ridge(alpha=alpha)
        model.fit(X_scaled, y)
        y_pred = model.predict(X_scaled)

        return {
            "test": "Ridge Regression",
            "alpha": alpha,
            "r_squared": float(r2_score(y, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y, y_pred))),
            "coefficients": {name: float(c) for name, c in zip(indep, model.coef_)},
            "intercept": float(model.intercept_),
            "n_observations": int(len(y)),
        }


@register_engine("lasso_regression")
class LassoRegression(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "independent" not in self.parameters:
            raise ValueError("Parameter 'independent' is required")

    def execute(self):
        from sklearn.linear_model import Lasso
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import r2_score, mean_squared_error

        dep = self.parameters["dependent"]
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]
        alpha = self.parameters.get("alpha_reg", 1.0)

        data = self.df[indep + [dep]].dropna()
        X = data[indep].values
        y = data[dep].values

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = Lasso(alpha=alpha)
        model.fit(X_scaled, y)
        y_pred = model.predict(X_scaled)

        return {
            "test": "Lasso Regression",
            "alpha": alpha,
            "r_squared": float(r2_score(y, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y, y_pred))),
            "coefficients": {name: float(c) for name, c in zip(indep, model.coef_)},
            "intercept": float(model.intercept_),
            "n_features_selected": int(np.sum(model.coef_ != 0)),
            "n_observations": int(len(y)),
        }


@register_engine("elastic_net")
class ElasticNetRegression(AnalysisEngine):
    def validate(self):
        if "dependent" not in self.parameters:
            raise ValueError("Parameter 'dependent' is required")
        if "independent" not in self.parameters:
            raise ValueError("Parameter 'independent' is required")

    def execute(self):
        from sklearn.linear_model import ElasticNet
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import r2_score, mean_squared_error

        dep = self.parameters["dependent"]
        indep = self.parameters["independent"]
        if isinstance(indep, str):
            indep = [indep]
        alpha = self.parameters.get("alpha_reg", 1.0)
        l1_ratio = self.parameters.get("l1_ratio", 0.5)

        data = self.df[indep + [dep]].dropna()
        X = data[indep].values
        y = data[dep].values

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        model = ElasticNet(alpha=alpha, l1_ratio=l1_ratio)
        model.fit(X_scaled, y)
        y_pred = model.predict(X_scaled)

        return {
            "test": "Elastic Net Regression",
            "alpha": alpha,
            "l1_ratio": l1_ratio,
            "r_squared": float(r2_score(y, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y, y_pred))),
            "coefficients": {name: float(c) for name, c in zip(indep, model.coef_)},
            "intercept": float(model.intercept_),
            "n_observations": int(len(y)),
        }
