"""JSON bodies for HTTP errors. A 500 never includes the exception text."""

from config import app, db


def error(message, status):
    return {"error": message}, status


def register_error_handlers():
    @app.errorhandler(400)
    def bad_request(_error):
        return error("Bad request.", 400)

    @app.errorhandler(404)
    def not_found(_error):
        return error("Not found.", 404)

    @app.errorhandler(405)
    def method_not_allowed(_error):
        return error("Method not allowed.", 405)

    @app.errorhandler(413)
    def too_large(_error):
        return error("Request is too large.", 413)

    @app.errorhandler(500)
    def server_error(_error):
        # The client only sees a generic message. The traceback stays in the log.
        app.logger.exception("Request failed")
        db.session.rollback()
        return error("Something went wrong.", 500)
