import cv2
import numpy as np
from PIL import Image
import os

# -----------------------------------
# Load SR model once
# -----------------------------------
def load_sr_model():
    print("Loading SR model (ESPCN x4)...")
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    model_path = "models/sr/ESPCN_x4.pb"
    sr.readModel(model_path)
    sr.setModel("espcn", 4)   # Model name + scaling factor
    return sr

sr_model = load_sr_model()


# -----------------------------------
# Step 1 — Clean image
# -----------------------------------
def enhance_cv(path):
    img = cv2.imread(path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Remove green tint
    wb = cv2.xphoto.createSimpleWB()
    img = wb.balanceWhite(img)

    # Denoise
    img = cv2.fastNlMeansDenoisingColored(img, None, 5, 5, 7, 21)

    # Sharpen
    kernel = np.array([[0, -1, 0],
                       [-1, 5, -1],
                       [0, -1, 0]])
    img = cv2.filter2D(img, -1, kernel)

    out = path.replace(".jpg", "_clean.jpg")
    cv2.imwrite(out, cv2.cvtColor(img, cv2.COLOR_RGB2BGR))
    return out


# -----------------------------------
# Step 2 — Super-Resolution ×4 (OpenCV)
# -----------------------------------
def apply_super_resolution(path):
    img = cv2.imread(path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    sr_image = sr_model.upsample(img)

    out = path.replace("_clean.jpg", "_enhanced.jpg")
    cv2.imwrite(out, cv2.cvtColor(sr_image, cv2.COLOR_RGB2BGR))
    return out


# -----------------------------------
# COMBINED PIPELINE
# -----------------------------------
def process_image_pipeline(path):
    print("⚙ Running CV enhancement pipeline...")

    clean = enhance_cv(path)
    enhanced = apply_super_resolution(clean)

    print("✔ Enhanced image saved at:", enhanced)
    return enhanced