🚀 KREDZ
AI-Powered Credit Intelligence Platform

Smarter credit decisions. Faster. Automated.

🌐 Live Demo

🚀 **Frontend (App):
https://kredz-2nzq.vercel.app

⚡ **Backend API:
https://kredz.onrender.com

📄 **API Docs:
https://kredz.onrender.com/docs

🌟 Overview

KREDZ is a full-stack application that uses AI-driven logic to analyze, verify, and evaluate creditworthiness.

It replaces slow, manual processes with:

⚡ Real-time verification
🧠 Intelligent scoring
📊 Structured data analysis
✨ Features
🔍 AI-based credit verification
📊 Dynamic credit scoring system
⚡ FastAPI backend for high performance
🎨 Modern UI with React + Tailwind
🔐 Secure and scalable architecture
🏗️ Tech Stack

Frontend

⚛️ React
🎨 Tailwind CSS

Backend

🐍 Python
⚡ FastAPI

DevOps

🐳 Docker
☁️ Render + Vercel
🚀 Quick Start (Run Locally)
1️⃣ Clone the Repository
git clone https://github.com/arpanbasak90-cyber/KREDZ.git
cd KREDZ
2️⃣ Run Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

📍 Backend runs locally at:
http://127.0.0.1:8000

👉 API Docs (after starting backend):
http://127.0.0.1:8000/docs

3️⃣ Run Frontend
cd frontend-final
npm install
npm run dev

📍 Frontend runs locally at:
http://localhost:3000

🔐 Environment Variables

Create a .env file inside the backend folder:

# Example configuration
DATABASE_URL=YOUR_DATABASE_URL
SECRET_KEY=YOUR_SECRET_KEY

⚠️ Do NOT commit your .env file to GitHub.
Add this to .gitignore:

.env
🐳 (Optional) Run with Docker
docker-compose up --build
🌍 Deployment
Frontend: Vercel
Backend: Render

⚠️ Make sure frontend uses:

NEXT_PUBLIC_API_URL=https://kredz.onrender.com
🧠 How It Works
User submits data
Backend processes request
AI verifier evaluates credibility
System returns a credit score
📁 Project Structure
KREDZ/
├── backend/
│   ├── main.py
│   ├── database.py
│   ├── schemas.py
│   ├── ai_verifier.py
│   └── requirements.txt
│
├── frontend-final/
│   ├── src/
│   └── package.json
│
├── docker-compose.yml
├── Dockerfile
├── render.yaml
└── README.md
🔮 Future Improvements
🤖 Machine learning-based scoring
📊 Analytics dashboard
🔐 Authentication system
📱 Mobile support
🤝 Contributing

Contributions are welcome!

Fork → Create Branch → Commit → Pull Request 🚀
👨‍💻 Authors
Priyasmit Ganguly
Modhurma Ganguly
Haimontika Roy
Arpan Basak

## 🔗 GitHub Profiles

- https://github.com/Priyasmit-work  
- https://github.com/ModhurimaGanguly  
- https://github.com/haimontikaroy974-crypto  
- https://github.com/arpanbasak90-cyber


⭐ Support

If you like this project:

⭐ Star the repo
🍴 Fork it
🚀 Share it
⚠️ Disclaimer

This project is for educational purposes only.
Do not use real financial data without proper compliance.

🔥 Final Note

“Credit systems shouldn’t be slow or outdated.
KREDZ is built to change that
