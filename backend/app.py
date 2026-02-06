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
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "920292932199-jemm5p4gfqiq8i945inh6dvq1ntnqf85.apps.googleusercontent.com")
MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://eduwrite:eduwritedb@cluster0.4lvzym0.mongodb.net/eduwrite?retryWrites=true&w=majority")

if not GROQ_API_KEY:
    print("WARNING: GROQ_API_KEY not found")
if not GOOGLE_CLIENT_ID:
    print("WARNING: GOOGLE_CLIENT_ID not found")

# =============================
# FLASK APP
# =============================
app = Flask(__name__)
app.secret_key = SECRET_KEY
CORS(app, supports_credentials=True)

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
    print("SUCCESS: MongoDB connected successfully")
except Exception as e:
    print(f"ERROR: MongoDB connection error: {e}")

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
        except: return ""

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
    Use standard Markdown: #, ## for headers, **text** for bold.
    """



# =============================
# UTILS
# =============================
def check_credit_reset(user_id):
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user: return
    
    last_reset = user.get("credits_last_reset")
    if not last_reset:
        db.users.update_one({"_id": ObjectId(user_id)}, {"$set": {"credits_last_reset": datetime.now(timezone.utc)}})
        return

    if last_reset.tzinfo is None:
        last_reset = last_reset.replace(tzinfo=timezone.utc)

    if datetime.now(timezone.utc) - last_reset >= timedelta(minutes=10):
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {"credits": DAILY_CREDITS, "credits_last_reset": datetime.now(timezone.utc)}}
        )


# =============================
# API ROUTES
# =============================
@app.route('/')
def index():
    return jsonify({"status": "online", "message": "EduWrite API"}), 200

@app.route('/api/auth/google', methods=['POST'])
def google_auth():
    token = request.json.get('token')
    access_token = request.json.get('access_token')
    print(f"DEBUG: Processing Google Auth request. Token: {bool(token)}, AccessToken: {bool(access_token)}")
    try:
        if token:
            idinfo = id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
            email = idinfo['email']
            name = idinfo.get('name', email.split('@')[0])
            picture = idinfo.get('picture')
            google_id = idinfo['sub']
        elif access_token:
            resp = requests.get('https://www.googleapis.com/oauth2/v3/userinfo', headers={'Authorization': f'Bearer {access_token}'})
            info = resp.json()
            email = info['email']
            name = info.get('name', email.split('@')[0])
            picture = info.get('picture')
            google_id = info['sub']
        else:
            return jsonify({"error": "No token"}), 400

        user = db.users.find_one({"email": email})
        now = datetime.now(timezone.utc)
        if not user:
            user_id = db.users.insert_one({
                "username": name, "email": email, "google_id": google_id, "picture": picture,
                "credits": DAILY_CREDITS, "created_at": now, "credits_last_reset": now, "last_login": now
            }).inserted_id
            user = db.users.find_one({"_id": user_id})
        else:
            user_id = user["_id"]
            db.users.update_one({"_id": user_id}, {"$set": {"last_login": now}})
        
        # Record Login for stats
        db.logins.insert_one({"user_id": str(user_id), "email": email, "timestamp": now})

        return jsonify({
            "status": "success",
            "user": {"id": str(user_id), "email": email, "name": name, "picture": picture, "credits": user.get("credits", DAILY_CREDITS)}
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/api/auth/email', methods=['POST'])
def email_auth():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    print(f"DEBUG: Processing Email Auth request for: {email}")
    if not email or "@" not in email: return jsonify({"error": "Invalid email"}), 400
    if not password: return jsonify({"error": "Password is required"}), 400
    
    user = db.users.find_one({"email": email})
    now = datetime.now(timezone.utc)
    
    if not user:
        # Create new user
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
        # Check password
        if not check_password_hash(user.get("password", ""), password):
            # If user was created without password (legacy or google), but now trying email login
            if not user.get("password"):
                db.users.update_one({"_id": user["_id"]}, {"$set": {"password": generate_password_hash(password)}})
            else:
                return jsonify({"error": "Invalid password"}), 401
        
        user_id = user["_id"]
        db.users.update_one({"_id": user_id}, {"$set": {"last_login": now}})
    
    # Record Login for stats
    db.logins.insert_one({"user_id": str(user_id), "email": email, "timestamp": now})

    return jsonify({
        "status": "success",
        "user": {"id": str(user_id), "email": email, "name": user.get("username"), "credits": user.get("credits", DAILY_CREDITS)}
    }), 200

@app.route('/api/generate', methods=['POST'])
def generate():
    data = request.json
    topic = data.get('topic')
    content_type = data.get('content_type', 'Explanation')
    user_id_raw = data.get('user_id')

    if not topic or not user_id_raw:
        return jsonify({"error": "Missing data"}), 400

    try:
        # Resolve User
        u_id = ObjectId(user_id_raw) if len(user_id_raw) == 24 and all(c in '0123456789abcdef' for c in user_id_raw.lower()) else None
        user = db.users.find_one({"_id": u_id}) if u_id else db.users.find_one({"email": user_id_raw})
        
        if not user:
            # Fallback auto-create for dev speed
            if "@" in str(user_id_raw):
                db.users.insert_one({
                    "username": str(user_id_raw).split("@")[0], "email": str(user_id_raw),
                    "credits": DAILY_CREDITS, "created_at": datetime.utcnow(), "credits_last_reset": datetime.utcnow()
                })
                user = db.users.find_one({"email": user_id_raw})
            else:
                return jsonify({"error": "User not found. Please logout and login again."}), 404

        # check_credit_reset(user["_id"])
        # Credits are now unlimited for PRO version
        # if user.get("credits", 0) <= 0:
        #     return jsonify({"error": "No credits left. Please wait for reset."}), 403

        # GREETINGS
        greetings = ["hi", "hello", "hey", "how are you"]
        if topic.lower().strip().strip("?!.,") in greetings:
            return jsonify({"content": "Hello! I am EduWrite. How can I help you learn today?", "credits_left": user["credits"]})

        # AI CALL
        llm = ChatGroq(groq_api_key=GROQ_API_KEY, model="openai/gpt-oss-120b", temperature=0)
        sys_prompt = get_system_prompt(content_type, topic)



        
        response = llm.invoke([
            SystemMessage(content=sys_prompt),
            HumanMessage(content=topic)
        ])
        
        content = response.content

        # db.users.update_one({"_id": user["_id"]}, {"$inc": {"credits": -1}})
        db.history.insert_one({
            "user_id": str(user["_id"]), "topic": topic, "content_type": content_type,
            "response": content, "created_at": datetime.now(timezone.utc)
        })

        return jsonify({"content": content, "credits_left": "Unlimited"})

    except Exception as e:
        print(f"Gen Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    user_id_raw = request.args.get('user_id')
    if not user_id_raw: return jsonify({"error": "Missing user_id"}), 400
    
    try:
        # Resolve ID if email passed
        u_id = ObjectId(user_id_raw) if len(user_id_raw) == 24 and all(c in '0123456789abcdef' for c in user_id_raw.lower()) else None
        user = db.users.find_one({"_id": u_id}) if u_id else db.users.find_one({"email": user_id_raw})
        
        if not user: return jsonify({"status": "success", "history": []})
        
        history = list(db.history.find({"user_id": str(user["_id"])}).sort("created_at", -1).limit(30))
        for item in history:
            item["id"] = str(item["_id"])
            del item["_id"]
        
        return jsonify({"status": "success", "history": history}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/admin/stats', methods=['GET'])
def admin_stats():
    admin_email = request.args.get('admin_email', '').lower()
    print(f"DEBUG: Admin Stats request from: {admin_email}")
    if admin_email != 'admin@gmail.com':
        return jsonify({"error": "Unauthorized"}), 403
    
    # Get stats for the last 7 days
    end_date = datetime.now(timezone.utc)
    start_date = end_date - timedelta(days=7)
    
    pipeline = [
        {"$match": {"timestamp": {"$gte": start_date}}},
        {"$group": {
            "_id": {
                "day": {"$dateToString": {"format": "%Y-%m-%d", "date": "$timestamp"}},
                "user_id": "$user_id"
            }
        }},
        {"$group": {
            "_id": "$_id.day",
            "count": {"$sum": 1}
        }},
        {"$sort": {"_id": -1}}
    ]
    
    results = list(db.logins.aggregate(pipeline))
    stats = [{"day": r["_id"], "count": r["count"]} for r in results]
    
    return jsonify({"daily_logins": stats})

if __name__ == '__main__':
    print("EduWrite Backend starting on port 5002...")
    print("Model: openai/gpt-oss-120b")
    # Bind to 0.0.0.0 to ensure accessibility
    app.run(host='0.0.0.0', port=5002, debug=True, use_reloader=False)




