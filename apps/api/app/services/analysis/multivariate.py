import numpy as np
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("pca")
class PCAAnalysis(AnalysisEngine):
    def validate(self):
        if "columns" not in self.parameters:
            raise ValueError("Parameter 'columns' is required")

    def execute(self):
        from sklearn.decomposition import PCA
        from sklearn.preprocessing import StandardScaler

        columns = self.parameters["columns"]
        n_components = self.parameters.get("n_components")
        data = self.df[columns].dropna()

        scaler = StandardScaler()
        scaled = scaler.fit_transform(data)

        pca = PCA(n_components=n_components)
        scores = pca.fit_transform(scaled)

        loadings = {}
        for i, comp in enumerate(pca.components_):
            loadings[f"PC{i+1}"] = {col: float(val) for col, val in zip(columns, comp)}

        return {
            "test": "Principal Component Analysis",
            "n_components": int(pca.n_components_),
            "explained_variance_ratio": [float(v) for v in pca.explained_variance_ratio_],
            "cumulative_variance": [float(v) for v in np.cumsum(pca.explained_variance_ratio_)],
            "eigenvalues": [float(v) for v in pca.explained_variance_],
            "loadings": loadings,
            "n_observations": int(len(data)),
        }


@register_engine("factor_analysis")
class FactorAnalysis(AnalysisEngine):
    def validate(self):
        if "columns" not in self.parameters:
            raise ValueError("Parameter 'columns' is required")

    def execute(self):
        from factor_analyzer import FactorAnalyzer
        from factor_analyzer.factor_analyzer import calculate_bartlett_sphericity, calculate_kmo

        columns = self.parameters["columns"]
        n_factors = self.parameters.get("n_factors", 2)
        rotation = self.parameters.get("rotation", "varimax")
        data = self.df[columns].dropna()

        chi2, p_value = calculate_bartlett_sphericity(data)
        _, kmo = calculate_kmo(data)

        fa = FactorAnalyzer(n_factors=n_factors, rotation=rotation)
        fa.fit(data)

        loadings = {}
        for i in range(n_factors):
            loadings[f"Factor{i+1}"] = {col: float(val) for col, val in zip(columns, fa.loadings_[:, i])}

        variance = fa.get_factor_variance()

        return {
            "test": "Factor Analysis",
            "n_factors": n_factors,
            "rotation": rotation,
            "bartlett_chi2": float(chi2),
            "bartlett_p_value": float(p_value),
            "kmo": float(kmo),
            "loadings": loadings,
            "variance_explained": [float(v) for v in variance[1]],
            "cumulative_variance": [float(v) for v in variance[2]],
            "communalities": {col: float(val) for col, val in zip(columns, fa.get_communalities())},
        }


@register_engine("cluster_analysis")
class ClusterAnalysis(AnalysisEngine):
    def validate(self):
        if "columns" not in self.parameters:
            raise ValueError("Parameter 'columns' is required")

    def execute(self):
        from sklearn.cluster import KMeans
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import silhouette_score

        columns = self.parameters["columns"]
        n_clusters = self.parameters.get("n_clusters", 3)
        data = self.df[columns].dropna()

        scaler = StandardScaler()
        scaled = scaler.fit_transform(data)

        model = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
        labels = model.fit_predict(scaled)
        silhouette = float(silhouette_score(scaled, labels)) if n_clusters > 1 else 0.0

        cluster_stats = {}
        for i in range(n_clusters):
            mask = labels == i
            cluster_stats[f"Cluster_{i+1}"] = {
                "size": int(mask.sum()),
                "centroid": {col: float(val) for col, val in zip(columns, model.cluster_centers_[i])},
            }

        return {
            "test": "K-Means Cluster Analysis",
            "n_clusters": n_clusters,
            "inertia": float(model.inertia_),
            "silhouette_score": silhouette,
            "cluster_stats": cluster_stats,
            "n_observations": int(len(data)),
        }


@register_engine("discriminant_analysis")
class DiscriminantAnalysis(AnalysisEngine):
    def validate(self):
        if "features" not in self.parameters:
            raise ValueError("Parameter 'features' is required")
        if "target" not in self.parameters:
            raise ValueError("Parameter 'target' is required")

    def execute(self):
        from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
        from sklearn.model_selection import cross_val_score

        features = self.parameters["features"]
        target = self.parameters["target"]
        data = self.df[features + [target]].dropna()
        X = data[features].values
        y = data[target].values

        lda = LinearDiscriminantAnalysis()
        lda.fit(X, y)
        cv_scores = cross_val_score(lda, X, y, cv=min(5, len(np.unique(y))))

        return {
            "test": "Linear Discriminant Analysis",
            "n_components": int(lda.n_components) if hasattr(lda, "n_components") else None,
            "explained_variance_ratio": [float(v) for v in lda.explained_variance_ratio_] if hasattr(lda, "explained_variance_ratio_") else [],
            "training_accuracy": float(lda.score(X, y)),
            "cv_accuracy_mean": float(cv_scores.mean()),
            "cv_accuracy_std": float(cv_scores.std()),
            "classes": [str(c) for c in lda.classes_],
            "n_observations": int(len(data)),
        }
