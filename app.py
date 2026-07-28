import os
import tempfile

import cv2
import streamlit as st
import torch
from PIL import Image
from ultralytics import YOLO

try:
    from transformers import CLIPModel, CLIPProcessor
except ImportError:
    from transformers import AutoModel, AutoProcessor

    CLIPModel = AutoModel
    CLIPProcessor = AutoProcessor

# 1. Page Configuration
st.set_page_config(page_title="Smart City CCTV Search", layout="wide")
st.title("🏙️ AI-Driven Intelligent CCTV Descriptive Search")

# 2. Load Models (Cached so they only load once)
@st.cache_resource
def load_models():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    yolo = YOLO("yolov8n.pt")
    clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32").to(device)
    clip_model.eval()
    clip_processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    return yolo, clip_model, clip_processor, device


yolo_model, clip_model, clip_processor, device = load_models()

output_dir = "extracted_crops"
os.makedirs(output_dir, exist_ok=True)

# Create two clean tabs on the webpage
tab1, tab2 = st.tabs(["🎥 Video Ingestion & Tracking", "🔍 Descriptive Search Engine"])

# ==========================================
# TAB 1: VIDEO INGESTION
# ==========================================
with tab1:
    uploaded_file = st.file_uploader("Upload a CCTV video file (.avi, .mp4)...", type=["avi", "mp4"])

    if uploaded_file is not None:
        suffix = os.path.splitext(uploaded_file.name)[1] or ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tfile:
            tfile.write(uploaded_file.read())
            temp_video_path = tfile.name

        st.success("Video uploaded! Running tracking and asset extraction...")

        col1, col2 = st.columns([2, 1])
        with col1:
            video_placeholder = st.empty()
        with col2:
            log_placeholder = st.empty()

        cap = cv2.VideoCapture(temp_video_path)
        cropped_ids = set()
        log_messages = []

        frame_count = 0
        while cap.isOpened():
            success, frame = cap.read()
            if not success:
                break

            frame_count += 1
            results = yolo_model.track(frame, persist=True, verbose=False, conf=0.2, iou=0.5)

            if results[0].boxes is not None and results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                clss = results[0].boxes.cls.cpu().numpy()
                track_ids = results[0].boxes.id.cpu().numpy().astype(int)

                for box, cls, track_id in zip(boxes, clss, track_ids):
                    class_name = yolo_model.names[int(cls)]

                    if class_name in ["person", "car", "truck", "motorcycle", "bus"]:
                        if track_id not in cropped_ids:
                            x1, y1, x2, y2 = map(int, box)
                            cropped_img = frame[y1:y2, x1:x2]

                            if cropped_img.size > 0:
                                crop_filename = os.path.join(output_dir, f"{class_name}_track_{track_id}.jpg")
                                cv2.imwrite(crop_filename, cropped_img)
                                cropped_ids.add(track_id)

                                log_messages.append(f"📸 Saved: {class_name} (ID: {track_id})")
                                log_placeholder.text("\n".join(log_messages[-10:]))

            annotated_frame = results[0].plot()
            annotated_frame_rgb = cv2.cvtColor(annotated_frame, cv2.COLOR_BGR2RGB)
            video_placeholder.image(annotated_frame_rgb, channels="RGB", use_container_width=True)

        cap.release()
        if os.path.exists(temp_video_path):
            os.remove(temp_video_path)
        st.success(f"Processing complete! Extracted {len(cropped_ids)} assets from {frame_count} frames.")

# ==========================================
# TAB 2: SEARCH ENGINE
# ==========================================
with tab2:
    st.header("Search Assets via Natural Language")
    search_query = st.text_input("Type what you are looking for (e.g., 'a blue bus', 'a person in a white shirt', 'motorcycles'):")
    
    if search_query:
        # Get all currently extracted crop images
        all_crops = [os.path.join(output_dir, f) for f in os.listdir(output_dir) if f.endswith(('.jpg', '.jpeg', '.png'))]
        
        if not all_crops:
            st.warning("No extracted assets found. Please process a video in Tab 1 first!")
        else:
            st.info(f"Scanning through {len(all_crops)} extracted assets using CLIP...")

            with torch.inference_mode():
                text_inputs = clip_processor(text=[search_query], return_tensors="pt", padding=True, truncation=True)
                text_inputs = {k: v.to(device) for k, v in text_inputs.items()}
                text_features = clip_model.get_text_features(**text_inputs)
                text_features = text_features / text_features.norm(dim=-1, keepdim=True)

            results_list = []

            for img_path in all_crops:
                try:
                    image = Image.open(img_path).convert("RGB")
                    image_inputs = clip_processor(images=image, return_tensors="pt", padding=True)
                    image_inputs = {k: v.to(device) for k, v in image_inputs.items()}

                    with torch.inference_mode():
                        image_features = clip_model.get_image_features(**image_inputs)
                        image_features = image_features / image_features.norm(dim=-1, keepdim=True)

                    similarity = float((text_features @ image_features.T).item())
                    results_list.append((img_path, similarity))
                except Exception:
                    continue

            results_list = sorted(results_list, key=lambda x: x[1], reverse=True)

            st.subheader("Top Matches Found:")
            cols = st.columns(4)

            for idx, (img_path, score) in enumerate(results_list[:4]):
                with cols[idx % 4]:
                    st.image(img_path, use_container_width=True)
                    filename = os.path.basename(img_path)
                    st.caption(f"Asset: {filename}\nMatch Score: {score:.2f}")