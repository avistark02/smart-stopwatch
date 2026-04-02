# Installing dependencies (Windows / PowerShell)

Recommended minimal steps to get `detect_and_send.py` running on Windows.

1) Create and activate a virtual environment (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel
```

2) Install runtime requirements:

```powershell
pip install -r requirements.txt
```

Notes for Windows:
- `face_recognition` depends on `dlib`, which can be tricky to build on Windows.
  If `pip install face_recognition` fails with compiler errors, consider one of:
  - Use Conda: `conda create -n fr python=3.10 -c conda-forge dlib face_recognition`
  - Install a prebuilt wheel for `dlib` (search for `dlib` wheels compatible with your
    Python version and architecture) and then `pip install face_recognition`.
  - Install Visual Studio Build Tools (C++ workload) if you prefer compiling dlib from source.

If you just want Pylance to stop reporting "could not be resolved" while you
work in the editor, the repository already contains a small stub under
`typings/face_recognition` and `.vscode/settings.json` points Pylance there.
Remove or ignore the stub once you've installed the real package in your
virtual environment.
