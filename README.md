# Smart Stopwatch

I built this because I wanted a smarter way to track time — one that doesn't rely on me remembering to start or stop a timer. The idea is simple: the app watches the camera, recognizes your face, and runs the stopwatch only while you're actually there. Walk away, it stops. Come back, it resumes.

It's a Python + Flask backend with a React frontend. The face recognition is handled by the `face_recognition` library (built on top of dlib), and the UI is built with Vite, TypeScript, and Tailwind CSS.

---

## What it does

- Enroll people using their webcam or a photo
- Select who to monitor — the camera checks for that person
- Stopwatch starts automatically when they're detected, stops when they leave
- Flags unauthorized faces (someone else sitting in front of the camera)
- Logs every session with start time, end time, and duration
- Clean dark UI with real-time updates

---

## Tech Stack

- **Backend:** Python, Flask, Flask-CORS
- **Face Recognition:** `face_recognition`, `dlib`, OpenCV
- **Frontend:** React 19, Vite 6, TypeScript, Tailwind CSS 4
- **Icons:** Lucide React
- **Fonts:** Space Grotesk, Manrope

---

## Project Structure

```
smart-stopwatch/
├── app.py                  # Flask backend & API routes
├── detect_and_send.py      # Face detection & enrollment logic
├── storage.py              # Data persistence helpers
├── config.py               # App configuration settings
├── server.py               # Standalone sensor server
├── requirements.txt        # Python dependencies
├── src/                    # React frontend source
├── templates/              # Flask HTML templates
└── static/                 # Static assets
```

---

## Getting Started

You'll need Python 3.10+, Node.js 18+, and a webcam.

### 1. Clone the repo

```bash
git clone https://github.com/avistark02/smart-stopwatch.git
cd smart-stopwatch
```

### 2. Set up the Python environment

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

> **Heads up for Windows users:** `dlib` (a dependency of `face_recognition`) can be a pain to install on Windows. If `pip install` fails with compiler errors, the easiest fix is using Conda:
> ```
> conda create -n fr python=3.10 -c conda-forge dlib face_recognition
> ```
> Alternatively, grab a prebuilt `dlib` wheel for your Python version and install that first.

### 3. Run the backend

```powershell
python app.py
```

This starts Flask at `http://localhost:5000` and opens the browser for you.

### 4. Run the frontend (optional, for dev)

```bash
npm install
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## Configuration

Most things you'd want to tweak are in `config.py`:

```python
FACE_TOLERANCE = 0.45    # How strict face matching is (lower = stricter)
BUFFER_TIME = 2          # Seconds before presence state changes
CAMERA_MAX_RETRIES = 5   # How many times it retries if the camera fails
SENSOR_ID = "123"        # Sensor identifier
```

---

## API Endpoints

| Method | Endpoint | What it does |
|---|---|---|
| `GET` | `/status` | Current presence status |
| `POST` | `/status` | Update status from a sensor |
| `GET` | `/authorized-users` | List of enrolled users |
| `POST` | `/enroll` | Enroll someone via webcam |
| `POST` | `/enroll-photo` | Enroll someone via photo |
| `POST` | `/remove-user` | Remove an enrolled user |
| `POST` | `/select-user` | Set who to monitor |
| `GET` | `/selected-user` | Who is currently being monitored |
| `GET` | `/session-log` | Full session history |
| `POST` | `/delete-log` | Clear the session log |

---

## Security Notes

These files are intentionally excluded from the repo via `.gitignore`:

- `known_faces.pkl` — stores biometric face encodings, shouldn't be public
- `authorized_users.json` — enrolled user list
- `enrolled_thumbnails/` — face images
- `*.log` — app logs

If you fork this, make sure you don't accidentally commit any of these.

---

## License

MIT — use it however you like.
