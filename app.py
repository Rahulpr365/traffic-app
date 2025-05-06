import sqlite3
from flask import Flask, render_template, request, g, jsonify, redirect, url_for, session
import os
from datetime import datetime
import secrets
import uuid
from werkzeug.utils import secure_filename
import requests
from dotenv import load_dotenv
import click
from flask.cli import with_appcontext
from functools import wraps
from werkzeug.security import generate_password_hash, check_password_hash

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY')
if not app.config['SECRET_KEY']:
    print("WARNING: SECRET_KEY environment variable not set. Using a default (INSECURE FOR PRODUCTION).")
    app.config['SECRET_KEY'] = 'a_temporary_insecure_default_key_replace_me'


UPLOAD_FOLDER = 'uploads/img'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

upload_dir_path = os.path.join(app.static_folder, app.config['UPLOAD_FOLDER'])
os.makedirs(upload_dir_path, exist_ok=True)
print(f"Upload folder path ensured: {upload_dir_path}")


DATABASE = 'complaints.db'

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_db(error):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    with app.app_context():
        db = get_db()
        try:
            with app.open_resource('schema.sql', mode='r') as f:
                db.cursor().executescript(f.read())
            db.commit()
            print("Database initialized successfully.")
        except FileNotFoundError:
             print("Error: schema.sql not found.")
        except Exception as e:
             print(f"Error initializing database: {e}")

@click.command('init-db')
@with_appcontext
def init_db_command():
    init_db()
    click.echo('Initialized the database.')

app.cli.add_command(init_db_command)


GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
if not GOOGLE_API_KEY:
    print("WARNING: GOOGLE_API_KEY environment variable not set. Geolocation fetching and Maps may not work.")

GOOGLE_MAPS_JS_API_KEY = os.environ.get('GOOGLE_API_KEY')
if not GOOGLE_MAPS_JS_API_KEY:
     print("WARNING: GOOGLE_API_KEY not set, Google Maps JavaScript API may not work on dashboard.")


ADMIN_API_KEY = os.environ.get('ADMIN_API_KEY')
if not ADMIN_API_KEY:
    print("WARNING: ADMIN_API_KEY environment variable not set. External API endpoint (/api/complaints) will not be secured.")

ADMIN_USERNAME = os.environ.get('ADMIN_USERNAME', 'Admin')
ADMIN_PASSWORD_FROM_ENV = os.environ.get('ADMIN_PASSWORD', 'pass')

ADMIN_PASSWORD_HASH = generate_password_hash(ADMIN_PASSWORD_FROM_ENV)


