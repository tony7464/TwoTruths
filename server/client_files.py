"""Serve the built React app when client/dist exists.

In dev that folder is missing, so these checks do nothing and the API is unchanged.
"""

from pathlib import Path

from flask import request, send_from_directory


ASSET_CACHE = "public, max-age=31536000, immutable"
INDEX_CACHE = "no-cache"


def _file_in_dist(dist, filename):
    if not filename:
        return False
    root = dist.resolve()
    target = (dist / filename).resolve()
    if not target.is_file():
        return False
    return root in target.parents


def _has_extension(relative):
    name = Path(relative).name
    return "." in name[1:]


def _cache_for(relative, index_fallback):
    if index_fallback or relative == "index.html":
        return INDEX_CACHE
    if relative.startswith("assets/"):
        return ASSET_CACHE
    return None


def register_client_files(flask_app):
    @flask_app.before_request
    def serve_built_client():
        if request.method != "GET" or request.path.startswith("/api"):
            return None
        dist = Path(flask_app.config["CLIENT_DIST"])
        index = dist / "index.html"
        if not index.is_file():
            return None
        relative = request.path.lstrip("/")
        if _file_in_dist(dist, relative):
            response = send_from_directory(dist, relative)
            cache = _cache_for(relative, False)
            if cache:
                response.headers["Cache-Control"] = cache
            return response
        # A missing hashed file is not a client route. Don't hand back index.html.
        if relative.startswith("assets/") and _has_extension(relative):
            return {"error": "Not found."}, 404
        response = send_from_directory(dist, "index.html")
        response.headers["Cache-Control"] = INDEX_CACHE
        return response
