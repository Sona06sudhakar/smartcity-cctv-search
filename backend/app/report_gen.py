import os
from datetime import datetime
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

from app.config import BASE_DIR, STATIC_DIR

def generate_forensic_report(
    output_path: str,
    query_text: str,
    filters: dict,
    detections: list,
    username: str,
    investigator: str = "",
    investigator_notes: str = ""
) -> str:
    """
    Generates a professional forensic PDF report.
    detections list contains dicts with: image_path, camera_id, timestamp, track_id, attributes, video_sha256, crop_sha256, confidence, similarity_score
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40
    )

    story = []
    styles = getSampleStyleSheet()

    # Custom Styles
    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=24,
        textColor=colors.HexColor("#1A365D"),
        spaceAfter=12
    )
    
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=colors.HexColor("#4A5568"),
        spaceAfter=20
    )
    
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=14,
        textColor=colors.HexColor("#2B6CB0"),
        spaceBefore=12,
        spaceAfter=8,
        keepWithNext=True
    )
    
    normal_style = ParagraphStyle(
        "ReportNormal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=colors.HexColor("#2D3748"),
        leading=14
    )

    bold_style = ParagraphStyle(
        "ReportBold",
        parent=normal_style,
        fontName="Helvetica-Bold"
    )

    # 1. Header
    story.append(Paragraph("FORENSIC EVIDENCE REPORT", title_style))
    export_time_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    story.append(Paragraph(f"Generated on: {export_time_str} | Prepared by: {investigator or username}", subtitle_style))
    story.append(Spacer(1, 10))

    # 2. Case / Search Metadata Section
    story.append(Paragraph("1. Forensic Case Details", section_heading))
    
    # Format filters
    filters_formatted = []
    for k, v in filters.items():
        if v:
            filters_formatted.append(f"<b>{k.replace('_', ' ').capitalize()}</b>: {v}")
    filters_str = " | ".join(filters_formatted) if filters_formatted else "None"
    
    meta_data = [
        [Paragraph("<b>Descriptive Query:</b>", normal_style), Paragraph(query_text if query_text else "N/A (Reference Image Search)", normal_style)],
        [Paragraph("<b>Applied Filters:</b>", normal_style), Paragraph(filters_str, normal_style)],
        [Paragraph("<b>Evidence Count:</b>", normal_style), Paragraph(f"{len(detections)} matches compiled", normal_style)],
        [Paragraph("<b>Investigator Notes:</b>", normal_style), Paragraph(investigator_notes if investigator_notes else "No notes logged.", normal_style)]
    ]
    
    meta_table = Table(meta_data, colWidths=[1.5 * inch, 5.5 * inch])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('PADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
        ('LINEBELOW', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#CBD5E0")),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 15))

    # 3. Evidence Images Grid
    story.append(Paragraph("2. Visual Evidence Records", section_heading))
    
    if not detections:
        story.append(Paragraph("No evidence files matched the query parameters.", normal_style))
    else:
        # Build cards for each match
        for idx, det in enumerate(detections[:10]):  # Limit to top 10 for layout spacing
            # Load and resize crop image
            img_relative = det["image_path"]
            img_file_path = BASE_DIR / img_relative.lstrip("/")
            
            img_flowable = None
            if os.path.exists(img_file_path):
                try:
                    # Resize thumbnail to 1.2 x 1.2 inches
                    img_flowable = Image(str(img_file_path), width=1.2 * inch, height=1.2 * inch)
                except Exception as e:
                    print(f"[Report] Error loading image: {e}")
                    img_flowable = Paragraph("[Image Error]", normal_style)
            else:
                img_flowable = Paragraph("[Missing Image]", normal_style)

            attrs_dict = det.get("attributes", {})
            attrs_str = ", ".join([f"{k.replace('_', ' ').capitalize()}: {v}" for k, v in attrs_dict.items() if v])

            video_sha = det.get("video_sha256", "Unknown")
            crop_sha = det.get("crop_sha256", "Unknown")
            similarity = det.get("similarity_score")
            sim_str = f" | <b>CLIP Similarity:</b> {similarity * 100:.0f}%" if similarity is not None else ""

            # Prepare card layout
            card_data = [
                [
                    img_flowable,
                    [
                        Paragraph(f"<b>Evidence Item #{idx+1} (ID: {det['id']} | Track ID: #{det.get('track_id', 'N/A')})</b>", bold_style),
                        Paragraph(f"<b>Camera:</b> {det['camera_id']} | <b>Video Timestamp:</b> {det['timestamp']}", normal_style),
                        Paragraph(f"<b>Object Class:</b> {det['class_name'].capitalize()} | <b>YOLO Confidence:</b> {det['confidence']:.2f}{sim_str}", normal_style),
                        Paragraph(f"<b>Attributes:</b> {attrs_str if attrs_str else 'None detected'}", normal_style),
                        Paragraph(f"<b>Source Video SHA256:</b> <font face='Courier' size='7'>{video_sha}</font>", normal_style),
                        Paragraph(f"<b>Evidence Crop SHA256:</b> <font face='Courier' size='7'>{crop_sha}</font>", normal_style)
                    ]
                ]
            ]
            
            card_table = Table(card_data, colWidths=[1.5 * inch, 5.5 * inch])
            card_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#FFFFFF")),
                ('PADDING', (0,0), (-1,-1), 8),
                ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
            ]))
            
            story.append(KeepTogether([card_table, Spacer(1, 8)]))

    story.append(Spacer(1, 20))

    # 4. Signature & Chain of Custody Certification
    story.append(Paragraph("3. Chain of Custody & Verification Seal", section_heading))
    
    sig_data = [
        [
            Paragraph("<b>Investigator Signature</b><br/><br/><br/>___________________________<br/>Officer Signature", normal_style),
            Paragraph("<b>Supervisor Verification</b><br/><br/><br/>___________________________<br/>Authorized Admin Sign-off", normal_style)
        ]
    ]
    sig_table = Table(sig_data, colWidths=[3.5 * inch, 3.5 * inch])
    sig_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'BOTTOM'),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('PADDING', (0,0), (-1,-1), 15),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#E2E8F0")),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#F7FAFC")),
    ]))
    
    story.append(KeepTogether([sig_table]))

    # Build document
    doc.build(story)
    return output_path
