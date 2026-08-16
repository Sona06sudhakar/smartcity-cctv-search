import datetime
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Boolean, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from app.config import SQLALCHEMY_DATABASE_URL

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="officer")  # "admin" or "officer"

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    camera_id = Column(String, index=True, nullable=False)
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    duration = Column(Float, default=0.0)
    status = Column(String, default="processing")  # "processing", "completed", "failed"
    sha256_hash = Column(String, nullable=True)

    detections = relationship("Detection", back_populates="video", cascade="all, delete-orphan")

class Detection(Base):
    __tablename__ = "detections"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    camera_id = Column(String, index=True, nullable=False)
    timestamp = Column(String, nullable=False)  # HH:MM:SS format format inside video
    timestamp_sec = Column(Float, nullable=False)  # Seconds offset
    frame_number = Column(Integer, nullable=False)
    track_id = Column(Integer, index=True, nullable=False)
    class_name = Column(String, index=True, nullable=False)
    x1 = Column(Integer, nullable=False)
    y1 = Column(Integer, nullable=False)
    x2 = Column(Integer, nullable=False)
    y2 = Column(Integer, nullable=False)
    confidence = Column(Float, nullable=False)
    image_path = Column(String, nullable=False)
    attributes_json = Column(String, nullable=False)  # Store serialized JSON attributes
    faiss_id = Column(Integer, index=True, unique=True, nullable=False)

    video = relationship("Video", back_populates="detections")
    track_points = relationship("TrackPoint", back_populates="detection", cascade="all, delete-orphan")

class TrackPoint(Base):
    __tablename__ = "track_points"

    id = Column(Integer, primary_key=True, index=True)
    detection_id = Column(Integer, ForeignKey("detections.id"), nullable=False)
    video_id = Column(Integer, ForeignKey("videos.id"), nullable=False)
    track_id = Column(Integer, index=True, nullable=False)
    timestamp = Column(String, nullable=False)
    timestamp_sec = Column(Float, nullable=False)
    frame_number = Column(Integer, nullable=False)
    x1 = Column(Integer, nullable=False)
    y1 = Column(Integer, nullable=False)
    x2 = Column(Integer, nullable=False)
    y2 = Column(Integer, nullable=False)
    class_name = Column(String, index=True, nullable=False)
    confidence = Column(Float, nullable=False)

    detection = relationship("Detection", back_populates="track_points")
    video = relationship("Video")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True, nullable=False)
    action = Column(String, nullable=False)  # e.g., "SEARCH_TEXT", "SEARCH_IMAGE", "EXPORT_REPORT", "DOWNLOAD_CLIP"
    query = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    details = Column(String, nullable=True)

class ChainOfCustody(Base):
    __tablename__ = "chain_of_custody"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String, nullable=False)
    file_hash = Column(String, unique=True, index=True, nullable=False)  # SHA256 of the exported file
    generated_by = Column(String, nullable=False)  # Username
    file_type = Column(String, nullable=False)  # "report", "clip", "crop"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    verified = Column(Boolean, default=True)

def init_db():
    Base.metadata.create_all(bind=engine)
