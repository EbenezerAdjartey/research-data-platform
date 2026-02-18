from pathlib import Path
import json


def export_report(report, export_format: str) -> Path:
    """Export a report to PDF or DOCX."""
    output_dir = Path("uploads/reports")
    output_dir.mkdir(parents=True, exist_ok=True)

    if export_format == "pdf":
        return _export_pdf(report, output_dir)
    elif export_format == "docx":
        return _export_docx(report, output_dir)
    raise ValueError(f"Unsupported format: {export_format}")


def _export_pdf(report, output_dir: Path) -> Path:
    from weasyprint import HTML

    html_content = _build_html(report)
    output_path = output_dir / f"report_{report.id}.pdf"
    HTML(string=html_content).write_pdf(str(output_path))
    return output_path


def _export_docx(report, output_dir: Path) -> Path:
    from docx import Document

    doc = Document()
    doc.add_heading(report.title, level=1)

    sections = report.sections if isinstance(report.sections, dict) else {}
    for section_title, content in sections.items():
        doc.add_heading(section_title, level=2)
        if isinstance(content, str):
            doc.add_paragraph(content)
        elif isinstance(content, dict):
            doc.add_paragraph(json.dumps(content, indent=2))

    output_path = output_dir / f"report_{report.id}.docx"
    doc.save(str(output_path))
    return output_path


def _build_html(report) -> str:
    sections_html = ""
    sections = report.sections if isinstance(report.sections, dict) else {}
    for title, content in sections.items():
        if isinstance(content, str):
            body = f"<p>{content}</p>"
        else:
            body = f"<pre>{json.dumps(content, indent=2)}</pre>"
        sections_html += f"<h2>{title}</h2>{body}"

    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body {{ font-family: 'Times New Roman', serif; margin: 2cm; line-height: 1.6; }}
            h1 {{ text-align: center; margin-bottom: 1cm; }}
            h2 {{ margin-top: 1cm; border-bottom: 1px solid #ccc; padding-bottom: 0.3cm; }}
            table {{ border-collapse: collapse; width: 100%; margin: 0.5cm 0; }}
            th, td {{ border: 1px solid #999; padding: 0.3cm; text-align: left; }}
            pre {{ background: #f5f5f5; padding: 0.5cm; overflow-x: auto; font-size: 0.9em; }}
        </style>
    </head>
    <body>
        <h1>{report.title}</h1>
        {sections_html}
    </body>
    </html>
    """
