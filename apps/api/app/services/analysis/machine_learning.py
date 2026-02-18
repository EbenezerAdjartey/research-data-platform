import numpy as np
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("classification")
class Classification(AnalysisEngine):
    def validate(self):
        if "features" not in self.parameters:
            raise ValueError("Parameter 'features' is required")
        if "target" not in self.parameters:
            raise ValueError("Parameter 'target' is required")

    def execute(self):
        from sklearn.model_selection import cross_val_score, train_test_split
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.metrics import classification_report
        from sklearn.ensemble import RandomForestClassifier
        from sklearn.svm import SVC
        from sklearn.neural_network import MLPClassifier

        features = self.parameters["features"]
        target = self.parameters["target"]
        algorithm = self.parameters.get("algorithm", "random_forest")
        test_size = self.parameters.get("test_size", 0.2)
        cv_folds = self.parameters.get("cv_folds", 5)

        data = self.df[features + [target]].dropna()
        X = data[features].values
        y = data[target].values

        le = LabelEncoder()
        y_encoded = le.fit_transform(y)

        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        classifiers = {
            "random_forest": RandomForestClassifier(n_estimators=100, random_state=42),
            "svm": SVC(kernel=self.parameters.get("kernel", "rbf"), random_state=42),
            "mlp": MLPClassifier(hidden_layer_sizes=(100,), max_iter=500, random_state=42),
        }

        if algorithm not in classifiers:
            raise ValueError(f"Unknown algorithm: {algorithm}. Available: {list(classifiers.keys())}")

        model = classifiers[algorithm]
        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_encoded, test_size=test_size, random_state=42, stratify=y_encoded
        )

        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        cv_scores = cross_val_score(model, X_scaled, y_encoded, cv=cv_folds)

        report = classification_report(y_test, y_pred, target_names=[str(c) for c in le.classes_], output_dict=True)

        result = {
            "test": f"Classification ({algorithm})",
            "algorithm": algorithm,
            "train_accuracy": float(model.score(X_train, y_train)),
            "test_accuracy": float(model.score(X_test, y_test)),
            "cv_accuracy_mean": float(cv_scores.mean()),
            "cv_accuracy_std": float(cv_scores.std()),
            "classification_report": report,
            "classes": [str(c) for c in le.classes_],
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
        }

        if algorithm == "random_forest":
            result["feature_importance"] = {
                name: float(imp) for name, imp in zip(features, model.feature_importances_)
            }

        return result


@register_engine("naive_bayes")
class NaiveBayesClassifier(AnalysisEngine):
    def validate(self):
        if "features" not in self.parameters:
            raise ValueError("Parameter 'features' is required")
        if "target" not in self.parameters:
            raise ValueError("Parameter 'target' is required")

    def execute(self):
        from sklearn.model_selection import cross_val_score, train_test_split
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.metrics import classification_report
        from sklearn.naive_bayes import GaussianNB

        features = self.parameters["features"]
        target = self.parameters["target"]
        data = self.df[features + [target]].dropna()
        X = data[features].values
        y = data[target].values
        le = LabelEncoder()
        y_encoded = le.fit_transform(y)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
        )
        model = GaussianNB()
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        cv_scores = cross_val_score(model, X_scaled, y_encoded, cv=5)
        report = classification_report(y_test, y_pred, target_names=[str(c) for c in le.classes_], output_dict=True)

        return {
            "test": "Naive Bayes Classification",
            "train_accuracy": float(model.score(X_train, y_train)),
            "test_accuracy": float(model.score(X_test, y_test)),
            "cv_accuracy_mean": float(cv_scores.mean()),
            "cv_accuracy_std": float(cv_scores.std()),
            "classification_report": report,
            "classes": [str(c) for c in le.classes_],
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
        }


