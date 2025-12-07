import base64
import requests
import time
from config import Config


def encode_image_to_base64(image_path):
    """Convert an image file to a base64-encoded string."""
    try:
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode("utf-8")
    except Exception as e:
        print(f"Error encoding image: {e}")
        return None


def identify_disease(image_path, crop_type="general"):
    """
    Identify plant disease using the Kindwise (Crop.Health) async API.
    Flow:
      1. POST to /identification → returns either:
         - 201 (Completed immediately with result)
         - 200 (Accepted, use token to poll result)
      2. If token provided, poll /identification/{token} until result is ready.
    """
    # ✅ Ensure API key is configured (supports both KINDWISE_API_KEY and CROP_HEALTH_API_KEY)
    api_key = Config.KINDWISE_API_KEY or Config.CROP_HEALTH_API_KEY
    if not api_key:
        raise Exception("Kindwise API key not configured")

    # ✅ Encode image
    image_base64 = encode_image_to_base64(image_path)
    if not image_base64:
        raise Exception("Failed to encode image")

    # ✅ Request headers (Kindwise expects 'Api-Key', not 'Authorization')
    headers = {
        "Api-Key": api_key,
        "Content-Type": "application/json"
    }

    # ✅ Request payload
    payload = {
        "images": [image_base64],
        "similar_images": True
    }

    try:
        # Step 1: Submit image for analysis
        post_res = requests.post(Config.KW_IDENTIFY, headers=headers, json=payload, timeout=30)
        data = post_res.json()

        # ✅ Accept both 200 (Accepted) and 201 (Completed)
        if post_res.status_code not in (200, 201):
            print(f"API Error (Step 1): {post_res.status_code} - {post_res.text}")
            raise Exception(f"API request failed: {post_res.status_code}")

        # ✅ Case 1: If result is already ready (201 response)
        if "result" in data and data.get("status") == "COMPLETED":
            disease_info = data["result"].get("disease", {}).get("suggestions", [{}])[0]
            crop_info = data["result"].get("crop", {}).get("suggestions", [{}])[0]

            return {
                "success": True,
                "disease": disease_info.get("name", "Unknown"),
                "confidence": disease_info.get("probability", 0.0),
                "description": disease_info.get("scientific_name", "No description available"),
                "plant_name": crop_info.get("name", crop_type)
            }

        # ✅ Case 2: Asynchronous — poll for result using token
        token = data.get("token")
        if not token:
            raise Exception("No token returned from Kindwise API")

        for _ in range(10):  # Poll up to 10 times
            time.sleep(1)
            get_url = Config.KW_GET_RESULT.replace("{token}", token)
            get_res = requests.get(get_url, headers=headers, timeout=20)

            if get_res.status_code == 200:
                data = get_res.json()
                if "result" in data and data["result"]:
                    disease_info = data["result"].get("disease", {}).get("suggestions", [{}])[0]
                    crop_info = data["result"].get("crop", {}).get("suggestions", [{}])[0]

                    return {
                        "success": True,
                        "disease": disease_info.get("name", "Unknown"),
                        "confidence": disease_info.get("probability", 0.0),
                        "description": disease_info.get("scientific_name", "No description available"),
                        "plant_name": crop_info.get("name", crop_type)
                    }

            elif get_res.status_code not in (202, 204):
                print(f"Polling error: {get_res.status_code} - {get_res.text}")
                break  # Stop polling if invalid status or error

        # ✅ Fallback: No result after retries
        return {
            "success": False,
            "disease": "No disease detected",
            "confidence": 0.0,
            "description": "No disease detected or analysis not ready.",
            "plant_name": crop_type
        }

    except requests.exceptions.Timeout:
        raise Exception("Request timed out - Kindwise API may be slow.")
    except requests.exceptions.RequestException as e:
        raise Exception(f"Network error: {e}")
    except Exception as e:
        raise Exception(f"Error analyzing image: {e}")


def get_supported_crops():
    """Return a list of supported crops."""
    return [
        'general', 'apple', 'apricot', 'avocado', 'banana', 'barley', 'beans',
        'bell_pepper', 'blackberry', 'blueberry', 'broccoli', 'cabbage', 'capsicum',
        'carrot', 'cauliflower', 'celery', 'cherry', 'chilli', 'citrus', 'coffee',
        'cucumber', 'currant', 'custard_apple', 'eggplant', 'elderberry', 'fig',
        'grape', 'grapefruit', 'guava', 'hazelnut', 'hop', 'kiwi', 'kohlrabi',
        'lemon', 'lettuce', 'lime', 'loquat', 'mandarin', 'mango', 'melon',
        'mulberry', 'nectarine', 'oat', 'okra', 'olive', 'onion', 'orange',
        'papaya', 'passion_fruit', 'peach', 'pear', 'peas', 'persimmon', 'physalis',
        'pineapple', 'plum', 'pomegranate', 'potato', 'quince', 'raspberry',
        'rice', 'rye', 'sorghum', 'strawberry', 'sugarcane', 'sweet_potato',
        'tangerine', 'tea', 'tomato', 'turnip', 'walnut', 'watermelon', 'wheat',
        'zucchini'
    ]
