# 📝 Taskflow – Smart To-Do Manager

A feature-rich, web-based task manager built with **Python (Flask)** and a stunning **space-themed UI**.

![Taskflow](https://img.shields.io/badge/Python-Flask-blue?style=flat-square&logo=flask)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

## ✨ Features

- ✅ Add, edit, and delete tasks
- 🎯 Priority levels — High, Medium, Low
- 📅 Due date tracking with overdue detection
- 🔄 Toggle tasks complete / active
- 📊 Progress bar with motivational messages
- 🌙 Focus Mode — distraction-free view
- 🔍 Filter by All / Active / Completed
- 🚀 Space-themed animated UI

## 🛠️ Tech Stack

| Layer    | Technology               |
|----------|--------------------------|
| Backend  | Python 3, Flask          |
| Frontend | HTML5, Vanilla CSS, JS   |
| Storage  | JSON file (`tasks.json`) |

## 🚀 Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/whoisanshkumar/To-Do-List.git
cd To-Do-List

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the app
python app.py
```

Then open **https://to-do-list-omega-three-iy5yivvd5x.vercel.app/** in your browser.

## 📂 Project Structure

```
todo_web/
├── app.py              # Flask backend & API routes
├── requirements.txt    # Python dependencies
├── templates/
│   └── index.html      # Main HTML template
└── static/
    ├── style.css       # Space-themed stylesheet
    ├── app.js          # Frontend JavaScript
    └── favicon.ico     # App icon
```

## 📡 API Endpoints

| Method | Endpoint                    | Description        |
|--------|-----------------------------|--------------------|
| GET    | `/api/tasks`                | Get all tasks      |
| POST   | `/api/tasks`                | Create a task      |
| PUT    | `/api/tasks/<id>`           | Update a task      |
| PATCH  | `/api/tasks/<id>/toggle`    | Toggle completion  |
| DELETE | `/api/tasks/<id>`           | Delete a task      |

## 📄 License

MIT © [whoisanshkumar](https://github.com/whoisanshkumar)
