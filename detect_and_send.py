import cv2
import time
import requests

server_url = "http://127.0.0.1:5000/status"
sensor_id = "123"

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
cap = cv2.VideoCapture(0)

def send_presence(presence):
    try:
        requests.post(server_url, json={sensor_id: presence})
        print(f"Sent: {presence}")
    except Exception as e:
        print("Error sending presence:", e)

last_presence = "inactive"
inactive_count = 0
buffer_limit = 3

try:
    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            send_presence("inactive")
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.1, 5)

        if len(faces) >= 1:
            presence = "active"
            inactive_count = 0
        else:
            inactive_count += 1
            presence = "inactive" if inactive_count >= buffer_limit else last_presence

        if presence != last_presence:
            send_presence(presence)
            last_presence = presence

        cv2.imshow("Proximity Detection", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            send_presence("inactive")
            break

        time.sleep(2)
finally:
    cap.release()
    cv2.destroyAllWindows()
