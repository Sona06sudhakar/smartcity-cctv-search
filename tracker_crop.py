import os
import cv2
from ultralytics import YOLO

model = YOLO("yolov8n.pt")
video_path = "sample_cctv.mp4"
cap = cv2.VideoCapture(video_path)

if not cap.isOpened():
    raise SystemExit(f"Could not open video file: {video_path}")

output_dir = "extracted_crops"
os.makedirs(output_dir, exist_ok=True)
cropped_ids = set()

print(f"Processing video: {video_path}")

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        print("Finished processing video or file not found.")
        break

    results = model.track(frame, persist=True, verbose=False, conf=0.25, iou=0.5)

    if results[0].boxes is not None and results[0].boxes.id is not None:
        boxes = results[0].boxes.xyxy.cpu().numpy()
        clss = results[0].boxes.cls.cpu().numpy()
        track_ids = results[0].boxes.id.cpu().numpy().astype(int)

        for box, cls, track_id in zip(boxes, clss, track_ids):
            class_name = model.names[int(cls)]

            if class_name in ["person", "car", "truck", "motorcycle", "bus"] and track_id not in cropped_ids:
                x1, y1, x2, y2 = map(int, box)
                cropped_img = frame[y1:y2, x1:x2]

                if cropped_img.size > 0:
                    crop_filename = os.path.join(output_dir, f"{class_name}_track_{track_id}.jpg")
                    cv2.imwrite(crop_filename, cropped_img)
                    cropped_ids.add(track_id)
                    print(f"Captured: {crop_filename}")

    annotated_frame = results[0].plot()
    cv2.imshow("Smart CCTV Ingestion", annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()
print(f"Done! Check the '{output_dir}' folder to see your cropped assets.")