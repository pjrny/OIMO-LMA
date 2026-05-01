"""Issue a dev OIMO bearer token (mimics Odoo's verification claims)."""
import sys, time
from jose import jwt
from app.core.config import settings


def main():
    user_id = sys.argv[1] if len(sys.argv) > 1 else "dev-user"
    level = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    payload = {
        "user_id": user_id,
        "verification_level": level,
        "scopes": ["characters:write", "images:generate"],
        "iat": int(time.time()),
        "exp": int(time.time()) + 3600 * 8,
    }
    print(jwt.encode(payload, settings.oimo_jwt_secret, algorithm="HS256"))


if __name__ == "__main__":
    main()
