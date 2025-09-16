# scripts/bootstrap_login.py
from backend.auth.broker import broker, FABRIC_SCOPES, SQL_SCOPE
print("Bootstrapping tokens...")
broker.token(FABRIC_SCOPES)
broker.token([SQL_SCOPE])
print("Done.")