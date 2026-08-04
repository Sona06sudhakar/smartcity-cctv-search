import json
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from PIL import Image

from app.auth import get_db, get_current_user, User
from app.database import Detection, Video, AuditLog
from app.search_engine import get_search_engine
from app.config import CROPS_DIR

router = APIRouter(prefix="/api/tracking", tags=["Cross-Camera Tracking"])

@router.get("/timeline/{detection_id}")
def get_cross_camera_timeline(
    detection_id: int,
    similarity_threshold: float = 0.78,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch the target detection
    target_det = db.query(Detection).filter(Detection.id == detection_id).first()
    if not target_det:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Detection not found"
        )
        
    # Get its corresponding video
    target_video = db.query(Video).filter(Video.id == target_det.video_id).first()
    if not target_video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Source video not found"
        )

    # 2. Extract image and get embedding
    search_engine = get_search_engine()
    # Read the crop file from static folder
    import os
    crop_name = os.path.basename(target_det.image_path)
    crop_file_path = CROPS_DIR / crop_name
    
    if not os.path.exists(crop_file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Crop image file not found at {crop_file_path}"
        )
        
    try:
        pil_image = Image.open(str(crop_file_path)).convert("RGB")
        target_embedding = search_engine.get_image_embedding(pil_image)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate embedding for target: {e}"
        )

    # 3. Fetch movement path of this exact track within the same video
    track_movement_dets = db.query(Detection).filter(
        Detection.video_id == target_det.video_id,
        Detection.track_id == target_det.track_id
    ).order_by(Detection.timestamp_sec.asc()).all()
    
    track_movement = [
        {
            "detection_id": d.id,
            "camera_id": d.camera_id,
            "video_id": d.video_id,
            "track_id": d.track_id,
            "timestamp": d.timestamp,
            "timestamp_sec": d.timestamp_sec,
            "confidence": float(d.confidence),
            "image_path": d.image_path,
            "class_name": d.class_name,
            "attributes": json.loads(d.attributes_json)
        }
        for d in track_movement_dets
    ]

    # 4. Search FAISS index for visually similar objects (Cross-Camera matching)
    scores, ids = search_engine.search(target_embedding, top_k=30)
    
    possible_matches = []
    if ids:
        # Fetch matched detections and videos
        matched_dets = db.query(Detection).filter(Detection.id.in_(ids)).all()
        matched_dets_map = {d.id: d for d in matched_dets}
        
        video_ids = list(set([d.video_id for d in matched_dets]))
        videos = db.query(Video).filter(Video.id.in_(video_ids)).all()
        videos_map = {v.id: v for v in videos}
        
        seen_entities = {}
        for score, det_id in zip(scores, ids):
            if score < similarity_threshold:
                continue
                
            det = matched_dets_map.get(det_id)
            if not det:
                continue
                
            # Exclude detections from the same video/track to make it strictly cross-camera Re-ID
            if det.video_id == target_det.video_id:
                continue
                
            vid = videos_map.get(det.video_id)
            if not vid:
                continue
                
            absolute_time = vid.upload_time + timedelta(seconds=det.timestamp_sec)
            entity_key = (det.camera_id, det.video_id, det.track_id)
            
            if entity_key in seen_entities:
                if score > seen_entities[entity_key]["similarity_score"]:
                    seen_entities[entity_key] = {
                        "detection_id": det.id,
                        "camera_id": det.camera_id,
                        "video_id": det.video_id,
                        "track_id": det.track_id,
                        "timestamp": det.timestamp,
                        "absolute_time": absolute_time,
                        "similarity_score": float(score),
                        "confidence": float(det.confidence),
                        "image_path": det.image_path,
                        "class_name": det.class_name,
                        "attributes": json.loads(det.attributes_json)
                    }
            else:
                seen_entities[entity_key] = {
                    "detection_id": det.id,
                    "camera_id": det.camera_id,
                    "video_id": det.video_id,
                    "track_id": det.track_id,
                    "timestamp": det.timestamp,
                    "absolute_time": absolute_time,
                    "similarity_score": float(score),
                    "confidence": float(det.confidence),
                    "image_path": det.image_path,
                    "class_name": det.class_name,
                    "attributes": json.loads(det.attributes_json)
                }
                
        possible_matches = list(seen_entities.values())
        possible_matches.sort(key=lambda x: x["absolute_time"])
        
        for item in possible_matches:
            item["absolute_time_str"] = item["absolute_time"].strftime("%Y-%m-%d %I:%M:%S %p")
            item.pop("absolute_time")

    # Log cross camera search
    log = AuditLog(
        username=current_user.username,
        action="CROSS_CAMERA_TRACK",
        query=f"Detection ID: {detection_id}",
        details=f"Tracked object class: {target_det.class_name}, Movement points: {len(track_movement)}, Possible matches: {len(possible_matches)}"
    )
    db.add(log)
    db.commit()

    return {
        "target": {
            "id": target_det.id,
            "camera_id": target_det.camera_id,
            "timestamp": target_det.timestamp,
            "class_name": target_det.class_name,
            "image_path": target_det.image_path
        },
        "track_movement": track_movement,
        "possible_matches": possible_matches
    }
