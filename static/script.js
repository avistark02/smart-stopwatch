const sensorId = "123";
let currentPresence = "inactive";
let presenceConfirmed = false;
let presenceBufferStart = null;
const bufferThreshold = 2;
let timerInterval = null;
let elapsedTime = 0;
let isRunning = false;
let lastUpdateTime = Date.now();

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
  }
}

function handlePresence(status) {
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
      const newPresence = data.Presence;
      lastUpdateTime = Date.now();
      if (newPresence !== currentPresence) {
        currentPresence = newPresence;
        handlePresence(newPresence);
      } else if (newPresence === "active") {
        handlePresence("active");
      }
    })
    .catch(err => console.error("Polling error:", err));
}

setInterval(pollPresence, 1000);

setInterval(() => {
  if (Date.now() - lastUpdateTime > 20000 && currentPresence !== "inactive") {
    console.log("Watchdog triggered: no update, setting inactive");
    currentPresence = "inactive";
    handlePresence("inactive");
  }
}, 3000);
