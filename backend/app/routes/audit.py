from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.auth import get_db, get_current_user, require_admin, User
from app.database import AuditLog

router = APIRouter(prefix="/api/audit", tags=["Audit Logging"])

@router.get("", response_model=List[dict])
def get_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retrieve audit logs sorted by latest first
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    
    return [
        {
            "id": log.id,
            "username": log.username,
            "action": log.action,
            "query": log.query,
            "timestamp": log.timestamp.isoformat(),
            "details": log.details
        }
        for log in logs
    ]

# Admin endpoint to clear audit logs (useful for maintenance)
@router.delete("/clear")
def clear_audit_logs(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    try:
        db.query(AuditLog).delete()
        db.commit()
        return {"message": "Audit logs cleared successfully."}
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear audit logs: {e}"
        )
