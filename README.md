# Smart City CCTV Search

A smart-city CCTV forensic search and investigation platform that ingests surveillance footage, detects and tracks objects, indexes visual embeddings, and enables natural-language and image-based search across video evidence.

This project combines computer vision, semantic search, and a web dashboard to help investigators quickly find relevant CCTV moments from large camera feeds.

## Overview

The system is designed for a forensic and operations workflow:

- Upload CCTV videos from multiple sources
- Run background object detection and tracking
- Extract person/vehicle crops and metadata
- Build a searchable vector index for similarity matching
- Perform text-based or image-based search across detections
- Review evidence, audit logs, and generated reports
- Manage access and custody workflows through a web application

## Features

- CCTV upload and ingestion pipeline
- YOLOv8-based object detection and tracking
- Crop extraction for detected entities
- CLIP-powered semantic search over visual content
- FAISS vector search for efficient similarity retrieval
- Text query understanding with filterable metadata
- Image-based reference search
- Dashboard for system metrics and video management
- Search suggestions, filters, and evidence report generation
- Audit trail and chain-of-custody workflow support
- FastAPI backend and React frontend

## Tech Stack

### Backend
- Python
- FastAPI
- SQLAlchemy
- SQLite
- FAISS
- PyTorch
- Ultralytics YOLOv8
- Transformers / CLIP
- JWT authentication
- ReportLab for generated reports

### Frontend
- React
- Vite
- Tailwind CSS
- Lucide icons

## Architecture

The project is split into a backend API and a frontend application:

- Backend: video ingestion, indexing, search, reports, authentication, and data persistence
- Frontend: investigator dashboard, search UI, uploads, reports, and audit views
- AI components: YOLOv8 for detection/tracking and CLIP + FAISS for semantic retrieval

## Repository Structure

```text
smartcity-cctv-search/
├── app.py                         # Streamlit prototype / reference implementation
├── tracker.py                    # Tracking utilities
├── tracker_crop.py               # Crop-based tracking utilities
├── backend/
│   ├── app/
│   │   ├── attributes.py         # Attribute classification logic
│   │   ├── auth.py               # Authentication helpers
│   │   ├── config.py             # App configuration
│   │   ├── database.py           # DB models and session setup
│   │   ├── main.py               # FastAPI app entrypoint
│   │   ├── pipeline.py           # Video processing pipeline
│   │   ├── report_gen.py         # Report generation logic
│   │   ├── search_engine.py      # FAISS and embedding manager
│   │   └── routes/
│   │       ├── audit.py
│   │       ├── auth.py
│   │       ├── custody.py
│   │       ├── exports.py
│   │       ├── report.py
│   │       ├── search.py
│   │       ├── tracking.py
│   │       └── upload.py
│   ├── generate_test_video.py
│   ├── ingest_folder.py
│   ├── reprocess_videos.py
│   ├── requirements.txt
│   ├── run_backend.py
│   ├── test_speed.py
│   ├── verify_e2e.py
│   └── videos/
├── frontend/
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── ...
├── extracted_crops/
├── yolov8n.pt
├── yolov8m.pt
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn
- A CUDA-enabled GPU is recommended for faster model inference, but CPU execution also works

### 1. Clone the repository

```bash
git clone https://github.com/your-username/smartcity-cctv-search.git
cd smartcity-cctv-search
```

### 2. Set up the backend

```bash
cd backend
python -m venv .venv
```

Windows:

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Linux/macOS:

```bash
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Start the backend

```bash
python run_backend.py
```

The API will run on:

- http://localhost:8000
- API docs: http://localhost:8000/docs

### 4. Set up the frontend

```bash
cd ../frontend
npm install
npm run dev
```

The frontend usually runs on:

- http://localhost:5173

## Usage

1. Open the frontend in your browser.
2. Log in to the app.
3. Upload a CCTV video or queue local feeds.
4. Wait for the backend pipeline to detect and track objects.
5. Use the search UI to run:
   - natural-language queries such as “red car” or “person in white shirt”
   - image-based similarity search using a reference image
6. Review matching detections, exports, and report data.

## Example Search Queries

- red motorcycle
- person with backpack
- blue bus
- white shirt
- truck near intersection

## Important Notes

- Model downloads may take time on first run.
- YOLO and CLIP models are large and may require significant disk space and memory.
- The system is built as a forensic investigation prototype and should be tested and hardened before production deployment.
- For local development, a SQLite database is used and is stored under the backend folder.

## Future Enhancements

- multi-camera correlation and cross-camera re-identification
- stronger evidence hashing and chain-of-custody enforcement
- video timeline summarization and event clustering
- enterprise deployment with PostgreSQL and Redis
- secure role-based access and approvals for investigations

## License

This project is currently distributed without a formal license file. Add a license before public deployment if you plan to publish it to GitHub as an open-source repository.

## Contributing

Contributions are welcome. If you want to improve the project:

1. Fork the repository
2. Create a feature branch
3. Commit your change
4. Open a pull request with a clear description

## Contact

For questions or collaboration, reach out through the repository owner or project maintainer.
