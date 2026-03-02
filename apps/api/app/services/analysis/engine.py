from abc import ABC, abstractmethod
from typing import Any
import pandas as pd
from app.services import storage

# Registry of analysis engines
_registry: dict[str, type["AnalysisEngine"]] = {}


def register_engine(analysis_type: str):
    def decorator(cls):
        _registry[analysis_type] = cls
        return cls
    return decorator


class AnalysisEngine(ABC):
    def __init__(self, df: pd.DataFrame, parameters: dict[str, Any]):
        self.df = df
        self.parameters = parameters

    @abstractmethod
    def validate(self) -> None:
        """Validate parameters before running analysis."""
        pass

    @abstractmethod
    def execute(self) -> dict[str, Any]:
        """Run the analysis and return results."""
        pass


_engines_loaded = False


def _load_engines() -> None:
    """Lazily import all analysis submodules to trigger @register_engine decorators.
    Called on first analysis request so heavy packages (scipy, sklearn, etc.)
    are not loaded at server startup, keeping memory within the free tier limit.
    """
    global _engines_loaded
    if _engines_loaded:
        return
    from app.services.analysis import (  # noqa: F401
        descriptive,
        inferential,
        regression,
        nonparametric,
        multivariate,
        timeseries,
        bayesian,
        survival,
        meta_analysis,
        machine_learning,
    )
    _engines_loaded = True


def run_analysis(analysis_type: str, parameters: dict, data_path: str) -> dict:
    _load_engines()
    engine_cls = _registry.get(analysis_type)
    if engine_cls is None:
        available = ", ".join(sorted(_registry.keys()))
        raise ValueError(f"Unknown analysis type: {analysis_type}. Available: {available}")

    df = storage.read_dataframe(data_path)
    engine = engine_cls(df, parameters)
    engine.validate()
    return engine.execute()
