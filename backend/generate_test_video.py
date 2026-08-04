import cv2
import numpy as np
import os

crop_dir = "extracted_crops"
person_path = os.path.join(crop_dir, "person_track_11.jpg")
bus_path = os.path.join(crop_dir, "bus_track_1.jpg")

person_img = cv2.imread(person_path)
bus_img = cv2.imread(bus_path)

if person_img is None:
    print(f"Warning: could not load {person_path}. Generating mock block for person.")
    person_img = np.zeros((120, 60, 3), dtype=np.uint8)
    person_img[:] = (0, 255, 0) # Green box
    
if bus_img is None:
    print(f"Warning: could not load {bus_path}. Generating mock block for bus.")
    bus_img = np.zeros((150, 250, 3), dtype=np.uint8)
    bus_img[:] = (0, 0, 255) # Red box

# Video settings
width, height = 640, 480
fps = 20
num_frames = 80 # 4 seconds of video

output_video_path = "test_cctv.mp4"
out = cv2.VideoWriter(output_video_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

print("Generating synthetic video frame sequence...")
for f in range(num_frames):
    # Gray background
    frame = np.zeros((height, width, 3), dtype=np.uint8)
    frame[:] = (45, 45, 45)
    
    # Overlay location text at the top
    cv2.putText(frame, "CAM_01 - STATION MAIN ENTRANCE", (20, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (240, 240, 240), 2)
    cv2.putText(frame, f"TIMESTAMP: 2026-07-28 18:40:{(33 + f//fps):02d}", (20, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)

    # 1. Overlay person walking from left to right
    ph, pw, _ = person_img.shape
    px = 30 + f * 4
    py = 220
    if py + ph < height and px + pw < width:
        frame[py:py+ph, px:px+pw] = person_img

    # 2. Overlay bus moving from right to left
    bh, bw, _ = bus_img.shape
    bx = 350 - f * 3
    by = 90
    if by + bh < height and bx + bw < width and bx >= 0:
        frame[by:by+bh, bx:bx+bw] = bus_img

    out.write(frame)

out.release()
print(f"Successfully generated {output_video_path}!")
