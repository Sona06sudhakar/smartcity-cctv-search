import os
import sys
from pathlib import Path

# Add backend directory to path so we can import app
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from app.database import SessionLocal, Video, Detection, ChainOfCustody
from app.pipeline import video_pipeline
from app.config import VIDEOS_DIR

def reprocess():
    db = SessionLocal()
    try:
        # Get all videos except the E2E test videos
        videos = db.query(Video).filter(Video.id >= 3).all()
        print(f"Found {len(videos)} Surat Smart City videos to reprocess.")
        
        for video in videos:
            print(f"\n--- Reprocessing Video {video.id}: {video.filename} (Cam: {video.camera_id}) ---")
            
            # 1. Delete existing detections for this video
            deleted_count = db.query(Detection).filter(Detection.video_id == video.id).delete()
            db.commit()
            print(f"Deleted {deleted_count} old detections from DB.")
            
            # 2. Reset status to processing
            video.status = "processing"
            db.commit()
            
            # 3. Path to file
            file_path = VIDEOS_DIR / video.filename
            if not file_path.exists():
                print(f"ERROR: Video file not found at {file_path}")
                continue
                
            # 4. Run pipeline with frame_skip = 20
            print("Running tracking pipeline with frame_skip = 20...")
            video_pipeline.process_video_background(
                video_id=video.id,
                file_path=str(file_path),
                camera_id=video.camera_id,
                frame_skip=20
            )
            
            db.refresh(video)
            print(f"Finished. Status: {video.status}")
            
    finally:
        db.close()

if __name__ == "__main__":
    reprocess()
