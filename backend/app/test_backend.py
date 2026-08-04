import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure current directory is in sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, parent_dir)

from app.main import app
from app.database import SessionLocal, User
from app.auth import verify_password

class TestCCTVForensicBackend(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.db = SessionLocal()

    def tearDown(self):
        self.db.close()

    def test_root_health(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["system"], "AI-Driven Intelligent CCTV Search (SIH)")

    def test_seeded_users(self):
        admin = self.db.query(User).filter(User.username == "admin").first()
        self.assertIsNotNone(admin)
        self.assertEqual(admin.role, "admin")
        self.assertTrue(verify_password("admin123", admin.password_hash))

        officer = self.db.query(User).filter(User.username == "officer").first()
        self.assertIsNotNone(officer)
        self.assertEqual(officer.role, "officer")
        self.assertTrue(verify_password("officer123", officer.password_hash))

    def test_login_flow(self):
        # 1. Test incorrect login
        response = self.client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "wrong_password"}
        )
        self.assertEqual(response.status_code, 401)

        # 2. Test correct login
        response = self.client.post(
            "/api/auth/login",
            data={"username": "admin", "password": "admin123"}
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("access_token", data)
        self.assertEqual(data["role"], "admin")
        self.assertEqual(data["username"], "admin")

        # 3. Test retrieving user profile with JWT token
        token = data["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        profile_res = self.client.get("/api/auth/me", headers=headers)
        self.assertEqual(profile_res.status_code, 200)
        profile_data = profile_res.json()
        self.assertEqual(profile_data["username"], "admin")
        self.assertEqual(profile_data["role"], "admin")

if __name__ == "__main__":
    unittest.main()
