import json
import time
import re
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from pydantic import BaseModel
from PIL import Image
import io
from deep_translator import GoogleTranslator

from app.auth import get_db, get_current_user, User
from app.database import Detection, AuditLog, Video
from app.search_engine import get_search_engine

router = APIRouter(prefix="/api/search", tags=["Search Engine"])

# Color and attribute mappings for query parsing
COLORS = ["black", "white", "red", "blue", "yellow", "green", "grey", "gray", "orange", "pink", "purple", "brown", "silver"]
VEHICLE_TYPES = ["hatchback", "sedan", "suv", "truck", "van", "bus", "motorcycle", "bicycle"]
CLOTHING_ITEMS = ["shirt", "t-shirt", "jacket", "coat", "sweater", "hoodie", "top", "upper", "pants", "jeans", "trousers", "lower", "dress", "skirt"]
ACCESSORIES = ["cap", "hat", "bag", "backpack", "purse", "helmet"]

def parse_query_attributes(query: str) -> Dict[str, str]:
    """
    Extract structured attributes from natural language query.
    Returns dict with keys: upper_color, lower_color, vehicle_type, vehicle_color, cap, bag, helmet, class_name
    """
    query_lower = query.lower()
    extracted = {}
    
    # Extract colors
    found_colors = [color for color in COLORS if color in query_lower]
    if found_colors:
        # Determine if color refers to clothing or vehicle based on context
        if any(word in query_lower for word in ["shirt", "clothing", "jacket", "top", "upper", "t-shirt", "hoodie", "sweater"]):
            extracted["upper_color"] = found_colors[0].capitalize()
        elif any(word in query_lower for word in ["pants", "jeans", "trousers", "lower", "skirt"]):
            extracted["lower_color"] = found_colors[0].capitalize()
        elif any(word in query_lower for word in ["car", "vehicle", "truck", "bus", "motorcycle", "sedan", "suv", "van"]):
            extracted["vehicle_color"] = found_colors[0].capitalize()
        else:
            # Default to upper color for people if context unclear
            if "person" in query_lower or "man" in query_lower or "woman" in query_lower or "guy" in query_lower:
                extracted["upper_color"] = found_colors[0].capitalize()
    
    # Extract vehicle type
    for vtype in VEHICLE_TYPES:
        if vtype in query_lower:
            extracted["vehicle_type"] = vtype.capitalize()
            extracted["class_name"] = "car" if vtype in ["hatchback", "sedan", "suv"] else vtype
            break
    
    # Extract class name from query
    if "person" in query_lower or "man" in query_lower or "woman" in query_lower or "guy" in query_lower or "people" in query_lower:
        extracted["class_name"] = "person"
    elif "car" in query_lower or "vehicle" in query_lower:
        if "class_name" not in extracted:
            extracted["class_name"] = "car"
    
    # Extract accessories
    if "cap" in query_lower or "hat" in query_lower:
        extracted["cap"] = "Yes"
    if "bag" in query_lower or "backpack" in query_lower or "purse" in query_lower:
        extracted["bag"] = "Yes"
    if "helmet" in query_lower:
        extracted["helmet"] = "Yes"
    
    # Negative filters (e.g., "without cap", "no bag")
    if "without cap" in query_lower or "no cap" in query_lower or "not wearing cap" in query_lower:
        extracted["cap"] = "No"
    if "without bag" in query_lower or "no bag" in query_lower or "not carrying bag" in query_lower:
        extracted["bag"] = "No"
    if "without helmet" in query_lower or "no helmet" in query_lower or "not wearing helmet" in query_lower:
        extracted["helmet"] = "No"
    
    return extracted

class SearchRequest(BaseModel):
    query: str
    language: str = "auto"  # "en", "hi", "gu", "auto"
    camera_id: Optional[str] = None
    class_name: Optional[str] = None
    vehicle_type: Optional[str] = None
    vehicle_color: Optional[str] = None
    upper_color: Optional[str] = None
    lower_color: Optional[str] = None
    cap: Optional[str] = None      # "Yes", "No"
    bag: Optional[str] = None      # "Yes", "No"
    helmet: Optional[str] = None   # "Yes", "No"
    start_time: Optional[str] = None # format "HH:MM:SS"
    end_time: Optional[str] = None   # format "HH:MM:SS"
    date: Optional[str] = None       # format "YYYY-MM-DD"
    top_k: int = 50

