from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.config import STATIC_DIR
from app.database import init_db, SessionLocal
from app.auth import seed_users

# Import routers
from app.routes.auth import router as auth_router
from app.routes.upload import router as upload_router
from app.routes.search import router as search_router
from app.routes.tracking import router as tracking_router
from app.routes.exports import router as exports_router
from app.routes.audit import router as audit_router
from app.routes.custody import router as custody_router

# Initialize database
init_db()

# Seed default credentials (admin / officer)
db = SessionLocal()
try:
    seed_users(db)
finally:
    db.close()

app = FastAPI(
    title="Smart City CCTV Search API",
    description="Backend services for real-time object tracking, attribute extraction, and vector-based forensic search",
    version="1.0.0"
)

# Enable CORS for React Frontend development server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local dev ease; can lock down to localhost in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directories exist
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "crops"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "videos"), exist_ok=True)
os.makedirs(os.path.join(STATIC_DIR, "reports"), exist_ok=True)

# Mount static files to serve cropped assets, sliced clips, and PDF reports
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Register routers
app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(search_router)
app.include_router(tracking_router)
app.include_router(exports_router)
app.include_router(audit_router)
app.include_router(custody_router)

@app.get("/")
def read_root():
    return {
        "status": "healthy",
        "system": "AI-Driven Intelligent CCTV Search (SIH)"
    }
