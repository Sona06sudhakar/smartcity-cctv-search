import os
import cv2
from ultralytics import YOLO

# 1. Load the YOLOv8 model
model = YOLO("yolov8n.pt")

# 2. Specify your video file path here!
# (Replace "sample_cctv.mp4" with the actual name of your video file)
video_path = "sample_cctv.mp4" 
cap = cv2.VideoCapture(video_path)

# Create a folder to save our cropped images
output_dir = "extracted_crops"
os.makedirs(output_dir, exist_ok=True)

# This set will keep track of unique IDs we've already cropped
# to prevent saving the same car/person 100 times.
cropped_ids = set()

print(f"Processing video: {video_path}. Press 'q' to stop.")

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        print("Finished processing video or file not found.")
        break

    # 3. Track objects in the frame
    results = model.track(frame, persist=True, verbose=False)

    # Check if we actually detected any tracked objects
    if results[0].boxes is not None and results[0].boxes.id is not None:
        boxes = results[0].boxes.xyxy.cpu().numpy()  # Bounding box coordinates [x1, y1, x2, y2]
        clss = results[0].boxes.cls.cpu().numpy()    # Class labels (0 = person, 2 = car, etc.)
        track_ids = results[0].boxes.id.cpu().numpy().astype(int)  # Unique tracking IDs

        # 4. Loop through detected objects in the current frame
        for box, cls, track_id in zip(boxes, clss, track_ids):
            class_name = model.names[int(cls)]

            # Only care about people and vehicles for smart city CCTV
            if class_name in ["person", "car", "truck", "motorcycle", "bus"]:
                
                # If we haven't cropped this specific tracking ID yet:
                if track_id not in cropped_ids:
                    x1, y1, x2, y2 = map(int, box)
                    
                    # Crop the object out of the frame
                    cropped_img = frame[y1:y2, x1:x2]

                    # Ensure the crop is valid (not empty)
                    if cropped_img.size > 0:
                        # Save image with a clear name: e.g., "extracted_crops/car_track_4.jpg"
                        crop_filename = os.path.join(output_dir, f"{class_name}_track_{track_id}.jpg")
                        cv2.imwrite(crop_filename, cropped_img)
                        
                        # Add tracking ID to our set so we don't crop it again
                        cropped_ids.add(track_id)
                        print(f"Captured: {crop_filename}")

    # 5. Display the tracking feed in real-time
    annotated_frame = results[0].plot()
    cv2.imshow("Smart CCTV Ingestion", annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
print(f"Done! Check the '{output_dir}' folder to see your cropped assets.")