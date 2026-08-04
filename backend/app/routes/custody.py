import hashlib
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from app.auth import get_db, get_current_user, User
from app.database import ChainOfCustody, AuditLog

router = APIRouter(prefix="/api/custody", tags=["Chain of Custody"])

class HashVerifyRequest(BaseModel):
    file_hash: str

@router.get("", response_model=List[dict])
def list_custody_records(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    records = db.query(ChainOfCustody).order_by(ChainOfCustody.timestamp.desc()).all()
    return [
        {
            "id": r.id,
            "file_path": r.file_path,
            "file_hash": r.file_hash,
            "generated_by": r.generated_by,
            "file_type": r.file_type,
            "timestamp": r.timestamp.isoformat(),
            "verified": r.verified
        }
        for r in records
    ]

@router.post("/verify")
def verify_file_integrity(
    file_hash: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Determine the hash to check
    target_hash = ""
    
    if file:
        # Hashing the uploaded file directly
        try:
            sha256 = hashlib.sha256()
            content = file.file.read()
            sha256.update(content)
            target_hash = sha256.hexdigest()
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process file: {e}"
            )
    elif file_hash:
        target_hash = file_hash.strip().lower()
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either file or file_hash must be provided."
        )

    # Search in Chain of Custody database
    record = db.query(ChainOfCustody).filter(ChainOfCustody.file_hash == target_hash).first()
    
    # Audit log the verification query
    log = AuditLog(
        username=current_user.username,
        action="VERIFY_INTEGRITY",
        query=target_hash,
        details=f"Integrity check status: {'FOUND' if record else 'NOT_FOUND'}"
    )
    db.add(log)
    db.commit()

    if record:
        return {
            "status": "authentic",
            "message": "File integrity verified! The asset matches a registered forensic signature.",
            "file_path": record.file_path,
            "file_hash": record.file_hash,
            "generated_by": record.generated_by,
            "file_type": record.file_type,
            "export_time": record.timestamp.isoformat()
        }
    else:
        return {
            "status": "compromised_or_unregistered",
            "message": "Warning! The file has been modified or was not exported from this system. No matching signature found in the Chain of Custody database.",
            "file_hash": target_hash
        }
