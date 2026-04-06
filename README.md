# 🎯 Smart Stopwatch

A **face-recognition powered presence tracker** that automatically starts and stops a stopwatch based on who is sitting in front of the camera. Built with Python, Flask, React, and OpenCV.

---

## ✨ Features

- 👤 **Face Enrollment** — Register users via webcam or photo upload
- 🎥 **Real-time Detection** — Continuously monitors the camera for the selected person
- ⏱️ **Auto Stopwatch** — Timer starts when the person is detected, stops when they leave
- 🚫 **Unauthorized Detection** — Flags unrecognized faces
- 📋 **Session Logging** — Tracks and stores session durations with timestamps
- 🎨 **Modern UI** — Glassmorphic dark theme with neon accents (React + Tailwind CSS)
- 📱 **Responsive** — Works on desktop and mobile

---

## 🖥️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask, Flask-CORS |
| Face Recognition | `face_recognition`, `dlib`, OpenCV |
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS 4 |
| Icons | Lucide React |
| Fonts | Space Grotesk, Manrope (Google Fonts) |

---

## 📁 Project Structure

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
├── static/                 # Static assets
└── typings/                # Type stubs for face_recognition
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- A webcam

---

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/smart-stopwatch.git
cd smart-stopwatch
```

### 2. Set Up Python Backend

```powershell
# Create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Upgrade pip
python -m pip install --upgrade pip setuptools wheel

# Install dependencies
pip install -r requirements.txt
```

> ⚠️ **Windows note:** `face_recognition` depends on `dlib`, which can be tricky to build.
> If you get compiler errors, try one of these:
> - **Conda:** `conda create -n fr python=3.10 -c conda-forge dlib face_recognition`
> - Install a **prebuilt `dlib` wheel** for your Python version, then `pip install face_recognition`
> - Install **Visual Studio Build Tools** (C++ workload) to compile dlib from source

### 3. Start the Flask Backend

```powershell
python app.py
```

The backend will start at `http://localhost:5000` and open the browser automatically.

### 4. Set Up React Frontend (Optional Dev Mode)

```bash
npm install
npm run dev
```

Frontend will be available at `http://localhost:3000`

---

## ⚙️ Configuration

Edit `config.py` to customize behavior:

```python
FACE_TOLERANCE = 0.45        # Face match strictness (lower = stricter)
BUFFER_TIME = 2              # Seconds before presence state changes
POLL_INTERVAL = 2.0          # Seconds between camera frames
CAMERA_MAX_RETRIES = 5       # Max camera reconnection attempts
SENSOR_ID = "123"            # Unique sensor identifier
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/status` | Get current presence status |
| `POST` | `/status` | Update status from external sensor |
| `GET` | `/authorized-users` | List enrolled users |
| `POST` | `/enroll` | Enroll user via webcam |
| `POST` | `/enroll-photo` | Enroll user via photo upload |
| `POST` | `/remove-user` | Remove an enrolled user |
| `POST` | `/select-user` | Set the user to monitor |
| `GET` | `/selected-user` | Get currently monitored user |
| `GET` | `/session-log` | Get session history |
| `POST` | `/delete-log` | Clear session log |

---

## 🔒 Security Notes

The following files are **excluded from this repository** via `.gitignore`:

- `known_faces.pkl` — Contains biometric face encodings
- `authorized_users.json` — List of enrolled users
- `enrolled_thumbnails/` — Face thumbnail images
- `.env` — Environment variables / secrets
- `*.log` — Application logs

> ⚠️ Never commit biometric data or API keys to a public repository.

---

## 📄 License

MIT License — feel free to use, modify, and distribute.
