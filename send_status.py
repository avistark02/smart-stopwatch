import requests

data = {
    "id": "123",
    "Presence": "active"  # or "inactive"
}

response = requests.post("http://127.0.0.1:5000/status", json=data)
print("POST response:", response.status_code)

get_response = requests.get("http://127.0.0.1:5000/status/123")
print("GET response:", get_response.json())
