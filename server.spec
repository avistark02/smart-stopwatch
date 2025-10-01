# -*- mode: python ; coding: utf-8 -*-

from PyInstaller.utils.hooks import collect_data_files

a = Analysis(
    ['server.py'],
    pathex=['C:\\Users\\HP\\Desktop\\smart-stopwatch'],
    binaries=[],
    datas=[
         ('templates/index.html', 'templates')
        ('static/styles.css', 'static'),
        ('static/script.js', 'static'),
        ('status.json', '.'),
        ('detect_and_send.py', '.'),
        ('send_status.py', '.'),
    ],
    hiddenimports=['flask', 'cv2', 'requests'],  # Add any other modules you use
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=1,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='ProximityStopwatch',
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,  # Set to True if you want terminal output
    disable_windowed_traceback=True,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