@register_engine("decision_tree")
class DecisionTreeClassifier(AnalysisEngine):
    def validate(self):
        if "features" not in self.parameters:
            raise ValueError("Parameter 'features' is required")
        if "target" not in self.parameters:
            raise ValueError("Parameter 'target' is required")

    def execute(self):
        from sklearn.model_selection import cross_val_score, train_test_split
        from sklearn.preprocessing import LabelEncoder
        from sklearn.metrics import classification_report
        from sklearn.tree import DecisionTreeClassifier as DTC

        features = self.parameters["features"]
        target = self.parameters["target"]
        max_depth = self.parameters.get("max_depth")
        data = self.df[features + [target]].dropna()
        X = data[features].values
        y = data[target].values
        le = LabelEncoder()
        y_encoded = le.fit_transform(y)

        X_train, X_test, y_train, y_test = train_test_split(
            X, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
        )
        model = DTC(max_depth=int(max_depth) if max_depth else None, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        cv_scores = cross_val_score(model, X, y_encoded, cv=5)
        report = classification_report(y_test, y_pred, target_names=[str(c) for c in le.classes_], output_dict=True)

        return {
            "test": "Decision Tree Classification",
            "train_accuracy": float(model.score(X_train, y_train)),
            "test_accuracy": float(model.score(X_test, y_test)),
            "cv_accuracy_mean": float(cv_scores.mean()),
            "cv_accuracy_std": float(cv_scores.std()),
            "classification_report": report,
            "feature_importance": {name: float(imp) for name, imp in zip(features, model.feature_importances_)},
            "tree_depth": int(model.get_depth()),
            "n_leaves": int(model.get_n_leaves()),
            "classes": [str(c) for c in le.classes_],
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
        }


@register_engine("gradient_boosting")
class GradientBoostingClassifier(AnalysisEngine):
    def validate(self):
        if "features" not in self.parameters:
            raise ValueError("Parameter 'features' is required")
        if "target" not in self.parameters:
            raise ValueError("Parameter 'target' is required")

    def execute(self):
        from sklearn.model_selection import cross_val_score, train_test_split
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.metrics import classification_report
        from sklearn.ensemble import GradientBoostingClassifier as GBC

        features = self.parameters["features"]
        target = self.parameters["target"]
        n_estimators = int(self.parameters.get("n_estimators", 100))
        data = self.df[features + [target]].dropna()
        X = data[features].values
        y = data[target].values
        le = LabelEncoder()
        y_encoded = le.fit_transform(y)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
        )
        model = GBC(n_estimators=n_estimators, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        cv_scores = cross_val_score(model, X_scaled, y_encoded, cv=5)
        report = classification_report(y_test, y_pred, target_names=[str(c) for c in le.classes_], output_dict=True)

        return {
            "test": "Gradient Boosting Classification",
            "n_estimators": n_estimators,
            "train_accuracy": float(model.score(X_train, y_train)),
            "test_accuracy": float(model.score(X_test, y_test)),
            "cv_accuracy_mean": float(cv_scores.mean()),
            "cv_accuracy_std": float(cv_scores.std()),
            "classification_report": report,
            "feature_importance": {name: float(imp) for name, imp in zip(features, model.feature_importances_)},
            "classes": [str(c) for c in le.classes_],
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
        }


@register_engine("knn_classifier")
class KNNClassifier(AnalysisEngine):
    def validate(self):
        if "features" not in self.parameters:
            raise ValueError("Parameter 'features' is required")
        if "target" not in self.parameters:
            raise ValueError("Parameter 'target' is required")

    def execute(self):
        from sklearn.model_selection import cross_val_score, train_test_split
        from sklearn.preprocessing import StandardScaler, LabelEncoder
        from sklearn.metrics import classification_report
        from sklearn.neighbors import KNeighborsClassifier

        features = self.parameters["features"]
        target = self.parameters["target"]
        n_neighbors = int(self.parameters.get("n_neighbors", 5))
        data = self.df[features + [target]].dropna()
        X = data[features].values
        y = data[target].values
        le = LabelEncoder()
        y_encoded = le.fit_transform(y)
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        X_train, X_test, y_train, y_test = train_test_split(
            X_scaled, y_encoded, test_size=0.2, random_state=42, stratify=y_encoded
        )
        model = KNeighborsClassifier(n_neighbors=n_neighbors)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        cv_scores = cross_val_score(model, X_scaled, y_encoded, cv=5)
        report = classification_report(y_test, y_pred, target_names=[str(c) for c in le.classes_], output_dict=True)

        return {
            "test": f"KNN Classification (k={n_neighbors})",
            "n_neighbors": n_neighbors,
            "train_accuracy": float(model.score(X_train, y_train)),
            "test_accuracy": float(model.score(X_test, y_test)),
            "cv_accuracy_mean": float(cv_scores.mean()),
            "cv_accuracy_std": float(cv_scores.std()),
            "classification_report": report,
            "classes": [str(c) for c in le.classes_],
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
        }


@register_engine("gaussian_mixture")
class GaussianMixture(AnalysisEngine):
    def validate(self):
        if "columns" not in self.parameters:
            raise ValueError("Parameter 'columns' is required")

    def execute(self):
        from sklearn.mixture import GaussianMixture as GMM
        from sklearn.preprocessing import StandardScaler

        columns = self.parameters["columns"]
        n_components = int(self.parameters.get("n_components", 3))
        data = self.df[columns].dropna()
        scaler = StandardScaler()
        X = scaler.fit_transform(data)

        model = GMM(n_components=n_components, random_state=42)
        labels = model.fit_predict(X)

        cluster_info = {}
        for i in range(n_components):
            mask = labels == i
            cluster_info[f"Component_{i}"] = {
                "size": int(mask.sum()),
                "weight": float(model.weights_[i]),
            }

        return {
            "test": "Gaussian Mixture Model",
            "n_components": n_components,
            "aic": float(model.aic(X)),
            "bic": float(model.bic(X)),
            "converged": bool(model.converged_),
            "n_iterations": int(model.n_iter_),
            "cluster_info": cluster_info,
            "n_observations": int(len(data)),
        }


@register_engine("regression_ml")
class RegressionML(AnalysisEngine):
    def validate(self):
        if "features" not in self.parameters:
            raise ValueError("Parameter 'features' is required")
        if "target" not in self.parameters:
            raise ValueError("Parameter 'target' is required")

    def execute(self):
        from sklearn.model_selection import cross_val_score, train_test_split
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
        from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
        from sklearn.svm import SVR

        features = self.parameters["features"]
        target = self.parameters["target"]
        algorithm = self.parameters.get("algorithm", "random_forest")
        data = self.df[features + [target]].dropna()
        X = data[features].values
        y = data[target].values
        scaler = StandardScaler()
        X_scaled = scaler.fit_transform(X)

        regressors = {
            "random_forest": RandomForestRegressor(n_estimators=100, random_state=42),
            "gradient_boosting": GradientBoostingRegressor(n_estimators=100, random_state=42),
            "svr": SVR(kernel="rbf"),
        }
        model = regressors.get(algorithm)
        if not model:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        cv_scores = cross_val_score(model, X_scaled, y, cv=5, scoring="r2")

        result = {
            "test": f"ML Regression ({algorithm})",
            "algorithm": algorithm,
            "r_squared": float(r2_score(y_test, y_pred)),
            "rmse": float(np.sqrt(mean_squared_error(y_test, y_pred))),
            "mae": float(mean_absolute_error(y_test, y_pred)),
            "cv_r2_mean": float(cv_scores.mean()),
            "cv_r2_std": float(cv_scores.std()),
            "n_train": int(len(X_train)),
            "n_test": int(len(X_test)),
        }
        if hasattr(model, "feature_importances_"):
            result["feature_importance"] = {name: float(imp) for name, imp in zip(features, model.feature_importances_)}
        return result


@register_engine("clustering_ml")
class ClusteringML(AnalysisEngine):
    def validate(self):
        if "features" not in self.parameters:
            raise ValueError("Parameter 'features' is required")

    def execute(self):
        from sklearn.cluster import KMeans, DBSCAN, AgglomerativeClustering
        from sklearn.preprocessing import StandardScaler
        from sklearn.metrics import silhouette_score

        features = self.parameters["features"]
        algorithm = self.parameters.get("algorithm", "kmeans")
        data = self.df[features].dropna()
        scaler = StandardScaler()
        X = scaler.fit_transform(data)

        if algorithm == "kmeans":
            n_clusters = self.parameters.get("n_clusters", 3)
            model = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
            labels = model.fit_predict(X)
        elif algorithm == "dbscan":
            eps = self.parameters.get("eps", 0.5)
            min_samples = self.parameters.get("min_samples", 5)
            model = DBSCAN(eps=eps, min_samples=min_samples)
            labels = model.fit_predict(X)
        elif algorithm == "hierarchical":
            n_clusters = self.parameters.get("n_clusters", 3)
            model = AgglomerativeClustering(n_clusters=n_clusters)
            labels = model.fit_predict(X)
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")

        unique_labels = set(labels)
        n_clusters_found = len(unique_labels - {-1})
        sil = float(silhouette_score(X, labels)) if n_clusters_found > 1 and -1 not in labels else None

        cluster_info = {}
        for label in sorted(unique_labels):
            mask = labels == label
            name = f"Cluster_{label}" if label != -1 else "Noise"
            cluster_info[name] = {"size": int(mask.sum())}

        return {
            "test": f"Clustering ({algorithm})",
            "algorithm": algorithm,
            "n_clusters_found": n_clusters_found,
            "silhouette_score": sil,
            "cluster_info": cluster_info,
            "n_observations": int(len(data)),
        }
