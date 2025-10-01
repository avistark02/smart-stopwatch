from flask import Flask, render_template, request, jsonify
import threading
import time

app = Flask(__name__, static_folder='static', template_folder='templates')
status = {"state": "Idle"}
buffer_time = 2

def check_proximity():
    return time.time() % 10 < 5

def monitor_proximity():
    last_detected = 0
    while True:
        detected = check_proximity()
        now = time.time()

        if detected:
            if now - last_detected > buffer_time:
                status["state"] = "Active"
            last_detected = now
        else:
            if now - last_detected > buffer_time:
                status["state"] = "Idle"

        time.sleep(0.5)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/status", methods=["GET"])
def get_status():
    return jsonify(status)

@app.route("/status/<sensor_id>", methods=["GET"])
def get_status_by_id(sensor_id):
    return jsonify({"Presence": status["state"].lower()})

if __name__ == "__main__":
    threading.Thread(target=monitor_proximity, daemon=True).start()
    app.run(debug=True)