@router.get("/suggestions")
def get_search_suggestions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    suggestions = set()
    default_suggestions = [
        "person wearing red clothing",
        "person carrying a bag",
        "person wearing a cap",
        "blue sedan",
        "white car",
        "motorcycle",
        "bus"
    ]
    try:
        detections = db.query(Detection).all()
        for det in detections:
            try:
                attrs = json.loads(det.attributes_json)
            except:
                continue
            if det.class_name == "person":
                u_color = attrs.get("upper_color")
                l_color = attrs.get("lower_color")
                has_bag = attrs.get("bag")
                has_cap = attrs.get("cap")
                if u_color and u_color != "Unknown" and u_color != "No":
                    suggestions.add(f"person wearing {u_color.lower()} upper clothing")
                if l_color and l_color != "Unknown" and l_color != "No":
                    suggestions.add(f"person wearing {l_color.lower()} clothing")
                if has_bag == "Yes":
                    suggestions.add("person carrying a bag")
                if has_cap == "Yes":
                    suggestions.add("person wearing a cap")
            else:
                v_type = attrs.get("vehicle_type")
                v_color = attrs.get("vehicle_color")
                if v_color and v_type and v_color != "Unknown" and v_type != "Unknown":
                    suggestions.add(f"{v_color.lower()} {v_type.lower()}")
                elif v_type and v_type != "Unknown":
                    suggestions.add(v_type.lower())
                elif v_color and v_color != "Unknown":
                    suggestions.add(f"{v_color.lower()} vehicle")
    except Exception as e:
        print(f"[Suggestions] Error: {e}")
    res_list = list(suggestions)
    import random
    random.shuffle(res_list)
    res_list = res_list[:8]
    for ds in default_suggestions:
        if len(res_list) >= 8:
            break
        if ds not in res_list:
            res_list.append(ds)
    return res_list

def filter_detection_by_attributes(det: Detection, req_filters: dict) -> bool:
    """Helper to check if a detection's JSON attributes match user filters."""
    try:
        attrs = json.loads(det.attributes_json)
    except Exception:
        return False

    for key, val in req_filters.items():
        if val is None or val == "" or val == "All" or val == "all":
            continue
            
        # Match case-insensitively or exactly
        det_val = attrs.get(key)
        if not det_val:
            return False
            
        if str(det_val).lower() != str(val).lower():
            return False
            
    return True

@router.post("/text")
def search_by_text(
    request: SearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start_time = time.time()
    search_engine = get_search_engine()
    
    # 1. Multi-language Translation
    query_english = request.query
    if request.language != "en":
        try:
            query_english = GoogleTranslator(source=request.language, target='en').translate(request.query)
            print(f"[Search] Translated query: '{request.query}' -> '{query_english}'")
        except Exception as e:
            print(f"[Search] Translation failed, falling back to original: {e}")
            query_english = request.query
    
    # 2. Parse natural language query to extract structured attributes
    parsed_attributes = parse_query_attributes(query_english)
    print(f"[Search] Parsed attributes from query: {parsed_attributes}")
    
    # 3. Get CLIP text embedding
    try:
        query_vector = search_engine.get_text_embedding(query_english)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating text embedding: {e}"
        )
        
    # 4. FAISS Vector Search
    scores, ids = search_engine.search(query_vector, top_k=request.top_k)
    if not ids:
        return []

    # 5. Retrieve from Database
    # Maintain the order of FAISS search result scores
    detections = db.query(Detection).filter(Detection.id.in_(ids)).all()
    detections_map = {det.id: det for det in detections}
    
    # Pre-fetch all videos to map video_id -> Video object
    video_ids = list(set([d.video_id for d in detections]))
    videos = db.query(Video).filter(Video.id.in_(video_ids)).all()
    videos_map = {v.id: v for v in videos}
    
    results = []
    
    # Merge parsed attributes with manual filters (manual filters take precedence)
    attr_filters = {
        "gender": None,  # Can add if UI requires
        "vehicle_type": request.vehicle_type if request.vehicle_type else parsed_attributes.get("vehicle_type"),
        "vehicle_color": request.vehicle_color if request.vehicle_color else parsed_attributes.get("vehicle_color"),
        "upper_color": request.upper_color if request.upper_color else parsed_attributes.get("upper_color"),
        "lower_color": request.lower_color if request.lower_color else parsed_attributes.get("lower_color"),
        "cap": request.cap if request.cap else parsed_attributes.get("cap"),
        "bag": request.bag if request.bag else parsed_attributes.get("bag"),
        "helmet": request.helmet if request.helmet else parsed_attributes.get("helmet")
    }
    
    # Merge class_name filter
    effective_class_name = request.class_name if request.class_name else parsed_attributes.get("class_name")

    for score, det_id in zip(scores, ids):
        det = detections_map.get(det_id)
        if not det:
            continue
            
        # SQL filters
        if request.camera_id and request.camera_id != "all" and request.camera_id != "All":
            if det.camera_id != request.camera_id:
                continue
                
        if effective_class_name and effective_class_name != "all" and effective_class_name != "All":
            if det.class_name.lower() != effective_class_name.lower():
                continue
                
        # Time-range filters
        if request.start_time:
            if det.timestamp < request.start_time:
                continue
        if request.end_time:
            if det.timestamp > request.end_time:
                continue
                
        # Date filter
        if request.date and request.date != "all" and request.date != "":
            vid = videos_map.get(det.video_id)
            if vid:
                video_date = vid.upload_time.strftime("%Y-%m-%d")
                if video_date != request.date:
                    continue
                
        # Attribute JSON filters
        if not filter_detection_by_attributes(det, attr_filters):
            continue
            
        try:
            parsed_attrs = json.loads(det.attributes_json)
        except Exception:
            parsed_attrs = {}

        vid = videos_map.get(det.video_id)
        video_filename = vid.filename if vid else ""

        results.append({
            "id": det.id,
            "video_id": det.video_id,
            "video_filename": video_filename,
            "camera_id": det.camera_id,
            "timestamp": det.timestamp,
            "timestamp_sec": det.timestamp_sec,
            "frame_number": det.frame_number,
            "track_id": det.track_id,
            "class_name": det.class_name,
            "confidence": float(det.confidence),
            "image_path": det.image_path,
            "similarity_score": float(score),
            "attributes": parsed_attrs
        })

    # Log the search
    elapsed_time = time.time() - start_time
    log = AuditLog(
        username=current_user.username,
        action="SEARCH_TEXT",
        query=request.query,
        details=f"Language: {request.language}, Results Count: {len(results)}, Time: {elapsed_time:.4f}s"
    )
    db.add(log)
    db.commit()

    return results

