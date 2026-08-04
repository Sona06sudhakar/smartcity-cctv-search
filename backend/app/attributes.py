import torch
import torch.nn.functional as F
from PIL import Image
from typing import Dict, Any

# Attribute Prompts
PERSON_PROMPTS = {
    "gender": ["a photo of a male person", "a photo of a female person"],
    "upper_color": [
        "a person wearing black upper clothing",
        "a person wearing white upper clothing",
        "a person wearing red upper clothing",
        "a person wearing blue upper clothing",
        "a person wearing yellow upper clothing",
        "a person wearing green upper clothing",
        "a person wearing grey upper clothing",
        "a person wearing orange upper clothing",
        "a person wearing pink upper clothing",
        "a person wearing purple upper clothing",
        "a person wearing brown upper clothing"
    ],
    "lower_color": [
        "a person wearing black lower clothing",
        "a person wearing blue jeans",
        "a person wearing white lower clothing",
        "a person wearing grey lower clothing",
        "a person wearing red lower clothing",
        "a person wearing green lower clothing",
        "a person wearing brown lower clothing"
    ],
    "cap": ["a person wearing a cap", "a person not wearing a cap or hat"],
    "bag": ["a person carrying a bag, backpack, or purse", "a person not carrying any bag"],
    "helmet": ["a person wearing a helmet", "a person not wearing a helmet"]
}

VEHICLE_PROMPTS = {
    "type": [
        "a hatchback car",
        "a sedan car",
        "an SUV",
        "a truck",
        "a van",
        "a bus",
        "a motorcycle",
        "a bicycle"
    ],
    "color": [
        "a black vehicle",
        "a white vehicle",
        "a red vehicle",
        "a blue vehicle",
        "a silver vehicle",
        "a grey vehicle",
        "a green vehicle",
        "a yellow vehicle"
    ],
    "size": [
        "a small compact vehicle",
        "a medium-sized standard vehicle",
        "a large heavy vehicle or truck"
    ]
}

# Clean labels for user facing attributes
MAPPING = {
    "gender": ["Male", "Female"],
    "upper_color": ["Black", "White", "Red", "Blue", "Yellow", "Green", "Grey", "Orange", "Pink", "Purple", "Brown"],
    "lower_color": ["Black", "Blue Jeans", "White", "Grey", "Red", "Green", "Brown"],
    "cap": ["Yes", "No"],
    "bag": ["Yes", "No"],
    "helmet": ["Yes", "No"],
    "type": ["Hatchback", "Sedan", "SUV", "Truck", "Van", "Bus", "Motorcycle", "Bicycle"],
    "color": ["Black", "White", "Red", "Blue", "Silver", "Grey", "Green", "Yellow"],
    "size": ["Small", "Medium", "Large"]
}

def classify_attribute(image: Image.Image, category_prompts: list, labels: list, search_engine) -> str:
    """Runs zero-shot classification on an image for a specific set of prompts."""
    try:
        with torch.inference_mode():
            # Process image
            inputs = search_engine.processor(images=image, return_tensors="pt")
            inputs = {k: v.to(search_engine.device) for k, v in inputs.items()}
            image_features = search_engine.model.get_image_features(**inputs)
            if hasattr(image_features, "pooler_output"):
                image_features = image_features.pooler_output
            image_features = image_features / image_features.norm(dim=-1, keepdim=True)

            # Process prompts
            text_inputs = search_engine.processor(text=category_prompts, return_tensors="pt", padding=True)
            text_inputs = {k: v.to(search_engine.device) for k, v in text_inputs.items()}
            text_features = search_engine.model.get_text_features(**text_inputs)
            if hasattr(text_features, "pooler_output"):
                text_features = text_features.pooler_output
            text_features = text_features / text_features.norm(dim=-1, keepdim=True)

            # Compute similarities
            similarities = (image_features @ text_features.T).squeeze(0)
            probs = F.softmax(similarities * 100, dim=-1)
            
            best_idx = probs.argmax().item()
            return labels[best_idx]
    except Exception as e:
        print(f"[AttributeClassifier] Error classifying attribute: {e}")
        return "Unknown"

def extract_attributes(image_path: str, class_name: str, search_engine) -> Dict[str, Any]:
    """Extracts all matching attributes for a crop based on its YOLO class."""
    attributes = {}
    try:
        image = Image.open(image_path).convert("RGB")
    except Exception as e:
        print(f"[AttributeClassifier] Failed to load image {image_path}: {e}")
        return attributes

    class_lower = class_name.lower()
    
    if class_lower == "person":
        prompts_dict = PERSON_PROMPTS
        for attr, prompts in prompts_dict.items():
            labels = MAPPING[attr]
            attributes[attr] = classify_attribute(image, prompts, labels, search_engine)
    elif class_lower in ["car", "truck", "bus", "motorcycle", "bicycle"]:
        prompts_dict = VEHICLE_PROMPTS
        for attr, prompts in prompts_dict.items():
            labels = MAPPING[attr]
            attributes[attr] = classify_attribute(image, prompts, labels, search_engine)
        
        # Format keys for vehicles as requested
        attributes["vehicle_type"] = attributes.pop("type")
        attributes["vehicle_color"] = attributes.pop("color")
        attributes["approximate_size"] = attributes.pop("size")
        
        # Set helmet to not applicable or run it if motorcycle/bicycle
        if class_lower in ["motorcycle", "bicycle"]:
            # Check helmet on driver? Typically we'd find helmet on a person, but if user wants helmet on vehicle track, we default to NA or classify
            attributes["helmet"] = "Applicable"
        else:
            attributes["helmet"] = "No"
    else:
        # Default fallback
        pass

    return attributes
