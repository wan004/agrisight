import sqlite3
import os
from datetime import datetime
from config import Config


def init_db():
    """Initialize all database tables."""

    # Ensure database directory exists
    os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)

    conn = sqlite3.connect(Config.DATABASE_PATH)

    # -----------------------------
    # Sensors Table
    # -----------------------------
    conn.execute('''
        CREATE TABLE IF NOT EXISTS sensors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            moisture REAL,
            temperature REAL,
            humidity REAL
        )
    ''')

    # -----------------------------
    # Scans Table
    # -----------------------------
    conn.execute('''
        CREATE TABLE IF NOT EXISTS scans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            image_path TEXT NOT NULL,
            disease TEXT DEFAULT 'Pending',
            confidence REAL DEFAULT 0.0,
            description TEXT DEFAULT 'Analysis pending',
            crop_type TEXT DEFAULT 'general'
        )
    ''')

    # -----------------------------
    # Chats Table
    # -----------------------------
    conn.execute('''
        CREATE TABLE IF NOT EXISTS chats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            scan_id INTEGER,
            user_message TEXT NOT NULL,
            ai_response TEXT NOT NULL,
            FOREIGN KEY (scan_id) REFERENCES scans (id)
        )
    ''')

    # -----------------------------
    # Actions Table
    # -----------------------------
    conn.execute('''
        CREATE TABLE IF NOT EXISTS actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            action_type TEXT NOT NULL,
            data TEXT
        )
    ''')

    # -----------------------------
    # Weather Table
    # -----------------------------
    conn.execute('''
        CREATE TABLE IF NOT EXISTS weather (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME NOT NULL,
            temperature REAL,
            humidity REAL,
            description TEXT,
            location TEXT
        )
    ''')

    conn.commit()
    conn.close()


# ---------------------------------------------------------
# CONNECTION WRAPPER
# ---------------------------------------------------------
def get_db_connection():
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------
# HELPER FUNCTIONS
# ---------------------------------------------------------
def add_sensor_data(moisture, temperature, humidity):
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO sensors (timestamp, moisture, temperature, humidity)
        VALUES (?, ?, ?, ?)
    ''', (datetime.now(), moisture, temperature, humidity))
    conn.commit()
    conn.close()


def add_scan(image_path, disease='Pending', confidence=0.0, description='Analysis pending'):
    conn = get_db_connection()
    cursor = conn.execute('''
        INSERT INTO scans (timestamp, image_path, disease, confidence, description)
        VALUES (?, ?, ?, ?, ?)
    ''', (datetime.now(), image_path, disease, confidence, description))
    scan_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return scan_id


def update_scan(scan_id, disease, confidence, description):
    conn = get_db_connection()
    conn.execute('''
        UPDATE scans 
        SET disease = ?, confidence = ?, description = ?
        WHERE id = ?
    ''', (disease, confidence, description, scan_id))
    conn.commit()
    conn.close()


def add_chat(scan_id, user_message, ai_response):
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO chats (timestamp, scan_id, user_message, ai_response)
        VALUES (?, ?, ?, ?)
    ''', (datetime.now(), scan_id, user_message, ai_response))
    conn.commit()
    conn.close()


def add_action(action_type, data):
    conn = get_db_connection()
    conn.execute('''
        INSERT INTO actions (timestamp, action_type, data)
        VALUES (?, ?, ?)
    ''', (datetime.now(), action_type, data))
    conn.commit()
    conn.close()


def get_recent_sensors(limit=100):
    conn = get_db_connection()
    rows = conn.execute(f'''
        SELECT * FROM sensors
        ORDER BY timestamp DESC
        LIMIT {limit}
    ''').fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_scans(limit=None):
    conn = get_db_connection()

    if limit:
        rows = conn.execute('''
            SELECT * FROM scans ORDER BY timestamp DESC LIMIT ?
        ''', (limit,)).fetchall()
    else:
        rows = conn.execute('''
            SELECT * FROM scans ORDER BY timestamp DESC
        ''').fetchall()

    conn.close()
    return [dict(r) for r in rows]


def get_chat_history(scan_id):
    conn = get_db_connection()
    rows = conn.execute('''
        SELECT * FROM chats
        WHERE scan_id = ?
        ORDER BY timestamp ASC
    ''', (scan_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_recent_actions(limit=50):
    conn = get_db_connection()
    rows = conn.execute('''
        SELECT * FROM actions
        ORDER BY timestamp DESC
        LIMIT ?
    ''', (limit,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]