@router.post("/image")
def search_by_image(
    file: UploadFile = File(...),
    camera_id: Optional[str] = Form(None),
    class_name: Optional[str] = Form(None),
    vehicle_type: Optional[str] = Form(None),
    vehicle_color: Optional[str] = Form(None),
    upper_color: Optional[str] = Form(None),
    lower_color: Optional[str] = Form(None),
    cap: Optional[str] = Form(None),
    bag: Optional[str] = Form(None),
    helmet: Optional[str] = Form(None),
    start_time: Optional[str] = Form(None),
    end_time: Optional[str] = Form(None),
    date: Optional[str] = Form(None),
    top_k: int = Form(50),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    start_time_val = time.time()
    search_engine = get_search_engine()

    try:
        # Load image
        img_bytes = file.file.read()
        image = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid image file: {e}"
        )

    # 1. Generate image embedding using CLIP
    try:
        query_vector = search_engine.get_image_embedding(image)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating image embedding: {e}"
        )

    # 2. FAISS Vector Search
    scores, ids = search_engine.search(query_vector, top_k=top_k)
    if not ids:
        return []

    # 3. Retrieve from Database
    detections = db.query(Detection).filter(Detection.id.in_(ids)).all()
    detections_map = {det.id: det for det in detections}
    
    # Pre-fetch all videos to map video_id -> Video object
    video_ids = list(set([d.video_id for d in detections]))
    videos = db.query(Video).filter(Video.id.in_(video_ids)).all()
    videos_map = {v.id: v for v in videos}
    
    results = []
    
    # Attributes filter dictionary
    attr_filters = {
        "vehicle_type": vehicle_type,
        "vehicle_color": vehicle_color,
        "upper_color": upper_color,
        "lower_color": lower_color,
        "cap": cap,
        "bag": bag,
        "helmet": helmet
    }

    for score, det_id in zip(scores, ids):
        det = detections_map.get(det_id)
        if not det:
            continue
            
        # SQL filters
        if camera_id and camera_id != "all" and camera_id != "All":
            if det.camera_id != camera_id:
                continue
                
        if class_name and class_name != "all" and class_name != "All":
            if det.class_name.lower() != class_name.lower():
                continue
                
        # Time-range filters
        if start_time:
            if det.timestamp < start_time:
                continue
        if end_time:
            if det.timestamp > end_time:
                continue
                
        # Date filter
        if date and date != "all" and date != "":
            vid = videos_map.get(det.video_id)
            if vid:
                video_date = vid.upload_time.strftime("%Y-%m-%d")
                if video_date != date:
                    continue
                
        # Attribute JSON filters
        if not filter_detection_by_attributes(det, attr_filters):
            continue
            
        try:
            parsed_attrs = json.loads(det.attributes_json)
        except Exception:
            parsed_attrs = {}

        vid = videos_map.get(det.video_id)
        video_filename = vid.filename if vid else ""

        results.append({
            "id": det.id,
            "video_id": det.video_id,
            "video_filename": video_filename,
            "camera_id": det.camera_id,
            "timestamp": det.timestamp,
            "timestamp_sec": det.timestamp_sec,
            "frame_number": det.frame_number,
            "track_id": det.track_id,
            "class_name": det.class_name,
            "confidence": float(det.confidence),
            "image_path": det.image_path,
            "similarity_score": float(score),
            "attributes": parsed_attrs
        })

    # Log the search
    elapsed_time = time.time() - start_time_val
    log = AuditLog(
        username=current_user.username,
        action="SEARCH_IMAGE",
        query=file.filename,
        details=f"Results Count: {len(results)}, Time: {elapsed_time:.4f}s"
    )
    db.add(log)
    db.commit()

    return results
