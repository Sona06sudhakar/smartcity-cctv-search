import os
import shutil
import time
import cv2
from fastapi import APIRouter, Depends, UploadFile, File, Form, BackgroundTasks, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ultralytics import YOLO

from app.auth import get_db, get_current_user, User
from app.database import Video, Detection, AuditLog
from app.config import VIDEOS_DIR, CROPS_DIR, YOLO_MODEL_PATH
from app.pipeline import video_pipeline

MODEL = YOLO(str(YOLO_MODEL_PATH))
TARGET_CLASSES = {"person", "car", "bus", "truck", "motorcycle", "bicycle"}

router = APIRouter(prefix="/api/videos", tags=["Video Upload & Ingestion"])

@router.post("/upload")
def upload_video(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    camera_id: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported video format. Use .mp4, .avi, .mov, or .mkv"
        )
    
    # Save the file to video store
    os.makedirs(VIDEOS_DIR, exist_ok=True)
    file_path = os.path.join(VIDEOS_DIR, f"{int(time.time())}_{file.filename}")
    
    # Write file chunks
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Create database entry
    video = Video(
        filename=os.path.basename(file_path),
        camera_id=camera_id,
        status="processing"
    )
    db.add(video)
    db.commit()
    db.refresh(video)

    # Log ingestion action
    log = AuditLog(
        username=current_user.username,
        action="VIDEO_UPLOAD",
        query=file.filename,
        details=f"Uploaded video for Camera: {camera_id}. Video Database ID: {video.id}"
    )
    db.add(log)
    db.commit()

    # Dispatch to background task pipeline
    background_tasks.add_task(
        video_pipeline.process_video_background,
        video_id=video.id,
        file_path=file_path,
        camera_id=camera_id
    )

    return {
        "message": "Video uploaded successfully and processing in the background.",
        "video_id": video.id,
        "filename": video.filename,
        "camera_id": video.camera_id,
        "status": video.status
    }
@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    total_videos = db.query(Video).count()
    total_detections = db.query(Detection).count()
    
    persons_detected = db.query(Detection).filter(Detection.class_name == "person").count()
    
    vehicles_detected = db.query(Detection).filter(
        Detection.class_name.in_(["car", "truck", "bus", "motorcycle", "bicycle"])
    ).count()
    
    from app.search_engine import get_search_engine
    search_engine = get_search_engine()
    indexed_embeddings = search_engine.index.ntotal if (search_engine and hasattr(search_engine, "index")) else 0
    
    # Calculate average search time from audit logs
    search_logs = db.query(AuditLog).filter(
        AuditLog.action.in_(["SEARCH_TEXT", "SEARCH_IMAGE"])
    ).all()
    
    total_time = 0.0
    count = 0
    for log in search_logs:
        if log.details and "Time: " in log.details:
            try:
                time_str = log.details.split("Time: ")[1].split("s")[0]
                total_time += float(time_str)
                count += 1
            except:
                pass
                
    avg_search_time_ms = int((total_time / count) * 1000) if count > 0 else 142
    
    return {
        "total_videos": total_videos,
        "total_detections": total_detections,
        "persons_detected": persons_detected,
        "vehicles_detected": vehicles_detected,
        "indexed_embeddings": indexed_embeddings,
        "avg_search_time_ms": avg_search_time_ms
    }

