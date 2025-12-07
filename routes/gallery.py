from flask import Blueprint, jsonify, send_from_directory
from utils.db import get_db_connection
import os

gallery_bp = Blueprint('gallery', __name__)

UPLOAD_FOLDER = 'static/uploads'


# ---------------------------------------------------------
# GET FULL GALLERY OF SCANS
# ---------------------------------------------------------
@gallery_bp.route('/api/gallery', methods=['GET'])
def get_gallery():
    try:
        conn = get_db_connection()
        scans = conn.execute('''
            SELECT * FROM scans 
            ORDER BY timestamp DESC
        ''').fetchall()
        conn.close()

        return jsonify([dict(row) for row in scans])

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ---------------------------------------------------------
# DOWNLOAD IMAGE FROM GALLERY
# ---------------------------------------------------------
@gallery_bp.route('/api/download/<filename>', methods=['GET'])
def download_file(filename):
    try:
        return send_from_directory(UPLOAD_FOLDER, filename, as_attachment=True)
    except Exception:
        return jsonify({'error': 'File not found'}), 404


# ---------------------------------------------------------
# ACTION LOGS (MOVED FROM app.py)
# ---------------------------------------------------------
@gallery_bp.route('/api/actions', methods=['GET'])
def get_actions():
    try:
        conn = get_db_connection()
        actions = conn.execute('''
            SELECT * FROM actions 
            ORDER BY timestamp DESC 
            LIMIT 50
        ''').fetchall()
        conn.close()

        return jsonify([dict(row) for row in actions])

    except Exception as e:
        return jsonify({'error': str(e)}), 500
