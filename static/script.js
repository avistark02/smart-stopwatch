const sensorId = "123";
let currentPresence = "inactive";
let presenceConfirmed = false;
let presenceBufferStart = null;
const bufferThreshold = 2;
let timerInterval = null;
let elapsedTime = 0;
let isRunning = false;
let lastUpdateTime = Date.now();
let disconnected = false;
let sessionLog = [];
let sessionStart = null;
let lastInactiveTime = null;
let webcamStream = null;
let webcamActive = false;
let captureInterval = null;
const PROCESS_INTERVAL = 1500; // Poll every 1.5s to limit server load

function logEvent(message, level = "info") {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, message, level };
  sessionLog.push(logEntry);
  addLogEntry(message, level);
  console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`);
}

function addLogEntry(message, level = "info") {
  const logList = document.getElementById("log-entries");
  if (!logList) return;

  const li = document.createElement("li");
  const time = new Date().toLocaleTimeString();

  const colorClass =
    {
      info: "log-info",
      success: "log-success",
      warning: "log-warning",
      error: "log-error",
    }[level] || "log-info";

  li.className = colorClass;
  li.textContent = `[${time}] ${message}`;
  logList.appendChild(li);

  while (logList.children.length > 20) {
    logList.removeChild(logList.firstChild);
  }

  logList.scrollTop = logList.scrollHeight;
}

function pad(num) {
  return num.toString().padStart(2, "0");
}

function updateDisplay() {
  const hrs = Math.floor(elapsedTime / 3600);
  const mins = Math.floor((elapsedTime % 3600) / 60);
  const secs = elapsedTime % 60;
  document.getElementById("stopwatch").textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
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
    document.getElementById("stopwatch").classList.add("blink");
  }
}

function stopStopwatch() {
  if (isRunning) {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    lastInactiveTime = new Date();
    const sessionEnd = new Date().toISOString();
    if (sessionStart) {
      logEvent(`Session stopped: ${sessionStart} → ${sessionEnd}`, "warning");
    }
    updateStatus("Paused", "⏸️");
    document.getElementById("stopwatch").classList.remove("blink");
    loadSessionLog();
  }
}

function resumeStopwatch() {
  if (!isRunning) {
    const now = new Date();
    if (lastInactiveTime) {
      const lap = Math.floor((now - lastInactiveTime) / 1000);
      logEvent(`Absence duration: ${lap} seconds`, "info");
    }
    startStopwatch();
  }
}

function handlePresence(status, who = null) {
  if (status === "active") {
    if (!presenceConfirmed) {
      if (!presenceBufferStart) presenceBufferStart = Date.now();
      const bufferedTime = (Date.now() - presenceBufferStart) / 1000;
      if (bufferedTime >= bufferThreshold) {
        presenceConfirmed = true;
        logEvent(`Presence confirmed: ${who || "unknown"}`, "success");
        resumeStopwatch();
      }
    } else if (!isRunning) {
      startStopwatch();
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
    logEvent(`Unauthorized: ${detail}`, "error");
  } else {
    presenceBufferStart = null;
    presenceConfirmed = false;
    stopStopwatch();
    updateStatus("Paused", "⏸️");
    logEvent("Presence lost", "warning");
  }
}

function pollPresence() {
  fetch(`/status/${sensorId}`)
    .then((res) => res.json())
    .then((data) => {
      lastUpdateTime = Date.now();
      disconnected = false;

      const reportedPresence = data.Presence || "inactive";
      const who = data.who || null;

      if (reportedPresence !== currentPresence) {
        currentPresence = reportedPresence;
        handlePresence(reportedPresence, who);
      } else if (reportedPresence === "active") {
        handlePresence("active", who);
      } else {
        const color =
          reportedPresence === "active"
            ? "🟢"
            : reportedPresence === "error"
              ? "🔴"
              : "⏸️";
        const text =
          reportedPresence === "active"
            ? "Running"
            : reportedPresence === "error"
              ? "Unauthorized"
              : "Paused";
        const whoDisplay =
          reportedPresence === "error"
            ? who === "unauthorized" || !who
              ? "selected person not recognized"
              : who
            : who;
        updateStatus(text, color, whoDisplay);
      }
    })
    .catch((err) => {
      logEvent(`Polling error: ${err.message}`, "error");
      console.error("Polling error:", err);
      disconnected = true;
      currentPresence = "inactive";
      handlePresence("inactive");
      updateStatus("Disconnected", "⚠️");
    });
}

function loadSessionLog() {
  fetch("/session-log")
    .then((res) => res.json())
    .then((data) => {
      const logList = document.getElementById("log-entries");
      logList.innerHTML = "";

      if (!Array.isArray(data) || data.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No sessions logged yet.";
        logList.appendChild(li);
        return;
      }

      data.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

      data.forEach((entry) => {
        const li = document.createElement("li");
        const start = new Date(entry.start_time).toLocaleString();
        const end = new Date(entry.end_time).toLocaleString();
        li.textContent = `Sensor ${entry.sensor_id} | Start: ${start} | End: ${end} | Duration: ${entry.duration}s`;
        logList.appendChild(li);
      });
    })
    .catch((err) => {
      console.error("Log fetch error:", err);
      const logList = document.getElementById("log-entries");
      logList.innerHTML = "<li>Error loading session log.</li>";
    });
}

function reconnectPresence() {
  updateStatus("Reconnecting...", "🔄");
  disconnected = false;
  fetch(`/status/${sensorId}`)
    .then((res) => res.json())
    .then((data) => {
      lastUpdateTime = Date.now();
      const newPresence = data.Presence;
      currentPresence = newPresence;
      handlePresence(newPresence, data.who || null);
      updateStatus("Reconnected", "🟢");
    })
    .catch((err) => {
      console.error("Reconnect failed:", err);
      updateStatus("Still disconnected", "⚠️");
    });
}

function deleteSessionLog() {
  fetch("/delete-log", { method: "POST" })
    .then(() => {
      updateStatus("Session log cleared", "🗑️");
      loadSessionLog();
    })
    .catch((err) => {
      console.error("Delete log failed:", err);
      updateStatus("Failed to delete log", "⚠️");
    });
}

function makeFacePlaceholder(variant) {
  const placeholder = document.createElement("div");
  placeholder.className = "user-face-thumb user-face-thumb--placeholder";
  placeholder.setAttribute("aria-hidden", "true");
  placeholder.title =
    variant === "legacy"
      ? "Face is still enrolled for the stopwatch — only the picture is missing. Re-enroll (webcam or upload photo) with the same name to add it."
      : "No photo — re-enroll to save a face thumbnail";
  placeholder.textContent = "?";
  return placeholder;
}

function loadAuthorizedUsers() {
  fetch("/authorized-users")
    .then((res) => res.json())
    .then((users) => {
      const list = document.getElementById("authorized-users-list");
      list.innerHTML = "";
      users.forEach((entry) => {
        const name = typeof entry === "string" ? entry : entry.name;
        const photoUrl =
          typeof entry === "object" && entry && entry.photo_url
            ? entry.photo_url
            : null;
        const hasThumb =
          typeof entry === "object" &&
          entry &&
          Object.prototype.hasOwnProperty.call(entry, "has_thumbnail")
            ? entry.has_thumbnail
            : null;

        const li = document.createElement("li");
        li.className = "authorized-user-row";

        if (hasThumb === false) {
          li.appendChild(makeFacePlaceholder("legacy"));
        } else if (photoUrl) {
          const img = document.createElement("img");
          img.className = "user-face-thumb";
          img.src = photoUrl;
          img.alt = `Face: ${name}`;
          img.width = 56;
          img.height = 56;
          img.loading = "lazy";
          img.decoding = "async";
          img.onerror = () => {
            img.replaceWith(makeFacePlaceholder());
          };
          li.appendChild(img);
        } else {
          li.appendChild(makeFacePlaceholder());
        }

        const label = document.createElement("span");
        label.className = "user-name-label";
        label.textContent = name;
        li.appendChild(label);

        const selectBtn = document.createElement("button");
        selectBtn.className = "btn btn-sm btn-secondary";
        selectBtn.textContent = "✅ Select";
        selectBtn.onclick = () => selectUser(name);
        li.appendChild(selectBtn);

        const removeBtn = document.createElement("button");
        removeBtn.className = "btn btn-sm btn-danger";
        removeBtn.textContent = "❌ Remove";
        removeBtn.onclick = () => removeUser(name);
        li.appendChild(removeBtn);

        list.appendChild(li);
      });
      logEvent(`Loaded ${users.length} authorized users`, "info");
    })
    .catch((err) => {
      logEvent(`Error loading users: ${err.message}`, "error");
    });
}

function loadSelectedUser() {
  fetch("/selected-user")
    .then((res) => res.json())
    .then((data) => {
      const element = document.getElementById("selected-person");
      if (data && data.selected) {
        element.textContent = data.selected;
        logEvent(`Selected user: ${data.selected}`, "info");
      } else {
        element.textContent = "None";
      }
    })
    .catch((err) => {
      logEvent(`Error loading selected user: ${err.message}`, "error");
    });
}

function selectUser(name) {
  fetch("/select-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        document.getElementById("selected-person").textContent = name;
        logEvent(`Selected ${name} for proximity control`, "success");
        alert(`Selected ${name} for stopwatch proximity control`);
      } else {
        logEvent(`Select failed: ${data.message}`, "error");
        alert("Select failed: " + (data.message || "unknown"));
      }
    })
    .catch((err) => {
      logEvent(`Select user error: ${err.message}`, "error");
    });
}

function enrollFromPhoto() {
  const name = document.getElementById("new-user-name").value;
  const fileInput = document.getElementById("photo-upload");
  if (!name.trim()) {
    alert("Please enter a name");
    return;
  }
  if (!fileInput.files || !fileInput.files[0]) {
    alert("Please choose a photo file");
    return;
  }
  const fd = new FormData();
  fd.append("name", name.trim());
  fd.append("photo", fileInput.files[0]);
  logEvent(`Uploading photo to enroll "${name.trim()}"...`, "info");
  fetch("/enroll-photo", {
    method: "POST",
    body: fd,
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        logEvent(data.message || "Enrolled from photo", "success");
        fileInput.value = "";
        updatePhotoInputPlaceholder();
        loadAuthorizedUsers();
      } else {
        logEvent(`Photo enrollment failed: ${data.message}`, "error");
        alert("Photo enrollment failed: " + (data.message || "unknown"));
      }
    })
    .catch((err) => {
      logEvent(`Photo enrollment error: ${err.message}`, "error");
      alert("Photo enrollment error: " + err.message);
    });
}

function enrollUser(name) {
  if (!name.trim()) {
    alert("Please enter a name");
    return;
  }
  
  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("capture-canvas");
  
  if (!webcamActive || !video || !canvas) {
    alert("Webcam not active. Please ensure your browser has camera permissions and try again.");
    return;
  }

  logEvent(`Capturing high-quality frame for "${name.trim()}" enrollment...`, "info");
  
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  canvas.toBlob((blob) => {
    if (!blob) {
      alert("Failed to capture image from webcam.");
      return;
    }
    
    const fd = new FormData();
    fd.append("name", name.trim());
    fd.append("photo", blob, "enroll.jpg");

    fetch("/enroll-photo", {
      method: "POST",
      body: fd,
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          logEvent(data.message || `Enrollment successful for ${name.trim()}`, "success");
          alert("Enrollment successful via Browser Camera!");
          loadAuthorizedUsers();
        } else {
          logEvent(`Enrollment failed: ${data.message}`, "error");
          alert("Enrollment failed: " + data.message);
        }
      })
      .catch((err) => {
        logEvent(`Enrollment API error: ${err.message}`, "error");
        alert("Enrollment error: Check connection to server.");
      });
  }, "image/jpeg", 0.95);
}

async function initWebcam() {
  const video = document.getElementById("webcam-video");
  if (!video) return;

  try {
    webcamStream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480, facingMode: "user" }
    });
    video.srcObject = webcamStream;
    webcamActive = true;
    logEvent("Webcam initialized in browser", "success");
    
    // Start background processing loop
    startCaptureLoop();
  } catch (err) {
    console.error("Camera Access Error:", err);
    logEvent(`Camera access denied: ${err.message}. Please enable camera in browser.`, "error");
    updateStatus("Camera Required", "⚠️");
  }
}

function startCaptureLoop() {
  if (captureInterval) clearInterval(captureInterval);
  captureInterval = setInterval(captureAndSendFrame, PROCESS_INTERVAL);
}

function captureAndSendFrame() {
  if (!webcamActive) return;
  
  const video = document.getElementById("webcam-video");
  const canvas = document.getElementById("capture-canvas");
  const selectedDisplay = document.getElementById("selected-person");
  const selectedPerson = selectedDisplay ? selectedDisplay.textContent : null;

  if (!video || !canvas || !selectedPerson || selectedPerson === "None") {
    return;
  }

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  canvas.toBlob((blob) => {
    if (!blob) return;

    const fd = new FormData();
    fd.append("frame", blob, "frame.jpg");
    fd.append("selected_person", selectedPerson);

    fetch("/process-frame", {
      method: "POST",
      body: fd
    })
    .then(res => res.json())
    .then(data => {
      // Backend updates status.json, pollPresence will see changes
      if (data.error) {
        console.warn("Frame processing warning:", data.error);
      }
    })
    .catch(err => {
      console.error("Error sending frame to backend:", err);
    });
  }, "image/jpeg", 0.7);
}

function removeUser(name) {
  if (!confirm(`Remove ${name} from authorized users?`)) return;
  logEvent(`Removing user: ${name}`, "warning");
  fetch("/remove-user", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        logEvent(`User removed: ${name}`, "success");
        loadAuthorizedUsers();
      } else {
        logEvent(`Remove failed: ${data.message}`, "error");
        alert("Remove failed: " + data.message);
      }
    })
    .catch((err) => {
      logEvent(`Remove error: ${err.message}`, "error");
    });
}

function updatePhotoInputPlaceholder() {
  const fileInput = document.getElementById("photo-upload");
  const placeholder = document.querySelector(".file-input-placeholder");
  if (fileInput && fileInput.files && fileInput.files[0]) {
    placeholder.textContent = `📄 ${fileInput.files[0].name}`;
  } else {
    placeholder.textContent = "📁 Choose Photo";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  logEvent("Application started", "info");

  document.getElementById("restart-btn").addEventListener("click", () => {
    elapsedTime = 0;
    updateDisplay();
    stopStopwatch();
    updateStatus("Idle", "🔵");
    presenceConfirmed = false;
    presenceBufferStart = null;
    logEvent("Stopwatch restarted", "info");

    fetch(`/status/${sensorId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.Presence === "active") {
          presenceBufferStart = Date.now();
          handlePresence("active", data.who || null);
        }
      });
  });

  document.getElementById("refresh-log").addEventListener("click", loadSessionLog);
  document.getElementById("reconnect-btn").addEventListener("click", reconnectPresence);
  document.getElementById("delete-log").addEventListener("click", deleteSessionLog);

  document.getElementById("enroll-btn").addEventListener("click", () => {
    const name = document.getElementById("new-user-name").value;
    enrollUser(name);
    document.getElementById("new-user-name").value = "";
  });

  const photoInput = document.getElementById("photo-upload");
  if (photoInput) {
    photoInput.addEventListener("change", updatePhotoInputPlaceholder);
  }

  document.getElementById("enroll-photo-btn").addEventListener("click", () => {
    enrollFromPhoto();
  });

  loadSessionLog();
  loadAuthorizedUsers();
  loadSelectedUser();
  initWebcam();
});

setInterval(pollPresence, 1000);

setInterval(() => {
  const now = Date.now();
  if (now - lastUpdateTime > 10000 && !disconnected) {
    disconnected = true;
    currentPresence = "inactive";
    logEvent("Watchdog: no status update, treating as disconnected", "warning");
    handlePresence("inactive");
    updateStatus("Disconnected", "⚠️");
  }
}, 3000);
