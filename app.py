from flask import Flask, render_template, request, jsonify, send_from_directory
import json
import os
from datetime import datetime

app = Flask(__name__)
TASKS_FILE = "tasks.json"

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}

def load_tasks():
    if not os.path.exists(TASKS_FILE):
        return []
    with open(TASKS_FILE, "r") as f:
        return json.load(f)

def save_tasks(tasks):
    with open(TASKS_FILE, "w") as f:
        json.dump(tasks, f, indent=2)

def sort_tasks(tasks):
    def sort_key(t):
        completed = 1 if t.get("completed") else 0
        priority  = PRIORITY_ORDER.get(t.get("priority", "medium"), 1)
        due       = t.get("due_date", "") or "9999-12-31"
        return (completed, priority, due)
    return sorted(tasks, key=sort_key)

@app.route("/favicon.ico")
def favicon():
    return send_from_directory(
        os.path.join(app.root_path, 'static'),
        'favicon.ico', mimetype='image/vnd.microsoft.icon'
    )

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    tasks = sort_tasks(load_tasks())
    return jsonify(tasks)

@app.route("/api/tasks", methods=["POST"])
def add_task():
    data  = request.get_json()
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Task title cannot be empty"}), 400

    tasks    = load_tasks()
    new_task = {
        "id":         int(datetime.now().timestamp() * 1000),
        "title":      title,
        "priority":   data.get("priority", "medium"),
        "due_date":   data.get("due_date", ""),
        "completed":  False,
        "created_at": datetime.now().strftime("%b %d, %Y %I:%M %p")
    }
    tasks.append(new_task)
    save_tasks(tasks)
    return jsonify(new_task), 201

@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data  = request.get_json()
    tasks = load_tasks()
    for task in tasks:
        if task["id"] == task_id:
            if "title"    in data and data["title"].strip():
                task["title"]    = data["title"].strip()
            if "priority" in data:
                task["priority"] = data["priority"]
            if "due_date" in data:
                task["due_date"] = data["due_date"]
            save_tasks(tasks)
            return jsonify(task)
    return jsonify({"error": "Task not found"}), 404

@app.route("/api/tasks/<int:task_id>/toggle", methods=["PATCH"])
def toggle_task(task_id):
    tasks = load_tasks()
    for task in tasks:
        if task["id"] == task_id:
            task["completed"] = not task["completed"]
            save_tasks(tasks)
            return jsonify(task)
    return jsonify({"error": "Task not found"}), 404

@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    tasks = load_tasks()
    tasks = [t for t in tasks if t["id"] != task_id]
    save_tasks(tasks)
    return jsonify({"message": "Task deleted"})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
