from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import json
import os
import logging

from config import STATUS_FILE, LOG_LEVEL, LOG_FILE
from storage import normalize_name, load_authorized_users

# Configure logging
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(LOG_FILE),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)

# Valid presence values
VALID_PRESENCE_VALUES = {"active", "inactive", "error"}


def load_status():
    if os.path.exists(STATUS_FILE):
        try:
            with open(STATUS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            logger.error(f"Failed to load status: {e}")
            return {}
    return {}


def save_status(data):
    try:
        with open(STATUS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
        logger.debug(f"Saved status: {data}")
    except Exception as e:
        logger.error(f"Failed to save status: {e}")


@app.route('/')
def home():
    return render_template('index.html')


@app.route('/status', methods=['POST'])
def update_status():
    try:
        data = request.get_json(force=True)
        if not data:
            logger.warning("Status update with no JSON data")
            return jsonify({'error': 'No JSON received'}), 400

        sensor_id = data.get('id', '').strip()
        presence = (data.get('Presence', 'inactive') or 'inactive').strip()
        who = data.get('who')
        if who:
            who = normalize_name(who)

        # Validate sensor_id
        if not sensor_id:
            logger.warning("Status update missing sensor ID")
            return jsonify({'error': 'Sensor ID required'}), 400

        # Validate presence value
        if presence not in VALID_PRESENCE_VALUES:
            logger.warning(f"Invalid presence value: {presence}")
            return jsonify({'error': f'Invalid presence value. Must be one of {VALID_PRESENCE_VALUES}'}), 400

        status = load_status()
        status[sensor_id] = {
            'Presence': presence,
            'who': who
        }
        save_status(status)
        logger.info(f"Updated status for {sensor_id}: {presence}, who={who}")
        return '', 204

    except Exception as e:
        logger.error(f"Error updating status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/status/<sensor_id>', methods=['GET'])
def get_status(sensor_id):
    try:
        if not sensor_id or not sensor_id.strip():
            return jsonify({'error': 'Invalid sensor ID'}), 400

        status = load_status()
        entry = status.get(sensor_id, {'Presence': 'inactive', 'who': None})
        return jsonify(entry)
    except Exception as e:
        logger.error(f"Error retrieving status: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/authorized-users', methods=['GET'])
def get_authorized_users():
    try:
        with open('authorized_users.json', 'r') as f:
            users = json.load(f)
        return jsonify(users)
    except FileNotFoundError:
        return jsonify([])
    except Exception as e:
        logger.error(f"Error loading authorized users: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/enroll', methods=['POST'])
def enroll_user():
    data = request.get_json()
    name = (data.get('name') or '').strip() if data else ''
    if not name:
        logger.warning("Enrollment attempted without name")
        return jsonify({'success': False, 'message': 'Name required'}), 400
    logger.info(f"Enrollment must be done via CLI for: {name}")
    return jsonify({'success': False, 'message': 'Enrollment must be done via CLI: python detect_and_send.py --enroll NAME'}), 400


@app.route('/remove-user', methods=['POST'])
def remove_user():
    try:
        data = request.get_json()
        name = normalize_name(data.get('name') or '') if data else ''
        if not name:
            return jsonify({'success': False, 'message': 'Name required'}), 400

        users = load_authorized_users()
        if name in users:
            users = [u for u in users if u != name]
            from storage import save_authorized_users
            save_authorized_users(users)
            logger.info(f"Removed user: {name}")
            return jsonify({'success': True})
        else:
            logger.warning(f"Attempted to remove non-existent user: {name}")
            return jsonify({'success': False, 'message': 'User not found'}), 404
    except Exception as e:
        logger.error(f"Error removing user: {e}")
        return jsonify({'success': False, 'message': str(e)}), 500


if __name__ == '__main__':
    logger.info("Starting server on port 5000")
    app.run(port=5000, debug=os.getenv("FLASK_DEBUG", "0") == "1")
