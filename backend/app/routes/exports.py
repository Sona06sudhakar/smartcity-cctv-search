import os
import cv2
import json
import time
import hashlib
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.auth import get_db, get_current_user, User
from app.database import Detection, Video, ChainOfCustody, AuditLog
from app.config import VIDEOS_DIR, CROPS_DIR, REPORTS_DIR

router = APIRouter(prefix="/api/exports", tags=["Forensic Exports"])

def compute_sha256(filepath: str) -> str:
    sha256 = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(8192):
            sha256.update(chunk)
    return sha256.hexdigest()

@router.get("/clip/{detection_id}")
def export_video_clip(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch detection and video
    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Detection not found"
        )
        
    video = db.query(Video).filter(Video.id == det.video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source video not found"
        )

    src_path = VIDEOS_DIR / video.filename
    if not src_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Raw video file not found at {src_path}"
        )

    # 2. Setup output paths for clip
    clip_filename = f"clip_det_{detection_id}_{video.filename}"
    clip_path = VIDEOS_DIR / clip_filename

    # Cut 5 seconds before and 5 seconds after (10 seconds clip total), centered on the detection
    start_sec = max(0.0, det.timestamp_sec - 5.0)
    end_sec = min(video.duration, det.timestamp_sec + 5.0)

    # Use OpenCV to cut video
    cap = cv2.VideoCapture(str(src_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    
    # We will use "mp4v" codec to compile standard mp4
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    
    start_frame = int(start_sec * fps)
    end_frame = int(end_sec * fps)
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    
    out = cv2.VideoWriter(str(clip_path), fourcc, fps, (width, height))
    
    for f in range(start_frame, end_frame):
        ret, frame = cap.read()
        if not ret:
            break
        out.write(frame)
        
    out.release()
    cap.release()

    if not os.path.exists(clip_path):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate sliced clip file."
        )

    # 3. Chain of Custody Hash and Log
    clip_hash = compute_sha256(str(clip_path))
    
    # Save Chain of Custody entry
    coc_relative_path = f"/static/videos/{clip_filename}"
    coc = db.query(ChainOfCustody).filter(ChainOfCustody.file_hash == clip_hash).first()
    if not coc:
        coc = ChainOfCustody(
            file_path=coc_relative_path,
            file_hash=clip_hash,
            generated_by=current_user.username,
            file_type="clip"
        )
        db.add(coc)
        db.commit()

    # Log action
    log = AuditLog(
        username=current_user.username,
        action="DOWNLOAD_CLIP",
        query=f"Detection ID: {detection_id}",
        details=f"Exported sliced clip path: {coc_relative_path}, Hash: {clip_hash}"
    )
    db.add(log)
    db.commit()

    return {
        "url": coc_relative_path,
        "hash": clip_hash,
        "file_type": "video/mp4"
    }

@router.get("/annotated/{detection_id}")
def export_annotated_image(
    detection_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch detection
    det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not det:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Detection not found"
        )
        
    video = db.query(Video).filter(Video.id == det.video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )

    src_path = VIDEOS_DIR / video.filename
    if not src_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Raw video file not found"
        )

    # 2. Extract original frame and draw overlays
    cap = cv2.VideoCapture(str(src_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, det.frame_number)
    success, frame = cap.read()
    cap.release()

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not extract original frame from video source"
        )

    # Bounding Box Coordinates
    x1, y1, x2, y2 = det.x1, det.y1, det.x2, det.y2
    
    # Draw Green Bounding Box
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 3)

    # Prepare labels
    try:
        attrs = json.loads(det.attributes_json)
    except Exception:
        attrs = {}
        
    attr_list = [f"{k.capitalize()}: {v}" for k, v in attrs.items() if v]
    attr_str = ", ".join(attr_list)
    label_text = f"Class: {det.class_name.capitalize()} | {attr_str}"
    meta_text = f"Cam: {det.camera_id} | Time: {det.timestamp} | Frame: {det.frame_number}"

    # Draw Text Overlays (White text on black background banner for maximum visibility)
    # Get text sizes
    (l_w, l_h), _ = cv2.getTextSize(label_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
    (m_w, m_h), _ = cv2.getTextSize(meta_text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)

    # Draw Banner background at top
    cv2.rectangle(frame, (0, 0), (max(l_w, m_w) + 20, 60), (0, 0, 0), -1)
    # Overlay text
    cv2.putText(frame, meta_text, (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
    cv2.putText(frame, label_text, (10, 48), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)

    # Save to crops folder
    annotated_filename = f"annotated_det_{detection_id}.jpg"
    annotated_path = CROPS_DIR / annotated_filename
    cv2.imwrite(str(annotated_path), frame)

    # 3. Chain of Custody Hash and Log
    image_hash = compute_sha256(str(annotated_path))
    relative_path = f"/static/crops/{annotated_filename}"

    coc = db.query(ChainOfCustody).filter(ChainOfCustody.file_hash == image_hash).first()
    if not coc:
        coc = ChainOfCustody(
            file_path=relative_path,
            file_hash=image_hash,
            generated_by=current_user.username,
            file_type="annotated_image"
        )
        db.add(coc)
        db.commit()

    # Log action
    log = AuditLog(
        username=current_user.username,
        action="EXPORT_ANNOTATED",
        query=f"Detection ID: {detection_id}",
        details=f"Exported annotated image: {relative_path}, Hash: {image_hash}"
    )
    db.add(log)
    db.commit()

    return {
        "url": relative_path,
        "hash": image_hash,
        "file_type": "image/jpeg"
    }

@router.get("/stream-mjpeg/{video_id}")
def stream_mjpeg(
    video_id: int,
    start_sec: float = 0.0,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video record not found"
        )
        
    src_path = VIDEOS_DIR / video.filename
    if not src_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Video file not found at {src_path}"
        )
        
    def frame_generator():
        cap = cv2.VideoCapture(str(src_path))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        
        # Set start frame
        start_frame = int(start_sec * fps)
        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
        
        frame_delay = 1.0 / fps
        
        try:
            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break
                    
                # Downscale slightly for smooth streaming (max width 640px)
                height, width = frame.shape[:2]
                if width > 640:
                    scale = 640.0 / width
                    frame = cv2.resize(frame, (640, int(height * scale)))
                    
                # Encode frame to JPEG
                ret, jpeg = cv2.imencode('.jpg', frame)
                if not ret:
                    continue
                    
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + jpeg.tobytes() + b'\r\n')
                
                # Pace the frames
                time.sleep(frame_delay)
        finally:
            cap.release()
            
    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )
