from flask import Blueprint, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from datetime import datetime
import os
import base64

from utils.db import get_db_connection
from utils.crop_health import identify_disease
from utils.image_pipeline import process_image_pipeline
from utils.telegram_helper import tg_send, tg_send_photo
from config import Config

# OPTIONAL (Kindwise Router Integration)
try:
    from utils.router import classify as router_classify
    ROUTER_ENABLED = True
except:
    ROUTER_ENABLED = False

scans_bp = Blueprint('scans', __name__)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
UPLOAD_FOLDER = 'static/uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# =========================================================
#  ESP32 → IMAGE SCAN UPLOAD
# =========================================================
@scans_bp.route('/scan', methods=['POST'])
def esp32_scan_upload():
    try:
        data = request.get_json()
        image_base64 = data.get('imageBase64')

        if not image_base64:
            return jsonify({'error': 'No image data provided'}), 400

        image_bytes = base64.b64decode(image_base64)

        filename = f"esp32_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jpg"
        filepath = os.path.join(UPLOAD_FOLDER, filename)

        with open(filepath, 'wb') as f:
            f.write(image_bytes)

        # Enhancement pipeline
        enhanced_path = process_image_pipeline(filepath)
        enhanced_filename = os.path.basename(enhanced_path)

        # Save to DB
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO scans (timestamp, image_path, disease, confidence, description)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            datetime.now(),
            enhanced_filename,
            'Pending',
            0.0,
            'Analysis pending'
        ))
        conn.commit()

        scan_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        conn.close()

        return jsonify({
            'status': 'success',
            'filename': enhanced_filename,
            'scan_id': scan_id
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =========================================================
#  WEB → MANUAL FILE UPLOAD
# =========================================================
@scans_bp.route('/api/upload', methods=['POST'])
def upload_image():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if not allowed_file(file.filename):
        return jsonify({'error': 'Invalid file type'}), 400

    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f"{timestamp}_{filename}"
    filepath = os.path.join(UPLOAD_FOLDER, filename)

    file.save(filepath)

    # DB Entry
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO scans (timestamp, image_path, disease, confidence, description)
        VALUES (?, ?, ?, ?, ?)
    ''', (datetime.now(), filename, 'Pending', 0.0, 'Analysis pending'))
    conn.commit()
    scan_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
    conn.close()

    return jsonify({
        'status': 'success',
        'filename': filename,
        'scan_id': scan_id
    })


# =========================================================
#  ANALYZE IMAGE → DISEASE
# =========================================================
@scans_bp.route('/api/analyze', methods=['POST'])
def analyze_image():
    try:
        data = request.get_json()
        scan_id = data.get('scan_id')
        crop_type = data.get('crop_type', 'general')

        conn = get_db_connection()
        scan = conn.execute(
            'SELECT image_path FROM scans WHERE id = ?',
            (scan_id,)
        ).fetchone()

        if not scan:
            conn.close()
            return jsonify({'error': 'Scan not found'}), 404

        image_path = os.path.join(UPLOAD_FOLDER, scan['image_path'])

        # Router Safety Filter
        if ROUTER_ENABLED:
            router_out = router_classify(image_path)
            top_class = list(router_out.keys())[0]
            top_score = router_out[top_class]

            # Debug print
            print("\nROUTER:", router_out, "\n")

            # Hard block humans
            if top_class == "human" and top_score > 0.40:
                return jsonify({
                    "error": "Human detected. Upload plant images only."
                }), 400

            # NEW LOGIC — require PLANT CONFIDENCE > 0.70
            plant_score = router_out.get("plant", 0)
            unhealthy_score = router_out.get("unhealthy_plant", 0)
            crop_score = router_out.get("crop", 0)

            max_plant_like = max(plant_score, unhealthy_score, crop_score)

            if max_plant_like < 0.65:  # 65% threshold
                return jsonify({
                    "error": "No plant detected. Please upload a clear leaf photo."
                }), 400


        # Disease Detection
        result = identify_disease(image_path, crop_type)

        # Update DB
        conn.execute('''
            UPDATE scans
            SET disease = ?, confidence = ?, description = ?
            WHERE id = ?
        ''', (
            result.get('disease', 'Unknown'),
            result.get('confidence', 0.0),
            result.get('description', 'No description'),
            scan_id
        ))
        conn.commit()
        conn.close()

        # Telegram Alerts
        try:
            tg_send(
                f"🦠 DISEASE DETECTED\n"
                f"Name: {result.get('disease')}\n"
                f"Confidence: {result.get('confidence',0)*100:.1f}%"
            )
            tg_send_photo(image_path, caption="Leaf Scan Result")
        except:
            pass

        return jsonify(result)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =========================================================
#  SAVE MANUAL CAPTURE (from ESP32)
# =========================================================
@scans_bp.route('/api/save_capture', methods=['POST'])
def save_capture():
    try:
        data = request.get_json()
        image_data = data.get('image_data')
        filename = data.get('filename')

        if not image_data or not filename:
            return jsonify({'error': 'Missing image data or filename'}), 400

        image_bytes = base64.b64decode(image_data)

        filepath = os.path.join(UPLOAD_FOLDER, filename)
        with open(filepath, 'wb') as f:
            f.write(image_bytes)

        conn = get_db_connection()
        conn.execute('''
            INSERT INTO scans (timestamp, image_path, disease, confidence, description)
            VALUES (?, ?, ?, ?, ?)
        ''', (datetime.now(), filename, 'Pending', 0.0, 'Analysis pending'))
        conn.commit()

        scan_id = conn.execute('SELECT last_insert_rowid()').fetchone()[0]
        conn.close()

        return jsonify({
            'status': 'success',
            'filename': filename,
            'scan_id': scan_id
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =========================================================
#  MOVE `/api/capture/manual` HERE (from app.py)
# =========================================================
@scans_bp.route('/api/capture/manual', methods=['POST'])
def capture_image_manual():
    try:
        from utils.esp_helper import capture_image
        image_data = capture_image()

        if image_data:
            return jsonify({
                'success': True,
                'image': image_data,
                'format': 'jpeg',
                'timestamp': datetime.now()
            })
        else:
            return jsonify({'success': False, 'error': 'Failed to capture image'}), 500

    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


# =========================================================
#  DELETE SCAN
# =========================================================
@scans_bp.route('/api/delete_scan/<int:scan_id>', methods=['DELETE'])
def delete_scan(scan_id):
    try:
        conn = get_db_connection()
        scan = conn.execute(
            'SELECT image_path FROM scans WHERE id = ?',
            (scan_id,)
        ).fetchone()

        if scan:
            try:
                os.remove(os.path.join(UPLOAD_FOLDER, scan['image_path']))
            except:
                pass

            conn.execute('DELETE FROM scans WHERE id = ?', (scan_id,))
            conn.execute('DELETE FROM chats WHERE scan_id = ?', (scan_id,))
            conn.commit()

        conn.close()
        return jsonify({'success': True})

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# =========================================================
#  DOWNLOAD IMAGE
# =========================================================
@scans_bp.route('/api/download/<filename>')
def download_file(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)
    except:
        return jsonify({'error': 'File not found'}), 404
