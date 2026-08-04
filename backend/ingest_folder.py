import os
import shutil
import time
import sys
from pathlib import Path

# Add backend directory to path so we can import app
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from app.database import SessionLocal, Video, AuditLog
from app.config import VIDEOS_DIR
from app.pipeline import video_pipeline

SOURCE_DIR = Path(current_dir) / "videos"

def ingest_videos():
    if not SOURCE_DIR.exists():
        print(f"Directory {SOURCE_DIR} does not exist.")
        return

    video_extensions = [".mp4", ".avi", ".mov", ".mkv"]
    files = [f for f in os.listdir(SOURCE_DIR) if os.path.splitext(f)[1].lower() in video_extensions]

    if not files:
        print(f"No video files found in {SOURCE_DIR} to ingest.")
        return

    print(f"Found {len(files)} videos to ingest from {SOURCE_DIR}...")
    db = SessionLocal()
    try:
        # Fetch existing videos from DB to avoid duplicate ingestion
        existing_videos = db.query(Video).all()
        for filename in files:
            source_path = SOURCE_DIR / filename
            
            # Check if already exists in DB (comparing suffix)
            already_ingested = False
            for v in existing_videos:
                if v.filename.endswith(f"_{filename}"):
                    already_ingested = True
                    break
            
            if already_ingested:
                print(f"Skipping '{filename}' - already ingested.")
                continue
            
            # Destination path inside static/videos
            os.makedirs(VIDEOS_DIR, exist_ok=True)
            timestamp = int(time.time())
            dest_filename = f"{timestamp}_{filename}"
            dest_path = VIDEOS_DIR / dest_filename
            
            print(f"\nProcessing '{filename}'...")
            print(f"Copying to static store: {dest_path}")
            shutil.copy2(source_path, dest_path)
            
            # Use filename prefix as camera_id or default to CAM_IMPORT
            # e.g., CAM01_test.mp4 -> CAM01
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
            
            print(f"Registered video in database (ID: {video.id}, Camera: {camera_id})")
            
            # Log audit trail
            log = AuditLog(
                username="system_cli",
                action="VIDEO_IMPORT_CLI",
                query=filename,
                details=f"Imported from backend/videos. Camera: {camera_id}. Database ID: {video.id}"
            )
            db.add(log)
            db.commit()
            
            # Run pipeline
            print("Running tracking pipeline (YOLOv8 + CLIP embeddings)...")
            video_pipeline.process_video_background(
                video_id=video.id,
                file_path=str(dest_path),
                camera_id=camera_id
            )
            
            # Refresh to get status
            db.refresh(video)
            print(f"Completed processing '{filename}'. Status: {video.status}")
            
            # Do NOT remove original file to keep live datasets intact in backend/videos
            print(f"Kept original file at {source_path}")
                
    finally:
        db.close()

if __name__ == "__main__":
    ingest_videos()
