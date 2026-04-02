let timerInterval = null;
let elapsedTime = 0;
let isRunning = false;
let lastInactiveTime = null;
let currentPresence = "inactive";
let sessionStart = null;
let lastUpdateTime = Date.now();
const sensorId = "123";
const bufferThreshold = 2; // seconds of sustained presence required
let presenceConfirmed = false;
let presenceBufferStart = null;
let sessionLog = []; // Track session events

// Proximity is driven by the server: select a user in "Authorized Users".
// Runs when that person is in frame (others may be present). Unauthorized if no face matches them.

// Logging System
function logEvent(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, level };
  sessionLog.push(logEntry);
  addLogEntry(message, level);
  console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`);
}

function addLogEntry(message, level = 'info') {
  const logList = document.getElementById('log-entries');
  if (!logList) return;
  
  const li = document.createElement('li');
  const time = new Date().toLocaleTimeString();
  
  // Add color based on log level
  const colorClass = {
    'info': 'log-info',
    'success': 'log-success',
    'warning': 'log-warning',
    'error': 'log-error'
  }[level] || 'log-info';
  
  li.className = colorClass;
  li.textContent = `[${time}] ${message}`;
  logList.appendChild(li);
  
  // Keep only last 20 entries
  while (logList.children.length > 20) {
    logList.removeChild(logList.firstChild);
  }
  
  // Auto-scroll to bottom
  logList.scrollTop = logList.scrollHeight;
}

function pad(num) {
  return num.toString().padStart(2, "0");
}

function updateDisplay() {
  const hrs = Math.floor(elapsedTime / 3600);
  const mins = Math.floor((elapsedTime % 3600) / 60);
  const secs = elapsedTime % 60;
  document.getElementById("stopwatch").textContent =
    `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function updateStatus(text, color = "🔵", who = null) {
  const el = document.getElementById("status");
  if (who) {
    el.textContent = `${color} ${text} — ${who}`;
  } else {
    el.textContent = `${color} ${text}`;
  }
}

function startStopwatch() {
  if (!isRunning) {
    timerInterval = setInterval(() => {
      elapsedTime++;
      updateDisplay();
    }, 1000);
    isRunning = true;
    sessionStart = new Date().toISOString();
    updateStatus("Running", "🟢");
  }
}

function stopStopwatch() {
  if (isRunning) {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    lastInactiveTime = new Date();
    const sessionEnd = new Date().toISOString();
    logEvent(`Session stopped: ${sessionStart} → ${sessionEnd}`, 'warning');
    updateStatus("Paused", "⏸️");
  }
}

function resumeStopwatch() {
  if (!isRunning) {
    const now = new Date();
    if (lastInactiveTime) {
      const lap = Math.floor((now - lastInactiveTime) / 1000);
      logEvent(`Absence duration: ${lap} seconds`, 'info');
    }
    startStopwatch();
  }
}

function handlePresence(status, who = null) {
  // status: 'active', 'inactive', or 'error'
  if (status === "active") {
    if (!presenceConfirmed) {
      if (!presenceBufferStart) presenceBufferStart = Date.now();
      const bufferedTime = (Date.now() - presenceBufferStart) / 1000;
      if (bufferedTime >= bufferThreshold) {
        presenceConfirmed = true;
        logEvent(`Presence confirmed: ${who || 'unknown'}`, 'success');
        resumeStopwatch();
      }
    }
    updateStatus("Running", "🟢", who);
  } else if (status === "error") {
    presenceBufferStart = null;
    presenceConfirmed = false;
    stopStopwatch();
    const detail =
      who === "unauthorized" || !who
        ? "selected person not recognized"
        : String(who);
    updateStatus("Unauthorized", "🔴", detail);
    logEvent(`Unauthorized: ${detail}`, 'error');
  } else {
    presenceBufferStart = null;
    presenceConfirmed = false;
    stopStopwatch();
    updateStatus("Paused", "⏸️");
    logEvent('Presence lost', 'warning');
  }
}

