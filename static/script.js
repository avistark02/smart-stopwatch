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

function updateStatus(text, color = "🔵") {
  document.getElementById("status").textContent = `${color} ${text}`;
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
    console.log(`Session: ${sessionStart} → ${sessionEnd}`);
    updateStatus("Paused", "⏸️");
  }
}

function resumeStopwatch() {
  if (!isRunning) {
    const now = new Date();
    if (lastInactiveTime) {
      const lap = Math.floor((now - lastInactiveTime) / 1000);
      console.log("Absence duration:", lap, "seconds");
    }
    startStopwatch();
  }
}

function handlePresence(status) {
  if (status === "active") {
    if (!presenceConfirmed) {
      if (!presenceBufferStart) presenceBufferStart = Date.now();
      const bufferedTime = (Date.now() - presenceBufferStart) / 1000;
      if (bufferedTime >= bufferThreshold) {
        presenceConfirmed = true;
        resumeStopwatch();
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
      const newPresence = data.Presence;
      lastUpdateTime = Date.now();
      if (newPresence !== currentPresence) {
        currentPresence = newPresence;
        handlePresence(newPresence);
      } else if (newPresence === "active") {
        handlePresence("active"); // continue buffering
      }
    })
    .catch(err => console.error("Polling error:", err));
}

setInterval(pollPresence, 1000);

setInterval(() => {
  if (Date.now() - lastUpdateTime > 10000 && currentPresence !== "inactive") {
    console.log("Watchdog triggered: no update, setting inactive");
    currentPresence = "inactive";
    handlePresence("inactive");
  }
}, 3000);
