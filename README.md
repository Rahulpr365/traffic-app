# Merao Traffic Violation Report

A web application built with Flask to report and manage traffic violations, including location tracking, media uploads, a history view, and an admin dashboard with complaint status updates and map visualization.

## Features

*   **Complaint Registration:** Users can report traffic violations by providing vehicle details, violation type, location (manual entry or fetched via geolocation), date, time, comments, and optional photo/video evidence.
*   **Geolocation Fetching:** Uses the browser's Geolocation API and a backend call to the Google Geocoding API to automatically populate the location field based on the user's current position.
*   **Media Uploads:** Supports uploading image and video files as evidence. Files are stored locally on the server.
*   **Complaint History:** Users can view a list of previously reported complaints.
*   **Admin Dashboard:** A protected area for administrators to view all complaints, see their locations on a Google Map, and update the status of each complaint (e.g., Open, Hold, Rejected, Completed).
*   **External API:** A protected API endpoint (`/api/complaints`) allowing third parties to fetch complaint data using an API key.
*   **Admin Login:** Basic session-based login system to protect the admin dashboard and admin-specific API endpoints.
*   **Configuration via .env:** Sensitive keys, credentials, and settings are loaded from a `.env` file.
*   **SQLite Database:** Complaint data is stored in a local SQLite database file (`complaints.db`).

## Technologies Used

*   **Backend:** Python 3, Flask
*   **Frontend:** HTML5, CSS3, JavaScript
*   **Database:** SQLite
*   **APIs:** Google Maps Geocoding API, Google Maps JavaScript API, Browser Geolocation API
*   **Dependencies:** `Flask`, `requests`, `python-dotenv`, `werkzeug`, `gunicorn` (for production)
*   **Frontend Libraries:** Font Awesome

## Project Structure

Merao_traffic/
├── app.py # Main Flask application file
├── requirements.txt # Python dependencies
├── schema.sql # Database schema for SQLite
├── .env # Environment variables (configure this file)
├── .env.example # Example of .env file structure
├── templates/ # HTML templates
│ ├── index.html # Complaint Registration Form
│ └── history.html # Complaint History List
│ └── admin-dashboard.html# Admin Dashboard (Protected)
│ └── admin-login.html # Admin Login Page
└── static/ # Static assets (served directly)
├── style.css # Custom CSS
├── script.js # Custom JavaScript
└── uploads/ # Directory for file uploads
└── img/ # Uploaded images/videos are stored here


## Setup

1.  **Clone or Download:** Get the project files to your local machine.
2.  **Install Python:** Ensure you have Python 3.7+ installed. Pip (Python package installer) is usually included.
3.  **Navigate to Project Directory:** Open your terminal or command prompt and go to the project folder.
    ```bash
    cd path/to/your_project_folder
    ```
4.  **Create and Activate a Virtual Environment (Recommended):**
    ```bash
    python -m venv venv
    # On Windows:
    .\venv\Scripts\activate
    # On macOS/Linux:
    source venv/bin/activate
    ```
5.  **Install Dependencies:** Install the required Python packages.
    ```bash
    pip install -r requirements.txt
    ```
6.  **Configure Environment Variables:**
    *   Create a file named `.env` in the root of your project directory.
    *   Copy the content from `.env.example` into your `.env` file.
    *   **Fill in your actual, secure keys and credentials.**
    *   **SECRET_KEY:** Generate a strong random string (e.g., `python -c 'import secrets; print(secrets.token_hex(24))'`). This is crucial for Flask session security.
    *   **GOOGLE_API_KEY:** Obtain a Google Cloud API key. **Ensure the Geocoding API and Maps JavaScript API are ENABLED** for the associated project. Apply appropriate restrictions (IP address for Geocoding, HTTP referrer for Maps JS) in the Google Cloud Console for security.
    *   **ADMIN_API_KEY:** Choose a strong, random string for the external API key.
    *   **ADMIN_USERNAME / ADMIN_PASSWORD:** Choose secure credentials for your admin login. **Remember these credentials.**
7.  **Initialize the Database:** This creates the SQLite database file (`complaints.db`) and the `complaints` table based on `schema.sql`.
    ```bash
    flask --app app.py init-db
    ```
    **WARNING:** This command will drop and recreate the `complaints` table, deleting any existing data. If you need to update an existing database without losing data, you would need a database migration tool.

## Running the Application

**For Development (Local Testing):**

Use the Flask development server.

```bash
flask --app app.py run --debug

This will start the server, usually at http://127.0.0.1:5000/. Debug mode provides helpful error pages and auto-reloading.
For Production (Deployment to a Server):
DO NOT use flask run --debug or python app.py in production. Use a production-ready WSGI server.
Ensure dependencies are installed including gunicorn (pip install -r requirements.txt).
Ensure your .env file is configured correctly on the server and kept secure.
Ensure your database is initialized (flask --app app.py init-db on the server if it's a new deployment).
Ensure the static/uploads/img directory exists and is writable by the user running the application.
Serve static files directly: Configure your web server (Nginx, Apache) or hosting platform to serve the static/ directory directly for better performance.
Run the application using a WSGI server:

# Example using Gunicorn (replace 'app:app' if your main Flask app object/file is named differently)
gunicorn -w 4 'app:app' -b 0.0.0.0:5000

(Adjust -w workers and -b bind address/port as needed for your server environment).
Set up HTTPS: Configure HTTPS on your web server or hosting platform.
Usage
Complaint Registration: Access the main page at / (e.g., http://127.0.0.1:5000/).
Complaint History: View past complaints at /history.
Admin Login: Access the admin login page at /admin/login. Use the username and password from your .env file.
Admin Dashboard: After logging in, you will be redirected to /admin-dashboard. Here you can see complaints on a map (if coordinates are available) and update their status.
Admin Logout: Log out from the admin session at /admin/logout.
External API: The endpoint /api/complaints provides complaint data. You must include a header X-API-Key with the value of ADMIN_API_KEY from your .env to access this endpoint. Example using curl:
curl -H "X-API-Key: YOUR_ACTUAL_ADMIN_API_KEY_FOR_EXTERNAL_API" http://127.0.0.1:5000/api/complaints

Important Considerations
.env Security: The .env file contains sensitive data. Do not share it and do not commit it to public repositories.
Admin Password: The admin password is set in the .env file and hashed at startup. To change it, edit the .env file and restart the application.
Google API Key Restrictions: Secure your Google Cloud API key by restricting it to the necessary APIs (Geocoding, Maps JS) and applications (your server's IP address for Geocoding, your domain/referrer for Maps JS) in the Google Cloud Console.
HTTPS: Always use HTTPS in production to encrypt data in transit and protect sessions.
Scalability: SQLite is suitable for small applications. For higher traffic or larger datasets, consider migrating to a more robust database like PostgreSQL or MySQL.
Error Handling & Logging: Production applications require more sophisticated error logging and monitoring than simple print statements.

