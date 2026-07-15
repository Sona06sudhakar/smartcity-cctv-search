import cv2
from ultralytics import YOLO

# 1. Load the pre-trained YOLOv8 model (Nano version is super fast and lightweight)
model = YOLO("yolov8n.pt")

# 2. Open the video source. 
# Use 0 for your laptop's built-in webcam.
# Or replace with a path to a video: "traffic_sample.mp4"
cap = cv2.VideoCapture(0)

# Loop over the frames from the video feed
while cap.isOpened():
    success, frame = cap.read()
    
    if not success:
        print("End of video stream or cannot open camera.")
        break

    # 3. Use YOLO's built-in tracker (uses BoT-SORT/ByteTRACK under the hood)
    # persist=True ensures the model remembers track IDs across frames
    results = model.track(frame, persist=True)

    # 4. Plot the results directly on the current frame
    # This automatically draws boxes, labels, and tracking IDs
    annotated_frame = results[0].plot()

    # 5. Display the annotated frame in a window
    cv2.imshow("YOLOv8 Tracking - Press 'q' to Exit", annotated_frame)

    # Stop the loop if the 'q' key is pressed
    if cv2.waitKey(1) & 0xFF == ord("q"):
        break

# Clean up and close all windows
cap.release()
cv2.destroyAllWindows()