function pollPresence() {
  fetch(`/status/${sensorId}`)
    .then(res => res.json())
    .then(data => {
      // data is expected to be { Presence: 'active'|'inactive'|'error', who: <name>|null }
      const reportedPresence = data.Presence || 'inactive';
      const who = data.who || null;
      lastUpdateTime = Date.now();

      if (reportedPresence !== currentPresence) {
        currentPresence = reportedPresence;
        handlePresence(reportedPresence, who);
      } else if (reportedPresence === 'active') {
        handlePresence('active', who); // continue buffering
      } else {
        // keep status updated even when unchanged
        const color = reportedPresence === 'active' ? '🟢' : (reportedPresence === 'error' ? '🔴' : '⏸️');
        const text =
          reportedPresence === 'active'
            ? 'Running'
            : reportedPresence === 'error'
              ? 'Unauthorized'
              : 'Paused';
        const whoDisplay =
          reportedPresence === 'error'
            ? who === 'unauthorized' || !who
              ? 'selected person not recognized'
              : who
            : who;
        updateStatus(text, color, whoDisplay);
      }
    })
    .catch(err => {
      logEvent(`Polling error: ${err.message}`, 'error');
    });
}

setInterval(pollPresence, 1000);

setInterval(() => {
  if (Date.now() - lastUpdateTime > 10000 && currentPresence !== "inactive") {
    logEvent('Watchdog triggered: no status update, setting inactive', 'warning');
    currentPresence = "inactive";
    handlePresence("inactive");
  }
}, 3000);

// User Management
function makeFacePlaceholder(variant) {
  const placeholder = document.createElement('div');
  placeholder.className = 'user-face-thumb user-face-thumb--placeholder';
  placeholder.setAttribute('aria-hidden', 'true');
  placeholder.title =
    variant === 'legacy'
      ? 'Face is still enrolled for the stopwatch — only the picture is missing. Re-enroll (webcam or upload photo) with the same name to add it.'
      : 'No photo — re-enroll to save a face thumbnail';
  placeholder.textContent = '?';
  return placeholder;
}

function loadAuthorizedUsers() {
  fetch('/authorized-users')
    .then(res => res.json())
    .then(users => {
      const list = document.getElementById('authorized-users-list');
      list.innerHTML = '';
      users.forEach((entry) => {
        const name = typeof entry === 'string' ? entry : entry.name;
        const photoUrl = typeof entry === 'object' && entry && entry.photo_url
          ? entry.photo_url
          : null;
        const hasThumb =
          typeof entry === 'object' && entry && Object.prototype.hasOwnProperty.call(entry, 'has_thumbnail')
            ? entry.has_thumbnail
            : null;

        const li = document.createElement('li');
        li.className = 'authorized-user-row';

        if (hasThumb === false) {
          li.appendChild(makeFacePlaceholder('legacy'));
        } else if (photoUrl) {
          const img = document.createElement('img');
          img.className = 'user-face-thumb';
          img.src = photoUrl;
          img.alt = `Face: ${name}`;
          img.width = 56;
          img.height = 56;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.onerror = () => {
            img.replaceWith(makeFacePlaceholder());
          };
          li.appendChild(img);
        } else {
          li.appendChild(makeFacePlaceholder());
        }

        const label = document.createElement('span');
        label.className = 'user-name-label';
        label.textContent = name;
        li.appendChild(label);

        const selectBtn = document.createElement('button');
        selectBtn.textContent = '✅ Select';
        selectBtn.onclick = () => selectUser(name);
        li.appendChild(selectBtn);

        const removeBtn = document.createElement('button');
        removeBtn.textContent = '❌ Remove';
        removeBtn.onclick = () => removeUser(name);
        li.appendChild(removeBtn);

        list.appendChild(li);
      });
      logEvent(`Loaded ${users.length} authorized users`, 'info');
    })
    .catch(err => {
      logEvent(`Error loading users: ${err.message}`, 'error');
    });
}

