import uvicorn
import os
import sys

if __name__ == "__main__":
    # Ensure current directory is in PYTHONPATH so we can import 'app'
    current_dir = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, current_dir)
    
    print("Starting Smart City CCTV Search Backend (FastAPI)...")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
