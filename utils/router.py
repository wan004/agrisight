import numpy as np
import torch
import cv2
from PIL import Image
import torchvision.transforms.functional as TF

DEVICE = 'cuda:0' if torch.cuda.is_available() else 'cpu'

# Local model paths
MODEL_PATH = "models/router/model.traced.pt"
CLASSES_PATH = "models/router/classes.txt"

# Load classes
with open(CLASSES_PATH) as f:
    CLASSES = [line.strip() for line in f]

# Load TorchScript model
MODEL = torch.jit.load(MODEL_PATH).eval().to(DEVICE)


def resize_crop(img, target=480):
    h, w = img.shape[:2]
    crop = min(h, w)
    x = (w - crop) // 2
    y = (h - crop) // 2
    return cv2.resize(img[y:y+crop, x:x+crop], (target, target), interpolation=cv2.INTER_AREA)


def classify(image_path):
    img = np.array(Image.open(image_path).convert("RGB"))
    img_resized = resize_crop(img)
    tensor = TF.to_tensor(img_resized).to(DEVICE)

    with torch.no_grad():
        pred = MODEL(tensor.unsqueeze(0)).squeeze().cpu().numpy()

    result = {CLASSES[i]: float(pred[i]) for i in range(len(pred))}
    return dict(sorted(result.items(), key=lambda x: -x[1]))
