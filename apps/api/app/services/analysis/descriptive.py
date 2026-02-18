import numpy as np
from scipy import stats
from app.services.analysis.engine import AnalysisEngine, register_engine


@register_engine("descriptive_statistics")
class DescriptiveStatistics(AnalysisEngine):
    def validate(self):
        columns = self.parameters.get("columns")
        if columns:
            missing = [c for c in columns if c not in self.df.columns]
            if missing:
                raise ValueError(f"Columns not found: {missing}")

    def execute(self):
        columns = self.parameters.get("columns") or list(self.df.select_dtypes(include="number").columns)
        results = {}
        for col in columns:
            series = self.df[col].dropna()
            if not np.issubdtype(series.dtype, np.number):
                continue
            values = series.values
            results[col] = {
                "count": int(len(series)),
                "mean": float(np.mean(values)),
                "median": float(np.median(values)),
                "std": float(np.std(values, ddof=1)) if len(values) > 1 else None,
                "variance": float(np.var(values, ddof=1)) if len(values) > 1 else None,
                "min": float(np.min(values)),
                "max": float(np.max(values)),
                "q1": float(np.percentile(values, 25)),
                "q3": float(np.percentile(values, 75)),
                "iqr": float(np.percentile(values, 75) - np.percentile(values, 25)),
                "skewness": float(stats.skew(values)),
                "kurtosis": float(stats.kurtosis(values)),
                "missing": int(self.df[col].isnull().sum()),
            }
        return {"summary": results}


@register_engine("frequency_table")
class FrequencyTable(AnalysisEngine):
    def validate(self):
        col = self.parameters.get("column")
        if not col:
            raise ValueError("Parameter 'column' is required")
        if col not in self.df.columns:
            raise ValueError(f"Column '{col}' not found")

    def execute(self):
        col = self.parameters["column"]
        counts = self.df[col].value_counts()
        percentages = self.df[col].value_counts(normalize=True) * 100
        cumulative = percentages.cumsum()

        table = []
        for value in counts.index:
            table.append({
                "value": str(value),
                "frequency": int(counts[value]),
                "percentage": round(float(percentages[value]), 2),
                "cumulative_percentage": round(float(cumulative[value]), 2),
            })

        return {
            "column": col,
            "total": int(len(self.df)),
            "unique_values": int(self.df[col].nunique()),
            "missing": int(self.df[col].isnull().sum()),
            "table": table,
        }
