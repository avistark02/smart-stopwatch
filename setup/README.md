# What You Need Before Running Blinq : Presence time calculator using python and open cv

This folder contains a script that installs everything for you automatically.

---

## Prerequisites (Install These Manually First)

Before running the install script, make sure you have these two things installed on your system:

### 1. Python 3.10 or higher
Download from: https://www.python.org/downloads/

> During installation, check **"Add Python to PATH"** — this is important.

Check if it's already installed:
```powershell
python --version
```

### 2. Node.js 18 or higher
Download from: https://nodejs.org/

Check if it's already installed:
```powershell
node --version
```

### 3. A Webcam
Required for face enrollment and detection.

---

## Run the Install Script

Once Python and Node.js are installed, open PowerShell in the project root folder and run:

```powershell
.\setup\install.ps1
```

This script will automatically:
- Create a Python virtual environment (`.venv`)
- Upgrade pip
- Install all Python packages (`face_recognition`, `dlib`, `opencv`, `flask`, etc.)
- Install all Node.js packages for the frontend

---

## If dlib Fails to Install

`dlib` is a C++ library and can sometimes fail to build on Windows. If you see compiler errors, try one of these:

**Option 1 — Use Conda (easiest):**
```
conda create -n fr python=3.10 -c conda-forge dlib face_recognition
conda activate fr
pip install flask flask-cors opencv-python requests Pillow
```

**Option 2 — Prebuilt wheel:**

Download a prebuilt `dlib` wheel from:
https://github.com/z-mahmud22/Dlib_Windows_Python3.x

Then install it:
```powershell
pip install dlib-<version>.whl
pip install face_recognition
```

**Option 3 — Visual Studio Build Tools:**

Install from: https://visualstudio.microsoft.com/visual-cpp-build-tools/
Select the **"Desktop development with C++"** workload, then re-run the install script.

---

## After Installation

```powershell
# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Start the backend (opens browser automatically)
python app.py

# Optional: start the React frontend in dev mode
npm run dev
```
