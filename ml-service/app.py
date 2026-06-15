import os
import re
import io
import numpy as np
import easyocr

from PIL import Image
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Header, Depends
from pydantic import BaseModel, Field
from typing import List, Optional
from sentence_transformers import SentenceTransformer, util
from azure.storage.blob import BlobServiceClient


# Constants

# Standard government warning text (required by TTB on all alcohol labels)
# This is the exact text that must appear on every compliant label
STANDARD_GOVERNMENT_WARNING = (
    "GOVERNMENT WARNING: (1) ACCORDING TO THE SURGEON GENERAL, WOMEN SHOULD NOT DRINK "
    "ALCOHOLIC BEVERAGES DURING PREGNANCY BECAUSE OF THE RISK OF BIRTH DEFECTS. "
    "(2) CONSUMPTION OF ALCOHOLIC BEVERAGES IMPAIRS YOUR ABILITY TO DRIVE A CAR OR "
    "OPERATE MACHINERY, AND MAY CAUSE HEALTH PROBLEMS."
)

# A simplified signature we look for in the OCR text (handles minor OCR errors)
WARNING_SIGNATURE = "GOVERNMENT WARNING"


# Load environment variables
load_dotenv()
AZURE_STORAGE_CONNECTION_STRING = os.getenv('AZURE_STORAGE_CONNECTION_STRING')
AZURE_STORAGE_CONTAINER = os.getenv('AZURE_STORAGE_CONTAINER', 'label-images')
API_KEY = os.getenv('API_KEY')

# Initialize FastAPI
app = FastAPI(title="Label Verification API", version="1.0.0")

# Initialize EasyOCR (loads model on startup)
print("Loading EasyOCR model...")
reader = easyocr.Reader(['en'], gpu=False)
print("EasyOCR loaded.")

# Load a tiny, fast sentence transformer model optimized for CPU
# 'all-MiniLM-L6-v2' is the gold standard for fast, accurate similarity
print("Loading all-MiniLM-L6-v2 model...")
model_embedder = SentenceTransformer('all-MiniLM-L6-v2')
print("all-MiniLM-L6-v2 loaded.")

# Connect to Azure Blob Storage
blob_service_client = BlobServiceClient.from_connection_string(AZURE_STORAGE_CONNECTION_STRING) # type: ignore
container_client = blob_service_client.get_container_client(AZURE_STORAGE_CONTAINER)


