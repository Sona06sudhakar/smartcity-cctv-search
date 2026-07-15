import os
import tempfile
import cv2
import streamlit as st
from ultralytics import YOLO

# 1. Page Configuration & UI Title
st.set_page_config(page_title="Smart City CCTV Search", layout="wide")
st.title("🏙️ AI-Driven Intelligent CCTV Ingestion Dashboard")
st.write("Upload an `.avi` or `.mp4` CCTV video to track objects and extract database assets.")

# Load the YOLO model once (cached so it doesn't reload on every click)
@st.cache_resource
def load_model():
    return YOLO("yolov8n.pt")

model = load_model()

# Create folder to save cropped images
output_dir = "extracted_crops"
os.makedirs(output_dir, exist_ok=True)

# 2. File Uploader Widget
uploaded_file = st.file_uploader("Choose a CCTV video file...", type=["avi", "mp4"])

if uploaded_file is not None:
    # To process the file with OpenCV, we must write the uploaded bytes to a temporary local file
    with tempfile.NamedTemporaryFile(delete=False, suffix=".avi") as tfile:
        tfile.write(uploaded_file.read())
        temp_video_path = tfile.name

    st.success("Video uploaded successfully! Initializing AI Tracking...")

    # Set up layout columns: Left for live video stream, Right for real-time crop logs
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("Live Processing Feed")
        video_placeholder = st.empty()  # This updates live with video frames

    with col2:
        st.subheader("Extracted Assets Log")
        log_placeholder = st.empty()  # This updates live with text of cropped items

    # Open video feed
    cap = cv2.VideoCapture(temp_video_path)
    cropped_ids = set()
    log_messages = []

    # Loop through the uploaded video
    while cap.isOpened():
        success, frame = cap.read()
        if not success:
            break

        # Run YOLO Tracking
        results = model.track(frame, persist=True, verbose=False)

        if results[0].boxes is not None and results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy()
            clss = results[0].boxes.cls.cpu().numpy()
            track_ids = results[0].boxes.id.cpu().numpy().astype(int)

            for box, cls, track_id in zip(boxes, clss, track_ids):
                class_name = model.names[int(cls)]

                # Track people and vehicle classes
                if class_name in ["person", "car", "truck", "motorcycle", "bus"]:
                    if track_id not in cropped_ids:
                        x1, y1, x2, y2 = map(int, box)
                        cropped_img = frame[y1:y2, x1:x2]

                        if cropped_img.size > 0:
                            # Save the cropped image
                            crop_filename = os.path.join(output_dir, f"{class_name}_track_{track_id}.jpg")
                            cv2.imwrite(crop_filename, cropped_img)
                            cropped_ids.add(track_id)
                            
                            # Add to the sidebar status log
                            log_messages.append(f"📸 Saved: {class_name} (ID: {track_id})")
                            # Only show the latest 10 logs
                            log_placeholder.text("\n".join(log_messages[-10:]))

        # Render the current frame on the Streamlit page (converting BGR to RGB)
        annotated_frame = results[0].plot()
        annotated_frame_rgb = cv2.cvtColor(annotated_frame, cv2.COLOR_BGR2RGB)
        video_placeholder.image(annotated_frame_rgb, channels="RGB", use_container_width=True)

    cap.release()
    st.balloons()
    st.success(f"Processing complete! Extracted {len(cropped_ids)} unique assets to '{output_dir}/'.")