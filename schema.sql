DROP TABLE IF EXISTS complaints;
CREATE TABLE complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    complaint_id TEXT UNIQUE NOT NULL,
    vehicle_no TEXT NOT NULL,
    violation_type TEXT,
    location TEXT,
    latitude REAL,
    longitude REAL,
    date TEXT,
    time TEXT,
    state TEXT,
    comment TEXT,
    file_path TEXT,
    status TEXT DEFAULT 'open'
);