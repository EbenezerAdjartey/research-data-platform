import plotly.graph_objects as go
import plotly.express as px
import numpy as np


def create_plotly_chart(results: dict, chart_type: str, config: dict = {}) -> dict:
    """Generate Plotly JSON for various chart types from analysis results."""

    chart_builders = {
        "bar": _build_bar,
        "scatter": _build_scatter,
        "histogram": _build_histogram,
        "box": _build_box,
        "violin": _build_violin,
        "heatmap": _build_heatmap,
        "line": _build_line,
        "pie": _build_pie,
        "qq": _build_qq,
        "forest": _build_forest,
    }

    builder = chart_builders.get(chart_type)
    if not builder:
        raise ValueError(f"Unknown chart type: {chart_type}. Available: {list(chart_builders.keys())}")

    fig = builder(results, config)
    return fig.to_plotly_json()


def _build_bar(results: dict, config: dict) -> go.Figure:
    x = config.get("x", [])
    y = config.get("y", [])
    title = config.get("title", "Bar Chart")
    fig = go.Figure(data=[go.Bar(x=x, y=y)])
    fig.update_layout(title=title)
    return fig


def _build_scatter(results: dict, config: dict) -> go.Figure:
    x = config.get("x", [])
    y = config.get("y", [])
    title = config.get("title", "Scatter Plot")
    fig = go.Figure(data=[go.Scatter(x=x, y=y, mode="markers")])
    fig.update_layout(title=title)
    return fig


def _build_histogram(results: dict, config: dict) -> go.Figure:
    values = config.get("values", [])
    title = config.get("title", "Histogram")
    fig = go.Figure(data=[go.Histogram(x=values, nbinsx=config.get("bins", 30))])
    fig.update_layout(title=title)
    return fig


def _build_box(results: dict, config: dict) -> go.Figure:
    fig = go.Figure()
    data = config.get("data", {})
    for name, values in data.items():
        fig.add_trace(go.Box(y=values, name=name))
    fig.update_layout(title=config.get("title", "Box Plot"))
    return fig


def _build_violin(results: dict, config: dict) -> go.Figure:
    fig = go.Figure()
    data = config.get("data", {})
    for name, values in data.items():
        fig.add_trace(go.Violin(y=values, name=name))
    fig.update_layout(title=config.get("title", "Violin Plot"))
    return fig


def _build_heatmap(results: dict, config: dict) -> go.Figure:
    z = config.get("z", [[]])
    x = config.get("x_labels", [])
    y = config.get("y_labels", [])
    fig = go.Figure(data=go.Heatmap(z=z, x=x, y=y, colorscale="Viridis"))
    fig.update_layout(title=config.get("title", "Heatmap"))
    return fig


def _build_line(results: dict, config: dict) -> go.Figure:
    x = config.get("x", [])
    y = config.get("y", [])
    title = config.get("title", "Line Chart")
    fig = go.Figure(data=[go.Scatter(x=x, y=y, mode="lines")])
    fig.update_layout(title=title)
    return fig


def _build_pie(results: dict, config: dict) -> go.Figure:
    labels = config.get("labels", [])
    values = config.get("values", [])
    fig = go.Figure(data=[go.Pie(labels=labels, values=values)])
    fig.update_layout(title=config.get("title", "Pie Chart"))
    return fig


def _build_qq(results: dict, config: dict) -> go.Figure:
    from scipy import stats
    values = np.array(config.get("values", []))
    if len(values) == 0:
        return go.Figure()
    theoretical, sample = stats.probplot(values, dist="norm")[:2]
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=list(theoretical[0]), y=list(theoretical[1]), mode="markers", name="Data"))
    min_val = min(theoretical[0])
    max_val = max(theoretical[0])
    fig.add_trace(go.Scatter(
        x=[min_val, max_val],
        y=[sample[1] + sample[0] * min_val, sample[1] + sample[0] * max_val],
        mode="lines", name="Reference"
    ))
    fig.update_layout(title=config.get("title", "Q-Q Plot"), xaxis_title="Theoretical Quantiles", yaxis_title="Sample Quantiles")
    return fig


def _build_forest(results: dict, config: dict) -> go.Figure:
    studies = results.get("studies", [])
    if not studies:
        return go.Figure()

    names = [s["name"] for s in studies]
    effects = [s["effect_size"] for s in studies]
    variances = [s["variance"] for s in studies]
    ci_low = [e - 1.96 * np.sqrt(v) for e, v in zip(effects, variances)]
    ci_high = [e + 1.96 * np.sqrt(v) for e, v in zip(effects, variances)]

    fig = go.Figure()
    fig.add_trace(go.Scatter(
        x=effects, y=names, mode="markers",
        error_x=dict(type="data", symmetric=False, array=[h - e for e, h in zip(effects, ci_high)],
                     arrayminus=[e - l for e, l in zip(effects, ci_low)]),
        marker=dict(size=8),
    ))
    fig.add_vline(x=0, line_dash="dash", line_color="gray")
    fig.update_layout(title=config.get("title", "Forest Plot"), xaxis_title="Effect Size")
    return fig
