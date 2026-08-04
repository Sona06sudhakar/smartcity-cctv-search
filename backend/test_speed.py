import time
import cv2
import torch
from ultralytics import YOLO

def main():
    print("Loading YOLO...")
    model = YOLO("yolov8n.pt")
    
    video_path = "videos/Export__Central Bus Depo-Entry Gate Platform Area_Friday July 10 2026110138  b33bb2a.avi"
    print(f"Opening video {video_path}...")
    cap = cv2.VideoCapture(video_path)
    
    start_time = time.time()
    frames = 0
    while frames < 30:
        ret, frame = cap.read()
        if not ret:
            print("Failed to read frame")
            break
        
        # Track
        results = model.track(frame, persist=True, tracker="bytetrack.yaml", verbose=False)
        frames += 1
        
    duration = time.time() - start_time
    print(f"Processed {frames} frames in {duration:.2f} seconds.")
    print(f"Average time per frame: {duration / frames:.4f} seconds.")
    cap.release()

if __name__ == "__main__":
    main()
