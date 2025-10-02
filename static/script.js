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

function pad(num) {
  return num.toString().padStart(2, "0");
}

function updateDisplay() {
  const hrs = Math.floor(elapsedTime / 3600);
  const mins = Math.floor((elapsedTime % 3600) / 60);
  const secs = elapsedTime % 60;
  document.getElementById("stopwatch").textContent = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
}

function updateStatus(text, icon = "🔵") {
  document.getElementById("status").textContent = `${icon} ${text}`;
}

function startStopwatch() {
  if (!isRunning) {
    timerInterval = setInterval(() => {
      elapsedTime++;
      updateDisplay();
    }, 1000);
    isRunning = true;
    updateStatus("Running", "🟢");
  }
}

function stopStopwatch() {
  if (isRunning) {
    clearInterval(timerInterval);
    timerInterval = null;
    isRunning = false;
    updateStatus("Paused", "⏸️");
    loadSessionLog();
  }
}

function handlePresence(status) {
  if (disconnected) return; // Ignore presence updates if disconnected

  if (status === "active") {
    if (!presenceConfirmed) {
      if (!presenceBufferStart) presenceBufferStart = Date.now();
      const bufferedTime = (Date.now() - presenceBufferStart) / 1000;
      if (bufferedTime >= bufferThreshold) {
        presenceConfirmed = true;
        startStopwatch();
      }
    }
  } else {
    presenceBufferStart = null;
    presenceConfirmed = false;
    stopStopwatch();
  }
}

function pollPresence() {
  fetch(`/status/${sensorId}`)
    .then(res => res.json())
    .then(data => {
      lastUpdateTime = Date.now();
      disconnected = false;

      const newPresence = data.Presence;
      if (newPresence !== currentPresence) {
        currentPresence = newPresence;
        handlePresence(newPresence);
      } else if (newPresence === "active") {
        handlePresence("active");
      }
    })
    .catch(err => {
      console.error("Polling error:", err);
      disconnected = true;
      currentPresence = "inactive";
      handlePresence("inactive");
      updateStatus("Disconnected", "⚠️");
    });
}

function loadSessionLog() {
  fetch('/session-log')
    .then(res => res.json())
    .then(data => {
      const logList = document.getElementById("log-entries");
      logList.innerHTML = "";

      if (!Array.isArray(data) || data.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No sessions logged yet.";
        logList.appendChild(li);
        return;
      }

      data.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));

      data.forEach(entry => {
        const li = document.createElement("li");
        const start = new Date(entry.start_time).toLocaleString();
        const end = new Date(entry.end_time).toLocaleString();
        li.textContent = `Sensor ${entry.sensor_id} | Start: ${start} | End: ${end} | Duration: ${entry.duration}s`;
        logList.appendChild(li);
      });
    })
    .catch(err => {
      console.error("Log fetch error:", err);
      const logList = document.getElementById("log-entries");
      logList.innerHTML = "<li>Error loading session log.</li>";
    });
}

function reconnectPresence() {
  updateStatus("Reconnecting...", "🔄");
  disconnected = false;
  fetch(`/status/${sensorId}`)
    .then(res => res.json())
    .then(data => {
      lastUpdateTime = Date.now();
      const newPresence = data.Presence;
      currentPresence = newPresence;
      handlePresence(newPresence);
      updateStatus("Reconnected", "🟢");
    })
    .catch(err => {
      console.error("Reconnect failed:", err);
      updateStatus("Still disconnected", "⚠️");
    });
}

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("restart-btn").addEventListener("click", () => {
    elapsedTime = 0;
    updateDisplay();
    stopStopwatch();
    updateStatus("Idle", "🔵");
    presenceConfirmed = false;
    presenceBufferStart = null;

    fetch(`/status/${sensorId}`)
      .then(res => res.json())
      .then(data => {
        if (data.Presence === "active") {
          presenceBufferStart = Date.now();
        }
      });
  });

  document.getElementById("refresh-log").addEventListener("click", loadSessionLog);
  document.getElementById("reconnect-btn").addEventListener("click", reconnectPresence);

  loadSessionLog(); // Initial load
});

setInterval(pollPresence, 1000);

setInterval(() => {
  const now = Date.now();
  if (now - lastUpdateTime > 20000 && !disconnected) {
    disconnected = true;
    currentPresence = "inactive";
    handlePresence("inactive");
    updateStatus("Disconnected", "⚠️");
  }
}, 3000);
