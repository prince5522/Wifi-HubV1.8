"""Wi-Fi Hub HTTP backend (Firebase Functions for Python).

This foundation verifies Firebase ID tokens and reports unavailable integrations honestly.
It does not attempt universal router control: routers require supported, model-specific APIs.
""" 
from firebase_functions import https_fn, options
from firebase_admin import initialize_app, auth
from firebase_admin.exceptions import FirebaseError
from flask import jsonify, request
import ipaddress
import logging
import os

initialize_app()
logging.basicConfig(level=logging.INFO)

ALLOWED_METHODS = ["GET", "POST", "OPTIONS"]
ALLOWED_HEADERS = ["Authorization", "Content-Type"]


def _cors(response):
    # Public health response only contains non-sensitive service status.
    # Authenticated API routes still verify the Firebase token.
    origin = request.headers.get("Origin", "")
    # Set WIFI_HUB_ALLOWED_ORIGINS to comma-separated exact origins at deployment.
    allowed = {item.strip() for item in os.environ.get("WIFI_HUB_ALLOWED_ORIGINS", "https://prince5522.github.io").split(",") if item.strip()}
    if origin in allowed:
        response.headers["Access-Control-Allow-Origin"] = origin
    response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Methods"] = ", ".join(ALLOWED_METHODS)
    response.headers["Access-Control-Allow-Headers"] = ", ".join(ALLOWED_HEADERS)
    response.headers["Access-Control-Max-Age"] = "3600"
    return response


def _json(payload, status=200):
    return _cors(jsonify(payload)), status


def _require_user():
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None, (jsonify({"ok": False, "message": "Sign in to use this service."}), 401)
    token = header[7:].strip()
    if not token:
        return None, (jsonify({"ok": False, "message": "Missing sign-in token."}), 401)
    try:
        decoded = auth.verify_id_token(token, check_revoked=True)
        return decoded, None
    except (ValueError, FirebaseError) as exc:
        logging.info("Rejected Firebase token: %s", type(exc).__name__)
        return None, (jsonify({"ok": False, "message": "Your session is invalid or expired. Sign in again."}), 401)


@https_fn.on_request(cors=options.CorsOptions(
    cors_origins=["https://prince5522.github.io"], cors_methods=["get", "post", "options"],
    cors_headers=["authorization", "content-type"], max_age=3600
))
def api(req: https_fn.Request):
    """Routes: /health, /devices, /router/action (also accepts /api-prefixed paths).

    Set WIFI_HUB_API_BASE in a frontend config script to this function's base URL.
    """
    path = (req.path or "/").rstrip("/") or "/"
    if req.method == "OPTIONS":
        return ("", 204)

    if path in ("/health", "/api/health") and req.method == "GET":
        return _json({
            "ok": True,
            "service": "Wi-Fi Hub API",
            "routerIntegration": "not_configured",
            "message": "Backend is reachable. No router integration has been connected."
        })

    if path in ("/devices", "/api/devices", "/router/action", "/api/router/action"):
        user, error = _require_user()
        if error:
            response, status = error
            return _cors(response), status
        if path in ("/devices", "/api/devices") and req.method == "GET":
            # No fake devices: the real router adapter must be implemented for a supported model.
            return _json({
                "ok": True,
                "devices": [],
                "source": "not_configured",
                "message": "No compatible router integration is configured, so device data is unavailable."
            })
        if path in ("/router/action", "/api/router/action") and req.method == "POST":
            body = req.get_json(silent=True) or {}
            action = str(body.get("action", "")).strip().lower()
            if action not in {"restart", "wifi_on", "wifi_off"}:
                return _json({"ok": False, "message": "Unsupported action. Use restart, wifi_on, or wifi_off."}, 400)
            # Deliberately do not pretend to run commands without a supported adapter.
            return _json({
                "ok": False,
                "code": "router_integration_not_configured",
                "message": "No compatible router API is configured. No command was sent.",
                "requestedAction": action
            }, 501)

    return _json({"ok": False, "message": "Endpoint not found."}, 404)
