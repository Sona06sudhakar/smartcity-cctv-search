import os
import torch
import faiss
import numpy as np
from PIL import Image
from transformers import CLIPModel, CLIPProcessor
from app.config import CLIP_MODEL_NAME, FAISS_INDEX_PATH

class SearchEngineManager:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        print(f"[SearchEngine] Using device: {self.device}")
        
        # Load CLIP model and processor
        self.model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(self.device)
        self.model.eval()
        self.processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
        
        # Initialize or load FAISS Index
        self.dimension = 512
        if os.path.exists(FAISS_INDEX_PATH):
            try:
                self.index = faiss.read_index(str(FAISS_INDEX_PATH))
                print(f"[SearchEngine] Loaded existing FAISS index with {self.index.ntotal} items.")
            except Exception as e:
                print(f"[SearchEngine] Error loading FAISS index: {e}. Creating new index.")
                self.index = faiss.IndexFlatIP(self.dimension)
        else:
            print("[SearchEngine] Creating a new FAISS Index (IndexFlatIP).")
            self.index = faiss.IndexFlatIP(self.dimension)
            # Wrap the index with an ID map so we can specify custom IDs (like primary keys from SQLite)
            self.index = faiss.IndexIDMap(self.index)
            self.save_index()

    def save_index(self):
        try:
            os.makedirs(os.path.dirname(FAISS_INDEX_PATH), exist_ok=True)
            faiss.write_index(self.index, str(FAISS_INDEX_PATH))
        except Exception as e:
            print(f"[SearchEngine] Failed to save FAISS index: {e}")

    def get_text_embedding(self, text: str) -> np.ndarray:
        with torch.inference_mode():
            inputs = self.processor(text=[text], return_tensors="pt", padding=True, truncation=True)
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            features = self.model.get_text_features(**inputs)
            if hasattr(features, "pooler_output"):
                features = features.pooler_output
            features = features / features.norm(dim=-1, keepdim=True)
            return features.cpu().numpy().astype("float32")[0]

    def get_image_embedding(self, image: Image.Image) -> np.ndarray:
        with torch.inference_mode():
            inputs = self.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(self.device) for k, v in inputs.items()}
            features = self.model.get_image_features(**inputs)
            if hasattr(features, "pooler_output"):
                features = features.pooler_output
            features = features / features.norm(dim=-1, keepdim=True)
            return features.cpu().numpy().astype("float32")[0]

    def add_vector(self, embedding: np.ndarray, faiss_id: int):
        # FAISS expects 2D array of float32
        vector = np.expand_dims(embedding, axis=0).astype("float32")
        ids = np.array([faiss_id], dtype=np.int64)
        self.index.add_with_ids(vector, ids)
        self.save_index()
        print(f"[SearchEngine] Added vector with ID {faiss_id} to index. Total: {self.index.ntotal}")

    def search(self, query_vector: np.ndarray, top_k: int = 50):
        if self.index.ntotal == 0:
            return [], []
        
        vector = np.expand_dims(query_vector, axis=0).astype("float32")
        # Search returns distances (similarities for IndexFlatIP) and IDs
        scores, ids = self.index.search(vector, top_k)
        return scores[0].tolist(), ids[0].tolist()

# Global search engine instance (lazy loaded when first imported/initialized)
_search_engine = None

def get_search_engine():
    global _search_engine
    if _search_engine is None:
        _search_engine = SearchEngineManager()
    return _search_engine
