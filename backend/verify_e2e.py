import requests
import time
import sys
import os

BASE_URL = "http://localhost:8000"

def verify_system():
    print("--- STARTING E2E SYSTEM VERIFICATION ---")
    
    # 1. Login
    print("[1/6] Attempting login...")
    login_url = f"{BASE_URL}/api/auth/login-json"
    login_payload = {"username": "admin", "password": "admin123"}
    try:
        res = requests.post(login_url, json=login_payload)
        res.raise_for_status()
        token = res.json()["access_token"]
        print("Login successful! Token acquired.")
    except Exception as e:
        print(f"Login failed: {e}")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Ingest test video
    print("[2/6] Ingesting test video 'test_cctv.mp4'...")
    upload_url = f"{BASE_URL}/api/videos/upload"
    video_file_path = "test_cctv.mp4"
    
    if not os.path.exists(video_file_path):
        print(f"Error: test_cctv.mp4 not found in current directory: {os.getcwd()}")
        sys.exit(1)

    with open(video_file_path, "rb") as f:
        files = {"file": (video_file_path, f, "video/mp4")}
        data = {"camera_id": "CAM_E2E_01"}
        res = requests.post(upload_url, headers=headers, files=files, data=data)
        res.raise_for_status()
        video_id = res.json()["video_id"]
        print(f"Ingestion started in background. Video Database ID: {video_id}")

    # 3. Poll for processing completion
    print("[3/6] Polling ingestion status (running YOLOv8 tracking & CLIP embeddings)...")
    videos_url = f"{BASE_URL}/api/videos"
    video_completed = False
    
    # Poll up to 60 seconds
    for attempt in range(12):
        time.sleep(5)
        res = requests.get(videos_url, headers=headers)
        res.raise_for_status()
        video_record = next((v for v in res.json() if v["id"] == video_id), None)
        
        if not video_record:
            print("Error: Ingested video record disappeared from database.")
            sys.exit(1)
            
        status = video_record["status"]
        detections = video_record["detections_count"]
        print(f"  Attempt {attempt+1}: Status = '{status}', Detections = {detections}")
        
        if status == "completed":
            video_completed = True
            break
        elif status == "failed":
            print("Error: Video processing failed in the background pipeline.")
            sys.exit(1)
            
    if not video_completed:
        print("Error: Video ingestion processing timed out.")
        sys.exit(1)
        
    print("Video pipeline finished processing successfully!")

    # 4. Perform Natural Language Search
    print("[4/6] Querying Natural Language search for 'bus'...")
    search_url = f"{BASE_URL}/api/search/text"
    search_payload = {
        "query": "bus",
        "language": "en",
        "camera_id": "all",
        "class_name": "all"
    }
    
    res = requests.post(search_url, headers=headers, json=search_payload)
    res.raise_for_status()
    results = res.json()
    print(f"Search completed. Found {len(results)} matches.")
    
    if len(results) == 0:
        print("Error: Expected to find 'bus' matches in synthetic video, but got 0 results.")
        sys.exit(1)
        
    # Check attributes of matching detections
    first_match = results[0]
    print(f"Top Match: ID = {first_match['id']}, Class = {first_match['class_name']}, Similarity = {first_match['similarity_score']:.2f}")
    print(f"Attributes: {first_match['attributes']}")

    # 5. Verify Cross-Camera Re-ID and Timeline
    print("[5/6] Verifying Re-ID Timeline generator...")
    timeline_url = f"{BASE_URL}/api/tracking/timeline/{first_match['id']}"
    res = requests.get(timeline_url, headers=headers)
    res.raise_for_status()
    timeline_data = res.json()
    print(f"Timeline retrieved successfully. Matches in journey: {len(timeline_data['timeline'])}")

    # 6. Verify Audit Logs
    print("[6/6] Inspecting database audit logs ledger...")
    audit_url = f"{BASE_URL}/api/audit"
    res = requests.get(audit_url, headers=headers)
    res.raise_for_status()
    logs = res.json()
    print(f"Audit log database active. Retrieved {len(logs)} operational trace records.")
    
    # Print last 3 logs
    for log in logs[:3]:
        print(f"  [{log['timestamp']}] User: {log['username']} | Action: {log['action']} | Details: {log['details']}")

    print("\n--- E2E SYSTEM VERIFICATION COMPLETED SUCCESSFULLY! ALL SERVICES HEALTHY ---")

if __name__ == "__main__":
    verify_system()
