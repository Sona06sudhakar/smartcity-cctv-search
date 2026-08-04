import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
CROPS_DIR = STATIC_DIR / "crops"
VIDEOS_DIR = STATIC_DIR / "videos"
REPORTS_DIR = STATIC_DIR / "reports"

# Ensure all resource directories exist
for directory in [STATIC_DIR, CROPS_DIR, VIDEOS_DIR, REPORTS_DIR]:
    directory.mkdir(parents=True, exist_ok=True)

# Database
DB_PATH = BASE_DIR / "db.sqlite3"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

# FAISS Vector Index
FAISS_INDEX_PATH = STATIC_DIR / "faiss.index"

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "smart_city_cctv_forensic_secret_key_sih_2026")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

# AI Configuration
DEVICE = "cuda"  # Will dynamically check torch.cuda.is_available() at model load
YOLO_MODEL_NAME = "yolov8n.pt"  # Lightweight for low latency, or yolov8m.pt if available
CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"

# CLIP Attribute Thresholds
CLIP_MATCH_THRESHOLD = 0.25
REID_SIMILARITY_THRESHOLD = 0.82