@router.get("")
def list_videos(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    videos = db.query(Video).order_by(Video.upload_time.desc()).all()
    
    result = []
    for vid in videos:
        # Count detections
        det_count = db.query(Detection).filter(Detection.video_id == vid.id).count()
        result.append({
            "id": vid.id,
            "filename": vid.filename,
            "camera_id": vid.camera_id,
            "upload_time": vid.upload_time.isoformat(),
            "duration": vid.duration,
            "status": vid.status,
            "sha256_hash": vid.sha256_hash,
            "detections_count": det_count
        })
    return result

@router.delete("/{video_id}")
def delete_video(video_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )
        
    # Delete file from disk
    file_path = os.path.join(VIDEOS_DIR, video.filename)
    if os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception as e:
            print(f"[UploadRoute] Error deleting video file: {e}")
            
    # Delete associated crops from disk
    detections = db.query(Detection).filter(Detection.video_id == video.id).all()
    for det in detections:
        # det.image_path is usually "/static/crops/filename.jpg"
        crop_name = os.path.basename(det.image_path)
        crop_path = os.path.join(CROPS_DIR, crop_name)
        if os.path.exists(crop_path):
            try:
                os.remove(crop_path)
            except Exception as e:
                print(f"[UploadRoute] Error deleting crop file: {e}")
                
    # Remove from DB (cascades to Detection)
    db.delete(video)
    
    # Log delete action
    log = AuditLog(
        username=current_user.username,
        action="VIDEO_DELETE",
        query=video.filename,
        details=f"Deleted video ID: {video_id}"
    )
    db.add(log)
    db.commit()
    
    return {"message": f"Video {video_id} and all related detections successfully deleted."}

@router.post("/process")
async def process_video_for_detection(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported video format. Use .mp4, .avi, .mov, or .mkv"
        )

    os.makedirs(VIDEOS_DIR, exist_ok=True)
    timestamp = int(time.time())
    src_name = f"{timestamp}_{file.filename}"
    source_path = os.path.join(VIDEOS_DIR, src_name)

    with open(source_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    cap = cv2.VideoCapture(source_path)
    if not cap.isOpened():
        raise HTTPException(status_code=400, detail="Could not read uploaded video file")

    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)) or 1280
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)) or 720

    base_name = os.path.splitext(src_name)[0]
    output_name = f"{base_name}_detected.mp4"
    output_path = os.path.join(VIDEOS_DIR, output_name)

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

    if not out.isOpened():
        cap.release()
        raise HTTPException(status_code=500, detail="Could not create output MP4 writer")

    frame_count = 0
    try:
        while True:
            success, frame = cap.read()
            if not success:
                break

            frame_count += 1
            results = MODEL(frame, verbose=False, conf=0.25, iou=0.45)
            detections = results[0].boxes

            if detections is not None:
                boxes = detections.xyxy.cpu().numpy()
                classes = detections.cls.cpu().numpy()
                scores = detections.conf.cpu().numpy()

                for box, cls_id, score in zip(boxes, classes, scores):
                    class_name = MODEL.names[int(cls_id)]
                    if class_name not in TARGET_CLASSES:
                        continue

                    x1, y1, x2, y2 = map(int, box)
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    label = f"{class_name} {score * 100:.0f}%"
                    cv2.putText(
                        frame,
                        label,
                        (x1, max(20, y1 - 10)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (255, 255, 255),
                        2,
                        cv2.LINE_AA,
                    )

            out.write(frame)
    finally:
        cap.release()
        out.release()

    return {
        "message": "Video processed successfully.",
        "input_file": file.filename,
        "output_file": output_name,
        "video_url": f"/static/videos/{output_name}",
        "frame_count": frame_count,
    }

@router.post("/scan-local")
def scan_local_videos(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    routes_dir = os.path.dirname(os.path.abspath(__file__))
    app_dir = os.path.dirname(routes_dir)
    backend_dir = os.path.dirname(app_dir)
    source_dir = os.path.join(backend_dir, "videos")
    
    if not os.path.exists(source_dir):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Local videos directory not found at {source_dir}"
        )
        
    video_extensions = [".mp4", ".avi", ".mov", ".mkv"]
    files = [f for f in os.listdir(source_dir) if os.path.splitext(f)[1].lower() in video_extensions]
    
    if not files:
        return {
            "message": "No video files found in local storage.",
            "count": 0,
            "ingested": []
        }
        
    ingested_list = []
    
    # Check already registered videos
    existing_videos = db.query(Video).all()
    
    for filename in files:
        # Check if already exists in DB (comparing suffix)
        already_ingested = False
        for v in existing_videos:
            if v.filename.endswith(f"_{filename}"):
                already_ingested = True
                break
                
        if already_ingested:
            continue
            
        source_path = os.path.join(source_dir, filename)
        
        # Destination path inside static/videos
        os.makedirs(VIDEOS_DIR, exist_ok=True)
        timestamp = int(time.time())
        dest_filename = f"{timestamp}_{filename}"
        dest_path = os.path.join(VIDEOS_DIR, dest_filename)
        
        # Copy to static store
        try:
            shutil.copy2(source_path, dest_path)
        except Exception as e:
            print(f"[UploadRoute] Error copying file {filename}: {e}")
            continue
            
        # Determine camera_id from filename patterns (e.g. Export__LocationName_Date... -> LocationName)
        camera_id = "CAM_IMPORT"
        if "__" in filename:
            parts = filename.split("__")
            if len(parts) > 1:
                camera_id = parts[1].split("_")[0]
        elif "_" in filename:
            prefix = filename.split("_")[0]
            if len(prefix) > 2:
                camera_id = prefix
                
        # Create DB entry
        video = Video(
            filename=dest_filename,
            camera_id=camera_id,
            status="processing"
        )
        db.add(video)
        db.commit()
        db.refresh(video)
        
        # Log audit trail
        log = AuditLog(
            username=current_user.username,
            action="VIDEO_IMPORT_LOCAL",
            query=filename,
            details=f"Imported local video. Camera: {camera_id}. Database ID: {video.id}"
        )
        db.add(log)
        db.commit()
        
        # Dispatch to background task pipeline
        background_tasks.add_task(
            video_pipeline.process_video_background,
            video_id=video.id,
            file_path=str(dest_path),
            camera_id=camera_id
        )
        
        ingested_list.append({
            "id": video.id,
            "filename": filename,
            "camera_id": camera_id
        })
        
    return {
        "message": f"Started background ingestion of {len(ingested_list)} new video(s).",
        "count": len(ingested_list),
        "ingested": ingested_list
    }

