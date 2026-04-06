# ============================================================
# Smart Stopwatch - Full Installation Script (Windows)
# Run this from the project root folder:
#   .\setup\install.ps1
# ============================================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   Smart Stopwatch - Setup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Check Python ──────────────────────────────────────────
Write-Host "Checking Python..." -ForegroundColor Yellow
$pythonVersion = python --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Python not found. Please install Python 3.10+ from https://python.org" -ForegroundColor Red
    exit 1
}
Write-Host "Found: $pythonVersion" -ForegroundColor Green

# ── Check Node.js ─────────────────────────────────────────
Write-Host ""
Write-Host "Checking Node.js..." -ForegroundColor Yellow
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Node.js not found. Please install Node.js 18+ from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "Found: Node $nodeVersion" -ForegroundColor Green

# ── Create Virtual Environment ────────────────────────────
Write-Host ""
Write-Host "Setting up Python virtual environment..." -ForegroundColor Yellow
if (Test-Path ".venv") {
    Write-Host ".venv already exists, skipping creation." -ForegroundColor Gray
} else {
    python -m venv .venv
    Write-Host "Virtual environment created." -ForegroundColor Green
}

# ── Activate Virtual Environment ──────────────────────────
Write-Host ""
Write-Host "Activating virtual environment..." -ForegroundColor Yellow
& .\.venv\Scripts\Activate.ps1

# ── Upgrade pip ───────────────────────────────────────────
Write-Host ""
Write-Host "Upgrading pip..." -ForegroundColor Yellow
python -m pip install --upgrade pip setuptools wheel

# ── Install Python Dependencies ───────────────────────────
Write-Host ""
Write-Host "Installing Python dependencies..." -ForegroundColor Yellow
Write-Host "(This may take a few minutes — dlib takes a while to install)" -ForegroundColor Gray
Write-Host ""
pip install -r requirements.txt

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "ERROR: Python dependency installation failed." -ForegroundColor Red
    Write-Host ""
    Write-Host "If dlib failed to install, try one of these:" -ForegroundColor Yellow
    Write-Host "  Option 1 (Conda):    conda create -n fr python=3.10 -c conda-forge dlib face_recognition"
    Write-Host "  Option 2 (Wheel):    Download a prebuilt dlib wheel from:"
    Write-Host "                       https://github.com/z-mahmud22/Dlib_Windows_Python3.x"
    Write-Host "                       then run: pip install dlib-<version>.whl"
    Write-Host "  Option 3 (VS Tools): Install Visual Studio Build Tools with C++ workload"
    Write-Host "                       from https://visualstudio.microsoft.com/visual-cpp-build-tools/"
    exit 1
}

Write-Host ""
Write-Host "Python dependencies installed." -ForegroundColor Green

# ── Install Node.js Dependencies ──────────────────────────
Write-Host ""
Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: npm install failed." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Node.js dependencies installed." -ForegroundColor Green

# ── Done ──────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Installation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To run the app:" -ForegroundColor Cyan
Write-Host "  1. Activate venv:     .\.venv\Scripts\Activate.ps1"
Write-Host "  2. Start backend:     python app.py"
Write-Host "  3. Start frontend:    npm run dev  (optional)"
Write-Host ""