function loadSelectedUser() {
  fetch('/selected-user')
    .then(res => res.json())
    .then(data => {
      const element = document.getElementById('selected-person');
      if (data && data.selected) {
        element.textContent = data.selected;
        logEvent(`Selected user: ${data.selected}`, 'info');
      } else {
        element.textContent = 'None';
      }
    })
    .catch(err => {
      logEvent(`Error loading selected user: ${err.message}`, 'error');
    });
}

function selectUser(name) {
  fetch('/select-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        document.getElementById('selected-person').textContent = name;
        logEvent(`Selected ${name} for proximity control`, 'success');
        alert(`Selected ${name} for stopwatch proximity control`);
      } else {
        logEvent(`Select failed: ${data.message}`, 'error');
        alert('Select failed: ' + (data.message || 'unknown'));
      }
    })
    .catch(err => {
      logEvent(`Select user error: ${err.message}`, 'error');
    });
}


function enrollFromPhoto() {
  const name = document.getElementById('new-user-name').value;
  const fileInput = document.getElementById('photo-upload');
  if (!name.trim()) {
    alert('Please enter a name');
    return;
  }
  if (!fileInput.files || !fileInput.files[0]) {
    alert('Please choose a photo file');
    return;
  }
  const fd = new FormData();
  fd.append('name', name.trim());
  fd.append('photo', fileInput.files[0]);
  logEvent(`Uploading photo to enroll "${name.trim()}"...`, 'info');
  fetch('/enroll-photo', {
    method: 'POST',
    body: fd
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        logEvent(data.message || 'Enrolled from photo', 'success');
        fileInput.value = '';
        loadAuthorizedUsers();
      } else {
        logEvent(`Photo enrollment failed: ${data.message}`, 'error');
        alert('Photo enrollment failed: ' + (data.message || 'unknown'));
      }
    })
    .catch(err => {
      logEvent(`Photo enrollment error: ${err.message}`, 'error');
      alert('Photo enrollment error: ' + err.message);
    });
}

function enrollUser(name) {
  if (!name.trim()) {
    alert('Please enter a name');
    return;
  }
  logEvent(`Starting webcam enrollment for ${name.trim()}`, 'info');
  fetch('/enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: name.trim() })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      logEvent(`Enrollment successful for ${name.trim()}`, 'success');
      alert('Enrollment successful');
      loadAuthorizedUsers();
     } else {
      logEvent(`Enrollment failed: ${data.message}`, 'error');
      alert('Enrollment failed: ' + data.message);
    }
  })
  .catch(err => {
    logEvent(`Enrollment error: ${err.message}`, 'error');
  });
}

function removeUser(name) {
  if (!confirm(`Remove ${name} from authorized users?`)) return;
  logEvent(`Removing user: ${name}`, 'warning');
  fetch('/remove-user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  })
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      logEvent(`User removed: ${name}`, 'success');
      loadAuthorizedUsers();
    } else {
      logEvent(`Remove failed: ${data.message}`, 'error');
      alert('Remove failed: ' + data.message);
    }
  })
  .catch(err => {
    logEvent(`Remove error: ${err.message}`, 'error');
  });
}

// Event listeners
document.getElementById('enroll-btn').addEventListener('click', () => {
  const name = document.getElementById('new-user-name').value;
  enrollUser(name);
  document.getElementById('new-user-name').value = '';
});

document.getElementById('enroll-photo-btn').addEventListener('click', () => {
  enrollFromPhoto();
});

document.getElementById('restart-btn').addEventListener('click', () => {
  elapsedTime = 0;
  updateDisplay();
  stopStopwatch();
  updateStatus("Idle", "🔵");
  logEvent('Stopwatch restarted', 'info');
});

// Load users and selected person on page load
window.addEventListener('DOMContentLoaded', () => {
  logEvent('Application started', 'info');
  loadAuthorizedUsers();
  loadSelectedUser();
});