# ============================================================
# Pydantic Models
# ============================================================
class LabelRecord(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id")  # <-- Accept _id from JSON, store as id
    brand: str
    classType: str
    alcContent: Optional[str] = ""
    netContents: str
    producerName: str
    producerAddressLine1: str
    producerAddressLine2: str
    producerAddressLine3: Optional[str] = ""
    sourceOfProduct: str
    countryOfOrigin: Optional[str] = ""
    productType: str
    imageFilenames: List[str]
    imageUrls: List[str]
    brandMatch: float
    alcMatch: float
    netContentMatch: float
    warningSignatureMatch: float
    fullWarningMatch: float

    class Config:
        populate_by_name = True  # Allow both _id and id to work


class VerifyRequest(BaseModel):
    data: List[LabelRecord]


class VerifyResultItem(BaseModel):
    id: Optional[str] = None  # <-- The field name in the RESPONSE
    brandMatch: float
    alcMatch: float
    netContentMatch: float
    warningSignatureMatch: float
    fullWarningMatch: float


class VerifyResponse(BaseModel):
    results: List[VerifyResultItem]


# ============================================================
# Authentication
# ============================================================
async def verify_api_key(x_api_key: str = Header(...)):
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    return x_api_key


# ============================================================
# Helper Functions
# ============================================================
def download_image(filename: str) -> Optional[Image.Image]:
    if not filename:
        return None
    try:
        blob_client = container_client.get_blob_client(filename)
        stream = blob_client.download_blob()
        image = Image.open(io.BytesIO(stream.readall())).convert('RGB')
        return image
    except Exception as e:
        print(f"Failed to download {filename}: {e}")
        return None


def extract_text_from_image(image: Image.Image) -> str:
    if image is None:
        return ""
    try:
        # Upscale for better resolution
        w, h = image.size
        image = image.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
        
        # Convert to grayscale for OCR
        gray_image = image.convert('L')

        # EasyOCR returns list of (bbox, text, confidence)
        results = reader.readtext(np.array(gray_image), detail=0, paragraph=True, rotation_info=[0, 90, 180, 270])

        combined = ' '.join(results) # type: ignore

        # Normalize whitespace
        return re.sub(r'\s+', ' ', combined).strip()

    except Exception as e:
        print(f"OCR failed: {e}")
        return ""


def get_ai_similarity(ocr_text: str, expected_value: str) -> float:
    """
    Computes semantic similarity between OCR text and database values.
    Returns a score 0.0 to 1.0.
    """
    if not ocr_text or not expected_value:
        # One of the values wasn't supplied so no match.
        return 0.0
    
    if len(ocr_text) < len(expected_value):
        # ocr text too short to include expected value.
        return 0.0
    
    if expected_value in ocr_text:
        # Found a perfect match.
        return 1.0
    
    ocr_text_len = len(ocr_text)
    expected_value_len = len(expected_value)
    similarities = []

    # Break the ocr text into chunks the size of the expected value for comparison
    for i in range(0, (ocr_text_len - expected_value_len)):
        ocr_text_temp = ocr_text[i:expected_value_len]

        # Generate embeddings (vectors)
        embeddings = model_embedder.encode([ocr_text_temp, expected_value], convert_to_tensor=True)
        
        # Compute Cosine Similarity
        similarities.append(util.cos_sim(embeddings[0], embeddings[1]))
    
    return float(max(similarities))


def check_government_warning_signature(ocr_text):
    """
    Verify the OCR text contains the government warning signature.
    Returns 1.0 if found, 0.0 if missing.
    """
    if not ocr_text:
        return 0.0
    return 1.0 if WARNING_SIGNATURE in ocr_text else 0.0


def check_government_warning_full(ocr_text):
    """
    Verify the OCR text contains the full government warning.
    Returns 1.0 if found, 0.0 if missing.
    """
    if not ocr_text:
        return 0.0
    return 1.0 if WARNING_SIGNATURE in ocr_text else 0.0


def extract_alcohol_content(ocr_text, expected):
    """
    Look for alcohol percentage in the OCR text.
    Handles formats like '45%', '45 %', '45 ALC/VOL', '90 PROOF'.
    """
    if not expected:
        # Alcohol content not required in some cases
        return 1.0
    
    if not ocr_text:
        # If alcohol content has a value, it should be in the text
        return 0.0

    # Extract just the number from expected (e.g., "45%" -> "45", "55.5%" -> "55.5")
    expected_num = re.search(r'\d+\.?\d*', str(expected))
    if not expected_num:
        return 0.0

    number = expected_num.group()
    # Look for the number followed by % or "PROOF" or "ALC"
    patterns = [
        rf'\b{re.escape(number)}\s*%',
        rf'\b{re.escape(number)}\s*ALC',
        rf'\b{re.escape(number)}\s*PROOF',
    ]

    for pattern in patterns:
        if re.search(pattern, ocr_text, re.IGNORECASE):
            return 1.0

    # Fallback: just check if the number appears
    return 0.5 if number in ocr_text else 0.0


def extract_net_contents(ocr_text, expected):
    """
    Look for net contents in the OCR text.
    Handles '750 ML', '750 MILLILITERS', '1L', etc.
    """
    if not expected or not ocr_text:
        return 0.0

    expected_clean = str(expected).upper()
    # Extract the number and unit
    num_match = re.search(r'\d+\.?\d*', expected_clean)
    if not num_match:
        return 0.0

    number = num_match.group()

    # Check various formats
    patterns = [
        rf'\b{re.escape(number)}\s*ML',
        rf'\b{re.escape(number)}\s*MILLILITER',
        rf'\b{re.escape(number)}\s*LITER',
        rf'\b{re.escape(number)}\s*OZ',
    ]

    for pattern in patterns:
        if re.search(pattern, ocr_text, re.IGNORECASE):
            return 1.0

    return 0.5 if number in ocr_text else 0.0


def calculate_matches(record, ocr_text_original_case, ocr_text_upper_case):
    matches = {}
    
    # Replace traditional fuzzy matching with AI Semantic Matching
    print("Checking brand...")
    matches['brand_match'] = get_ai_similarity(ocr_text_upper_case, record.brand)
    
    # Keep regex/logic for Alcohol/Net contents (AI can get confused by numbers)
    print("Checking alcohol content...")
    matches['alc_match'] = extract_alcohol_content(ocr_text_upper_case, record.alcContent)

    print("Checking net contents...")
    matches['net_match'] = extract_net_contents(ocr_text_upper_case, record.netContents)

    print("Checking warning signature...")    
    matches['warning_signature_match'] = get_ai_similarity(ocr_text_original_case, WARNING_SIGNATURE)

    print("Checking full warning...")    
    matches['full_warning_match'] = get_ai_similarity(ocr_text_original_case, STANDARD_GOVERNMENT_WARNING)

    return matches


# ============================================================
# API Endpoints
# ============================================================
@app.get("/")
def root():
    return {
        "service": "Label Verification API",
        "status": "healthy",
        "ocr model loaded": reader is not None,
        "transformer model loaded": model_embedder is not None,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/verify", response_model=VerifyResponse)
async def verify_labels(request: VerifyRequest, api_key: str = Depends(verify_api_key)):
    # *** DEBUG: Log the incoming request ***
    print(f"Received {len(request.data)} records")
    if request.data:
        first_record = request.data[0]
        print(f"First record _id: {first_record.id}")
        print(f"First record brand: {first_record.brand}")
        print(f"First record imageFilenames: {first_record.imageFilenames}")

    results = []

    for record in request.data:
        # *** DEBUG: Log each record's _id ***
        print(f"Processing record _id: {record.id}")

        # Set up the lists so we can get the max match score across the set of images.
        brand_match = []
        alc_match = []
        net_match = []
        warning_signature_match = []
        full_warning_match = []

        max_of_matches = {}

        # Iterate through each image for this record.
        for img_file in record.imageFilenames:
            # Download the image.
            print(f"Downloading image: {img_file}")
            image = download_image(img_file)

            # Use ocr to extract the text.
            print(f"Extracting text from image: {img_file}")
            ocr_text_original_case = extract_text_from_image(image) # type: ignore
            ocr_text_upper_case = ocr_text_original_case.upper()

            # Calculate matches
            print("Calculating matches...")
            matches = calculate_matches(record, ocr_text_original_case, ocr_text_upper_case)
            
            # Append the match results to the lists.
            brand_match.append(matches['brand_match'])
            alc_match.append(matches['alc_match'])
            net_match.append(matches['net_match'])
            warning_signature_match.append(matches['warning_signature_match'])
            full_warning_match.append(matches['full_warning_match'])

        # Get the max value for each list item.
        max_of_matches['id'] = record.id
        max_of_matches['brandMatch'] = max(brand_match)
        max_of_matches['alcMatch'] = max(alc_match)
        max_of_matches['netMatch'] = max(net_match)
        max_of_matches['warningSignatureMatch'] = max(warning_signature_match)
        max_of_matches['fullWarningMatch'] = max(full_warning_match)

        print(f"Returning result for id: {record.id}")

        results.append(VerifyResultItem(
            id=max_of_matches['id'],
            brandMatch=max_of_matches['brandMatch'],
            alcMatch=max_of_matches['alcMatch'],
            netContentMatch=max_of_matches['netMatch'],
            warningSignatureMatch=max_of_matches['warningSignatureMatch'],
            fullWarningMatch=max_of_matches['fullWarningMatch']
        ))

    return VerifyResponse(results=results)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
