import os
from pathlib import Path

from dotenv import load_dotenv

_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(_env_path)

# ── LDAP / Active Directory ──
LDAP_SERVER = os.getenv("LDAP_SERVER", "ldap://minerva.local:389")
LDAP_BASE_DN = os.getenv("LDAP_BASE_DN", "OU=MinervaFoods.com,DC=minerva,DC=local")
LDAP_SVC_USER = os.getenv("LDAP_SVC_USER", "svc_gsp_ad_control")
LDAP_SVC_PASSWORD = os.getenv("LDAP_SVC_PASSWORD", "")

# ── App JWT ──
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 12

ALLOWED_EMAIL_DOMAIN = os.getenv("ALLOWED_EMAIL_DOMAIN", "minervafoods.com")
