import os
import time
import hashlib
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from app.auth import get_db, get_current_user, User
from app.database import ChainOfCustody, AuditLog, Detection, Video
from app.config import REPORTS_DIR
from app.report_gen import generate_forensic_report

router = APIRouter(prefix="/api/reports", tags=["Forensic Reports"])

class ReportRequest(BaseModel):
    query_text: str
    filters: Dict[str, Any]
    detections: List[Dict[str, Any]]
    investigator: Optional[str] = None
    investigator_notes: Optional[str] = None

def compute_sha256(filepath: str) -> str:
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()

@router.post("/generate")
def create_report(
    request: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        os.makedirs(REPORTS_DIR, exist_ok=True)
        report_filename = f"forensic_report_{int(time.time())}.pdf"
        output_path = os.path.join(REPORTS_DIR, report_filename)
        
        # Fetch SHA256 hashes for each detection and its video
        rich_detections = []
        for det_dict in request.detections:
            det_id = det_dict.get("id")
            if not det_id:
                rich_detections.append(det_dict)
                continue
                
            det_record = db.query(Detection).filter(Detection.id == det_id).first()
            if not det_record:
                rich_detections.append(det_dict)
                continue
                
            # Get video hash
            vid_record = db.query(Video).filter(Video.id == det_record.video_id).first()
            video_hash = vid_record.sha256_hash if vid_record else "Unknown"
            
            # Get crop hash from Chain of Custody
            coc_record = db.query(ChainOfCustody).filter(
                ChainOfCustody.file_path == det_record.image_path
            ).first()
            crop_hash = coc_record.file_hash if coc_record else "Unknown"
            
            # Add to dict
            det_rich = dict(det_dict)
            det_rich["video_sha256"] = video_hash
            det_rich["crop_sha256"] = crop_hash
            rich_detections.append(det_rich)
        
        # 1. Generate PDF
        generate_forensic_report(
            output_path=output_path,
            query_text=request.query_text,
            filters=request.filters,
            detections=rich_detections,
            username=current_user.username,
            investigator=request.investigator or current_user.username,
            investigator_notes=request.investigator_notes or ""
        )
        
        # 2. Verify file exists
        if not os.path.exists(output_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Report PDF generation failed."
            )
            
        # 3. Compute SHA256 of generated PDF
        pdf_hash = compute_sha256(output_path)
        relative_url = f"/static/reports/{report_filename}"
        
        # 4. Insert into Chain of Custody
        coc = ChainOfCustody(
            file_path=relative_url,
            file_hash=pdf_hash,
            generated_by=current_user.username,
            file_type="report"
        )
        db.add(coc)
        db.commit()
        
        # 5. Insert Audit Log
        log = AuditLog(
            username=current_user.username,
            action="EXPORT_REPORT",
            query=request.query_text,
            details=f"Report file: {relative_url}, PDF Hash: {pdf_hash}"
        )
        db.add(log)
        db.commit()
        
        return {
            "message": "Forensic PDF report generated successfully.",
            "url": relative_url,
            "hash": pdf_hash,
            "filename": report_filename
        }
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error compiling report: {e}"
        )
