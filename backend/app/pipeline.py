import os
import cv2
import json
import time
import hashlib
from datetime import datetime, timedelta
from typing import Dict, List, Set, Tuple
from sqlalchemy.orm import Session
from PIL import Image
import numpy as np

from app.config import (
    CROPS_DIR,
    VIDEOS_DIR,
    YOLO_MODEL_NAME,
    YOLO_MODEL_PATH,
    REID_SIMILARITY_THRESHOLD
)
from app.database import Video, Detection, TrackPoint, SessionLocal, ChainOfCustody
from app.search_engine import get_search_engine
from app.attributes import extract_attributes
from ultralytics import YOLO

class VideoPipeline:
    def __init__(self):
        # Lazy loading of YOLO
        self.model = None

    def _load_yolo(self):
        if self.model is None:
            model_path = str(YOLO_MODEL_PATH)
            print(f"[Pipeline] Loading YOLO model from {model_path}...")
            self.model = YOLO(model_path)
        return self.model

    def compute_sha256(self, filepath: str) -> str:
        sha256 = hashlib.sha256()
        with open(filepath, "rb") as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()

    def process_video_background(self, video_id: int, file_path: str, camera_id: str, frame_skip: int = 20):
        db: Session = SessionLocal()
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            db.close()
            print(f"[Pipeline] Video with ID {video_id} not found in database.")
            return

        try:
            yolo = self._load_yolo()
            search_engine = get_search_engine()
            
            # Compute file hash for Chain of Custody
            video_hash = self.compute_sha256(file_path)
            video.sha256_hash = video_hash
            db.commit()

            cap = cv2.VideoCapture(file_path)
            if not cap.isOpened():
                raise ValueError(f"Could not open video file: {file_path}")

            # Get video specs
            fps = cap.get(cv2.CAP_PROP_FPS)
            if fps <= 0:
                fps = 25.0
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            duration = total_frames / fps
            
            video.duration = duration
            db.commit()

            print(f"[Pipeline] Processing video {video.filename} (Cam: {camera_id}, Frames: {total_frames}, FPS: {fps})")

            # Track management for Re-ID and tracking
            # We want to keep track of cropped objects to run Re-ID on new track ids
            # lost_tracks: {track_id: {"embedding": ndarray, "last_seen_time": datetime, "class_name": str}}
            lost_tracks: Dict[int, Dict] = {}
            # track_id_mapping: {raw_track_id: active_merged_track_id}
            track_id_mapping: Dict[int, int] = {}
            # processed_tracks: set of track ids that have already had their crop, embedding & attributes extracted
            processed_tracks: Set[int] = set()

            # We'll save a high-quality crop for each tracked object
            # track_best_crops: {mapped_track_id: {"score": float, "box": Tuple, "frame": ndarray, "timestamp": str, "frame_num": int}}
            track_best_crops: Dict[int, Dict] = {}

            # track_path_points: store a sequence of bounding boxes for each mapped track across processed frames
            track_path_points: Dict[int, List[Dict]] = {}

            frame_num = 0
            start_time = datetime.utcnow()

            while cap.isOpened():
                success, frame = cap.read()
                if not success:
                    break

                frame_num += 1
                if frame_num % frame_skip != 0:
                    continue
                
                # Run YOLO tracking using ByteTrack
                results = yolo.track(
                    frame,
                    persist=True,
                    tracker="bytetrack.yaml",
                    verbose=False,
                    conf=0.25,
                    iou=0.45
                )

                # Skip if no detections or tracking ids
                if results[0].boxes is None or results[0].boxes.id is None:
                    continue

                boxes = results[0].boxes.xyxy.cpu().numpy()
                clss = results[0].boxes.cls.cpu().numpy()
                track_ids = results[0].boxes.id.cpu().numpy().astype(int)
                confidences = results[0].boxes.conf.cpu().numpy()

                current_timestamp_sec = frame_num / fps
                # Convert to HH:MM:SS format
                hours = int(current_timestamp_sec // 3600)
                minutes = int((current_timestamp_sec % 3600) // 60)
                seconds = int(current_timestamp_sec % 60)
                timestamp_str = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

                active_tracks_this_frame = set(track_ids)

                for box, cls, raw_track_id, conf in zip(boxes, clss, track_ids, confidences):
                    class_name = yolo.names[int(cls)]
                    
                    # We are only interested in person, vehicles
                    if class_name not in ["person", "car", "truck", "motorcycle", "bus", "bicycle"]:
                        continue

                    # 1. Resolve Track ID Merges (Re-ID) if this raw_track_id is new
                    if raw_track_id not in track_id_mapping:
                        x1, y1, x2, y2 = map(int, box)
                        crop_img = frame[y1:y2, x1:x2]
                        
                        mapped_id = raw_track_id  # default
                        
                        if crop_img.size > 0:
                            # Convert to PIL
                            pil_crop = Image.fromarray(cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB))
                            new_emb = search_engine.get_image_embedding(pil_crop)
                            
                            # Check similarity with recently lost tracks of the same class
                            best_match_id = None
                            best_score = -1.0
                            
                            # Clean up old lost tracks (older than 10 seconds of video time or real time)
                            now = datetime.utcnow()
                            expired_ids = [
                                tid for tid, data in lost_tracks.items()
                                if (now - data["last_seen_real"]).total_seconds() > 30
                            ]
                            for tid in expired_ids:
                                lost_tracks.pop(tid, None)

                            for tid, data in lost_tracks.items():
                                if data["class_name"] == class_name:
                                    # Cosine similarity (dot product of normalized embeddings)
                                    sim = float(np.dot(new_emb, data["embedding"]))
                                    if sim > best_score:
                                        best_score = sim
                                        best_match_id = tid
                            
                            if best_score >= REID_SIMILARITY_THRESHOLD and best_match_id is not None:
                                mapped_id = best_match_id
                                print(f"[Pipeline] Re-ID Match! Raw ID {raw_track_id} merged into existing Track {mapped_id} (Similarity: {best_score:.2f})")
                                # Remove from lost tracks since it's active again
                                lost_tracks.pop(best_match_id, None)
                            
                        track_id_mapping[raw_track_id] = mapped_id
                    else:
                        mapped_id = track_id_mapping[raw_track_id]

                    x1, y1, x2, y2 = map(int, box)
                    box_width = x2 - x1
                    box_height = y2 - y1
                    area = box_width * box_height
                    
                    if area > 100:
                        # Record the track point for this mapped track
                        track_path_points.setdefault(mapped_id, []).append({
                            "frame_number": frame_num,
                            "timestamp": timestamp_str,
                            "timestamp_sec": current_timestamp_sec,
                            "x1": x1,
                            "y1": y1,
                            "x2": x2,
                            "y2": y2,
                            "class_name": class_name,
                            "confidence": float(conf)
                        })

                        if mapped_id not in track_best_crops or conf > track_best_crops[mapped_id]["score"]:
                            track_best_crops[mapped_id] = {
                                "score": float(conf),
                                "box": (x1, y1, x2, y2),
                                "frame": frame.copy(),
                                "timestamp": timestamp_str,
                                "timestamp_sec": current_timestamp_sec,
                                "frame_num": frame_num,
                                "class_name": class_name
                            }

                # Handle tracks that were lost in this frame
                for raw_tid, mapped_tid in list(track_id_mapping.items()):
                    if raw_tid not in active_tracks_this_frame:
                        # This track is lost in the current frame. Save to lost_tracks if we have its best crop
                        if mapped_tid in track_best_crops and mapped_tid not in lost_tracks:
                            best_crop_data = track_best_crops[mapped_tid]
                            # Generate embedding for lost track match
                            x1, y1, x2, y2 = best_crop_data["box"]
                            crop_img = best_crop_data["frame"][y1:y2, x1:x2]
                            if crop_img.size > 0:
                                pil_crop = Image.fromarray(cv2.cvtColor(crop_img, cv2.COLOR_BGR2RGB))
                                emb = search_engine.get_image_embedding(pil_crop)
                                lost_tracks[mapped_tid] = {
                                    "embedding": emb,
                                    "last_seen_real": datetime.utcnow(),
                                    "class_name": best_crop_data["class_name"]
                                }
                        # Remove mapping so if raw_tid appears again it gets reassessed
                        track_id_mapping.pop(raw_tid, None)

            cap.release()

            # 3. Post-process the best crop for each mapped track and ingest it
            print(f"[Pipeline] Processing crops & extracting attributes for {len(track_best_crops)} unique tracks...")

            detections = []
            for mapped_id, crop_data in track_best_crops.items():
                x1, y1, x2, y2 = crop_data["box"]
                best_frame = crop_data["frame"]
                class_name = crop_data["class_name"]

                cropped_img = best_frame[y1:y2, x1:x2]
                if cropped_img.size == 0:
                    continue

                # Save crop image to disk
                crop_filename = f"vid_{video_id}_cam_{camera_id}_track_{mapped_id}.jpg"
                crop_path = CROPS_DIR / crop_filename
                cv2.imwrite(str(crop_path), cropped_img)

                # Get SHA256 of crop for Chain of Custody
                crop_hash = self.compute_sha256(str(crop_path))

                # Load PIL image for CLIP processing
                pil_crop = Image.fromarray(cv2.cvtColor(cropped_img, cv2.COLOR_BGR2RGB))

                # Generate embedding
                embedding = search_engine.get_image_embedding(pil_crop)

                # Extract attributes via CLIP
                attributes = extract_attributes(str(crop_path), class_name, search_engine)

                detection = Detection(
                    video_id=video_id,
                    camera_id=camera_id,
                    timestamp=crop_data["timestamp"],
                    timestamp_sec=crop_data["timestamp_sec"],
                    frame_number=crop_data["frame_num"],
                    track_id=int(mapped_id),
                    class_name=class_name,
                    x1=x1,
                    y1=y1,
                    x2=x2,
                    y2=y2,
                    confidence=crop_data["score"],
                    image_path=f"/static/crops/{crop_filename}",
                    attributes_json=json.dumps(attributes),
                    faiss_id=-1  # Temporary placeholder
                )
                db.add(detection)
                db.flush()  # Gets the auto-increment ID

                detection.faiss_id = detection.id
                detections.append(detection)
                db.commit()

                # Add to FAISS Vector Database
                search_engine.add_vector(embedding, detection.id)

                # Add to Chain of Custody
                coc = db.query(ChainOfCustody).filter(ChainOfCustody.file_hash == crop_hash).first()
                if not coc:
                    coc = ChainOfCustody(
                        file_path=detection.image_path,
                        file_hash=crop_hash,
                        generated_by="system",
                        file_type="crop"
                    )
                    db.add(coc)
                    db.commit()

            # Persist the track points for each mapped detection so playback and timelines can follow the same object
            track_point_rows = []
            for detection in detections:
                points = track_path_points.get(detection.track_id, [])
                for point in points:
                    track_point_rows.append(TrackPoint(
                        detection_id=detection.id,
                        video_id=video_id,
                        track_id=detection.track_id,
                        frame_number=point["frame_number"],
                        timestamp=point["timestamp"],
                        timestamp_sec=point["timestamp_sec"],
                        x1=point["x1"],
                        y1=point["y1"],
                        x2=point["x2"],
                        y2=point["y2"],
                        class_name=point["class_name"],
                        confidence=point["confidence"]
                    ))
            if track_point_rows:
                db.add_all(track_point_rows)
                db.commit()

            # Mark video processing completed
            video.status = "completed"
            db.commit()
            print(f"[Pipeline] Video {video_id} processed successfully. Created {len(track_best_crops)} detections.")

        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[Pipeline] Error processing video {video_id}: {e}")
            video.status = "failed"
            db.commit()

        finally:
            db.close()

# Global pipeline instance
video_pipeline = VideoPipeline()
