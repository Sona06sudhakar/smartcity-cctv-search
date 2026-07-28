import cv2
from ultralytics import YOLO

model = YOLO("yolov8n.pt")
cap = cv2.VideoCapture(0)

if not cap.isOpened():
    raise SystemExit("Could not open the camera. Check that a webcam is available.")

while cap.isOpened():
    success, frame = cap.read()
    if not success:
        print("End of video stream or cannot open camera.")
        break

    results = model.track(frame, persist=True, verbose=False, conf=0.25, iou=0.5)
    annotated_frame = results[0].plot()
    cv2.imshow("YOLOv8 Tracking - Press 'q' to Exit", annotated_frame)

    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

cap.release()
cv2.destroyAllWindows()