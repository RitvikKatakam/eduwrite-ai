import os
import requests
from datetime import datetime, timedelta, timezone
from functools import wraps

from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
from bson.objectid import ObjectId
import certifi

from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from werkzeug.security import generate_password_hash, check_password_hash

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

# =============================
# CONFIG
# =============================
load_dotenv()
DAILY_CREDITS = 50000

SECRET_KEY = os.getenv("SECRET_KEY", "eduwrite-secret-key-123")
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GOOGLE_CLIENT_ID = os.getenv(
    "GOOGLE_CLIENT_ID",
    "920292932199-xxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com"
)
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://eduwrite:eduwritedb@cluster0.4lvzym0.mongodb.net/eduwrite?retryWrites=true&w=majority"
)

# =============================
# FLASK APP
# =============================
app = Flask(__name__)
app.secret_key = SECRET_KEY

# ✅ PRODUCTION CORS (Vercel ↔ Render)
CORS(
    app,
    origins=[
        "https://eduwrite-ai-2yni.vercel.app",
        "https://eduwrite-ai-2yni-6u0k2trk1-ritvikkatakams-projects.vercel.app"
    ],
    supports_credentials=True
)

# =============================
# MONGODB CONNECTION
# =============================
try:
    client = MongoClient(
        MONGO_URI,
        tls=True,
        tlsCAFile=certifi.where(),
        serverSelectionTimeoutMS=5000
    )
    db = client["eduwrite"]
    client.admin.command("ping")
    print("SUCCESS: MongoDB connected")
except Exception as e:
    print(f"ERROR: MongoDB connection failed: {e}")

# =============================
# PROMPT LOADER
# =============================
def get_system_prompt(content_type, topic_input=""):
    prompts_dir = os.path.join(os.path.dirname(__file__), "..", "prompts")
    if not os.path.exists(prompts_dir):
        prompts_dir = "prompts"

    def load_p(filename):
        try:
            with open(os.path.join(prompts_dir, filename), "r", encoding="utf-8") as f:
                return f.read().strip()
        except:
            return ""

    rules = load_p("educational and technical_promts.txt")
    credits_p = load_p("Credit-Awareness Prompt.txt")
    coding_p = load_p("Coding-Specific Control Prompt.txt") if content_type.lower() == "coding" else ""

    current_date = datetime.now().strftime("%B %d, %Y")

    return f"""
TODAY'S DATE: {current_date}

{rules}

USER TOPIC: "{topic_input}"
DESIRED CONTENT TYPE: {content_type}

{credits_p}
{coding_p}

REMINDER: Generate {content_type} for "{topic_input}".
Use standard Markdown.
"""

# =============================
# API ROUTES
# =============================
@app.route("/")
def index():
    return jsonify({"status": "online", "message": "EduWrite API"}), 200

# ---------- GOOGLE AUTH ----------
@app.route("/api/auth/google", methods=["POST"])
def google_auth():
    data = request.json
    token = data.get("token")
    access_token = data.get("access_token")

    try:
        if token:
            idinfo = id_token.verify_oauth2_token(
                token,
                google_requests.Request(),
                GOOGLE_CLIENT_ID
            )
            email = idinfo["email"]
            name = idinfo.get("name", email.split("@")[0])
            picture = idinfo.get("picture")
            google_id = idinfo["sub"]

        elif access_token:
            resp = requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            info = resp.json()
            email = info["email"]
            name = info.get("name", email.split("@")[0])
            picture = info.get("picture")
            google_id = info["sub"]

        else:
            return jsonify({"error": "No token provided"}), 400

        now = datetime.now(timezone.utc)
        user = db.users.find_one({"email": email})

        if not user:
            user_id = db.users.insert_one({
                "username": name,
                "email": email,
                "google_id": google_id,
                "picture": picture,
                "credits": DAILY_CREDITS,
                "created_at": now,
                "credits_last_reset": now,
                "last_login": now
            }).inserted_id
            user = db.users.find_one({"_id": user_id})
        else:
            db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"last_login": now}}
            )

        db.logins.insert_one({
            "user_id": str(user["_id"]),
            "email": email,
            "timestamp": now
        })

        return jsonify({
            "status": "success",
            "user": {
                "id": str(user["_id"]),
                "email": email,
                "name": name,
                "picture": picture,
                "credits": user.get("credits", DAILY_CREDITS)
            }
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ---------- EMAIL AUTH ----------
@app.route("/api/auth/email", methods=["POST"])
def email_auth():
    data = request.json
    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    now = datetime.now(timezone.utc)
    user = db.users.find_one({"email": email})

    if not user:
        user_id = db.users.insert_one({
            "username": email.split("@")[0],
            "email": email,
            "password": generate_password_hash(password),
            "credits": DAILY_CREDITS,
            "created_at": now,
            "credits_last_reset": now,
            "last_login": now
        }).inserted_id
        user = db.users.find_one({"_id": user_id})
    else:
        if not check_password_hash(user.get("password", ""), password):
            return jsonify({"error": "Invalid password"}), 401
        db.users.update_one(
            {"_id": user["_id"]},
            {"$set": {"last_login": now}}
        )

    return jsonify({
        "status": "success",
        "user": {
            "id": str(user["_id"]),
            "email": email,
            "name": user.get("username"),
            "credits": user.get("credits", DAILY_CREDITS)
        }
    }), 200

# =============================
# RUN APP
# =============================
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)
