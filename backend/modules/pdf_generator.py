from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.units import cm
from reportlab.lib.enums import TA_JUSTIFY
import io

def generate_pdf(letter_text: str, candidate_name: str = "Candidat") -> bytes:
    buffer = io.BytesIO()
    
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=2.5*cm,
        leftMargin=2.5*cm,
        topMargin=2.5*cm,
        bottomMargin=2.5*cm
    )

    styles = getSampleStyleSheet()
    
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontSize=11,
        leading=18,
        alignment=TA_JUSTIFY,
        fontName='Helvetica'
    )

    elements = []
    
    for line in letter_text.split('\n'):
        if line.strip() == '':
            elements.append(Spacer(1, 0.4*cm))
        else:
            elements.append(Paragraph(line.strip(), body_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.read()
    