def api_key_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not ADMIN_API_KEY:
            print("WARNING: API_KEY_REQUIRED decorator skipped because ADMIN_API_KEY is not set on server.")
            return f(*args, **kwargs)

        api_key = request.headers.get('X-API-Key')

        if api_key and secrets.compare_digest(api_key, ADMIN_API_KEY):
            return f(*args, **kwargs)
        else:
            return jsonify({'success': False, 'message': 'Unauthorized: Invalid or missing API Key.'}), 401

    return decorated_function

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session or not session['logged_in']:
            return redirect(url_for('admin_login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function


@app.route('/')
def index():
    return render_template('index.html')

@app.route('/history')
def history():
    db = get_db()
    complaints = db.execute('SELECT * FROM complaints ORDER BY rowid DESC').fetchall()
    return render_template('history.html', complaints=complaints)

@app.route('/admin-dashboard')
@login_required
def admin_dashboard():
    db = get_db()
    complaints = db.execute('SELECT * FROM complaints ORDER BY rowid DESC').fetchall()
    return render_template('admin-dashboard.html', complaints=complaints, google_maps_api_key=GOOGLE_MAPS_JS_API_KEY)

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    error = None
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')

        if username == ADMIN_USERNAME and check_password_hash(ADMIN_PASSWORD_HASH, password):
            session['logged_in'] = True
            next_page = request.args.get('next') or url_for('admin_dashboard')
            return redirect(next_page)
        else:
            error = 'Invalid credentials'
    return render_template('admin-login.html', error=error)

@app.route('/admin/logout')
@login_required
def admin_logout():
    session.pop('logged_in', None)
    return redirect(url_for('admin_login'))


@app.route('/api/complaints', methods=['GET'])
@api_key_required
def api_get_complaints():
    db = get_db()
    complaints = db.execute('SELECT * FROM complaints ORDER BY rowid DESC').fetchall()
    return jsonify([dict(c) for c in complaints])

@app.route('/admin/api/complaints/<complaint_id>/status', methods=['PUT'])
@login_required
def admin_api_update_complaint_status(complaint_id):
    data = request.get_json()
    new_status = data.get('status')

    if not new_status:
        return jsonify({'success': False, 'message': 'New status not provided.'}), 400

    valid_statuses = ['open', 'hold', 'rejected', 'completed']
    if new_status.lower() not in valid_statuses:
         return jsonify({'success': False, 'message': f'Invalid status provided. Must be one of: {", ".join(valid_statuses)}'}), 400

    db = get_db()
    try:
        cursor = db.execute(
            'UPDATE complaints SET status = ? WHERE complaint_id = ?',
            (new_status.lower(), complaint_id)
        )
        db.commit()

        if cursor.rowcount == 0:
            return jsonify({'success': False, 'message': f'Complaint with ID {complaint_id} not found.'}), 404

        print(f"Complaint {complaint_id} status updated to {new_status}.")
        return jsonify({'success': True, 'message': 'Complaint status updated.', 'complaint_id': complaint_id, 'new_status': new_status}), 200
    except sqlite3.Error as e:
        db.rollback()
        print(f"Database error updating status: {e}")
        return jsonify({'success': False, 'message': 'Database error updating status.'}), 500
    except Exception as e:
        print(f"Unexpected error updating status: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred during status update.'}), 500


@app.route('/submit_complaint', methods=['POST'])
def submit_complaint():
    vehicle_no = request.form.get('vehicle-no')
    violation_type = request.form.get('violation-type')
    location = request.form.get('offence-location')
    latitude = request.form.get('latitude')
    longitude = request.form.get('longitude')

    date_input_str = request.form.get('date')
    time_str = request.form.get('time')

    date_str_db = None
    if date_input_str:
        try:
            date_obj = datetime.strptime(date_input_str, '%Y-%m-%d')
            date_str_db = date_obj.strftime('%d-%m-%Y')
        except ValueError:
            print(f"Warning: Received unexpected date format: {date_input_str}")
            date_str_db = date_input_str

    if not date_str_db or not time_str:
        now = datetime.now()
        date_str_db = now.strftime('%d-%m-%Y')
        time_str = now.strftime('%H:%M')

    lat_real = None
    lon_real = None
    try:
        if latitude: lat_real = float(latitude)
        if longitude: lon_real = float(longitude)
    except ValueError:
        print(f"Warning: Received invalid latitude ({latitude}) or longitude ({longitude}). Storing as None.")
        lat_real = None
        lon_real = None


    state = request.form.get('state')
    comment = request.form.get('comment')

    if not vehicle_no:
        return jsonify({'success': False, 'message': 'Vehicle number is required.'}), 400

    complaint_id = str(uuid.uuid4())

    uploaded_file = request.files.get('media')
    file_path_relative_to_static = None

    if uploaded_file and uploaded_file.filename:
        original_filename = secure_filename(uploaded_file.filename)
        if original_filename:
            file_extension = os.path.splitext(original_filename)[1]
            unique_filename = f"{complaint_id}{file_extension}"
            full_save_path = os.path.join(upload_dir_path, unique_filename)

            try:
                uploaded_file.save(full_save_path)
                file_path_relative_to_static = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename).replace('\\', '/')
                print(f"File saved successfully: {full_save_path}")
            except Exception as e:
                 print(f"Error saving file {original_filename}: {e}")
                 file_path_relative_to_static = None

    db = get_db()
    try:
        db.execute(
            'INSERT INTO complaints (complaint_id, vehicle_no, violation_type, location, latitude, longitude, date, time, state, comment, file_path, status)'
            ' VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            (complaint_id, vehicle_no, violation_type, location, lat_real, lon_real, date_str_db, time_str, state, comment, file_path_relative_to_static, 'open')
        )
        db.commit()
        print(f"Complaint {complaint_id} saved to DB.")
        return jsonify({'success': True, 'message': 'Complaint registered successfully!', 'complaint_id': complaint_id}), 201
    except sqlite3.Error as e:
        db.rollback()
        print(f"Database error during insert: {e}")
        return jsonify({'success': False, 'message': 'Database error registering complaint.'}), 500
    except Exception as e:
        print(f"Unexpected error during submission: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred during submission.'}), 500


@app.route('/geocode', methods=['POST'])
def geocode():
    if not GOOGLE_API_KEY:
        return jsonify({'success': False, 'message': 'Server is not configured with a Google API key.'}), 500

    data = request.get_json()
    lat = data.get('lat')
    lon = data.get('lon')

    if lat is None or lon is None:
        return jsonify({'success': False, 'message': 'Latitude and longitude not provided.'}), 400

    geocode_url = f"https://maps.googleapis.com/maps/api/geocode/json?latlng={lat},{lon}&key={GOOGLE_API_KEY}"

    try:
        response = requests.get(geocode_url)
        response.raise_for_status()
        geocode_data = response.json()

        if geocode_data['status'] == 'OK' and geocode_data['results']:
            formatted_address = geocode_data['results'][0]['formatted_address'] # Corrected variable name
            return jsonify({'success': True, 'address': formatted_address, 'lat': lat, 'lon': lon})
        elif geocode_data['status'] == 'ZERO_RESULTS':
             return jsonify({'success': True, 'address': 'No address found for these coordinates.', 'lat': lat, 'lon': lon})
        else:
            api_status = geocode_data.get('status', 'UNKNOWN_STATUS')
            error_message = geocode_data.get('error_message', 'No specific error message.')
            print(f"Google Geocoding API returned status: {api_status}, Error: {error_message}")
            return jsonify({'success': False, 'message': f"Geocoding API error: {error_message} (Status: {api_status})"}), 500

    except requests.exceptions.RequestException as e:
        print(f"HTTP Request error calling Google Geocoding API: {e}")
        return jsonify({'success': False, 'message': f"Network error fetching location: {e}"}), 500
    except Exception as e:
        print(f"Server error during geocoding processing: {e}")
        # Added a check for geocode_data before accessing it in the error handler
        error_info = {}
        if 'geocode_data' in locals() and isinstance(geocode_data, dict): # Check if geocode_data is a dict
             error_info['google_status'] = geocode_data.get('status')
             error_info['google_error_message'] = geocode_data.get('error_message')
        print(f"Server error during geocoding processing: {e}. Data received from Google (if any): {error_info}")

        return jsonify({'success': False, 'message': f"An unexpected server error occurred during geocoding: {e}"}), 500


if __name__ == '__main__':
    print("Running Flask app. Remember to initialize the database using 'flask --app app.py init-db' first.")
    app.run(debug=False)