from flask import Blueprint, request, jsonify
from datetime import datetime
from utils.ai_helper import get_ai_response
from utils.db import get_db_connection

chat_bp = Blueprint('chat', __name__)


# -----------------------------------------------------
# AI CHAT: USER ↔ AI (LLM) conversation about the scan
# -----------------------------------------------------
@chat_bp.route('/api/chat', methods=['POST'])
def chat_with_ai():
    try:
        data = request.get_json()
        message = data.get('message')
        disease_name = data.get('disease_name', '')
        crop_type = data.get('crop_type', 'general')
        scan_id = data.get('scan_id')

        if not message:
            return jsonify({'error': 'No message provided'}), 400

        # Call LLM response function
        response = get_ai_response(message, disease_name, crop_type)

        # Save chat to DB
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO chats (timestamp, scan_id, user_message, ai_response)
            VALUES (?, ?, ?, ?)
        ''', (
            datetime.now(),
            scan_id,
            message,
            response
        ))
        conn.commit()
        conn.close()

        return jsonify({'response': response})

    except Exception as e:
        return jsonify({'error': str(e)}), 500



# -----------------------------------------------------
# GET CHAT HISTORY FOR A SCAN
# -----------------------------------------------------
@chat_bp.route('/api/chats/<int:scan_id>', methods=['GET'])
def get_chat_history(scan_id):
    try:
        conn = get_db_connection()
        chats = conn.execute('''
            SELECT * FROM chats 
            WHERE scan_id = ? 
            ORDER BY timestamp ASC
        ''', (scan_id,)).fetchall()
        conn.close()

        return jsonify([dict(row) for row in chats])

    except Exception as e:
        return jsonify({'error': str(e)}), 500
