# user_auth_mongo.py

import os
from pymongo import MongoClient, errors
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
if not MONGO_URI:
    raise RuntimeError("MONGO_URI not set")

client = MongoClient(MONGO_URI)
db = client.get_default_database()
users = db.users

# Drop any leftover email index
existing = users.index_information()
if "email_1" in existing:
    users.drop_index("email_1")

# Ensure unique index on username only
users.create_index("username", unique=True)

def register_user(username: str, vehicle_plate: str, vehicle_type: str) -> dict:
    if users.find_one({"username": username}):
        raise ValueError(f"Username '{username}' is already taken")
    doc = {
        "username": username,
        "vehicle_plate": vehicle_plate,
        "vehicle_type": vehicle_type
    }
    users.insert_one(doc)
    return doc

def login_user(username: str, vehicle_plate: str) -> dict:
    """
    Authenticates by matching both username and vehicle_plate.
    """
    doc = users.find_one({
        "username": username,
        "vehicle_plate": vehicle_plate
    }, {"_id": 0})
    if not doc:
        raise ValueError("Invalid credentials")
    return doc