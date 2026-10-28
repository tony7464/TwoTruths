"""Failed-login and signup limits for this process.

One shared IP cannot lock every username, and one IP cannot try endless names.
A success clears only that username on that IP.
"""

import math
import threading
import time
from collections import OrderedDict

from flask import request

WINDOW_SECONDS = 60
MAX_KEYS = 10000
LOGIN_LIMIT = 5
LOGIN_IP_LIMIT = 20
SIGNUP_LIMIT = 10

LOGIN_LIMIT_MESSAGE = "Too many login attempts. Try again in a minute."
SIGNUP_LIMIT_MESSAGE = "Too many signup attempts. Try again in a minute."


class LoginLimiter:
    def __init__(self, limit, clock=None):
        self.limit = limit
        self.clock = clock or time.monotonic
        self._failures = OrderedDict()
        self._lock = threading.Lock()

    def _fresh(self, stamps, now):
        return [stamp for stamp in stamps if now - stamp < WINDOW_SECONDS]

    def _prune(self, now):
        # Keys stay in order of their newest stamp. Drop from the old end
        # until the first key that still has a hit inside the window.
        while self._failures:
            oldest = next(iter(self._failures))
            newest = self._failures[oldest][-1]
            if now - newest < WINDOW_SECONDS:
                return
            del self._failures[oldest]

    def _drop_oldest(self):
        while len(self._failures) > MAX_KEYS:
            self._failures.popitem(last=False)

    def _stamps_for(self, key, now):
        fresh = self._fresh(self._failures.get(key, []), now)
        if key not in self._failures:
            return fresh
        if not fresh:
            del self._failures[key]
            return fresh
        self._failures[key] = fresh
        return fresh

    def is_blocked(self, key):
        now = self.clock()
        with self._lock:
            self._prune(now)
            return len(self._stamps_for(key, now)) >= self.limit

    def record_failure(self, key):
        now = self.clock()
        with self._lock:
            self._prune(now)
            stamps = self._fresh(self._failures.get(key, []), now)
            stamps.append(now)
            # Newest stamp is `now`, so this key expires last.
            self._failures.pop(key, None)
            self._failures[key] = stamps
            self._drop_oldest()

    def clear(self, key):
        now = self.clock()
        with self._lock:
            self._prune(now)
            self._failures.pop(key, None)

    def retry_after(self, key):
        # Whole seconds until the oldest hit in the window expires, from 1 to 60.
        now = self.clock()
        with self._lock:
            self._prune(now)
            stamps = self._stamps_for(key, now)
            if not stamps:
                return 1
            remaining = WINDOW_SECONDS - (now - min(stamps))
            seconds = math.ceil(remaining)
            if seconds < 1:
                return 1
            if seconds > WINDOW_SECONDS:
                return WINDOW_SECONDS
            return seconds

    def reset(self):
        with self._lock:
            self._failures.clear()

    def key_count(self):
        with self._lock:
            return len(self._failures)


login_limiter = LoginLimiter(LOGIN_LIMIT)
login_ip_limiter = LoginLimiter(LOGIN_IP_LIMIT)
signup_limiter = LoginLimiter(SIGNUP_LIMIT)


def reset_login_limiter():
    login_limiter.reset()
    login_ip_limiter.reset()
    signup_limiter.reset()


def client_ip():
    return request.remote_addr or ""


def login_key(username):
    return f"{username.lower()}|{client_ip()}"


def too_many(seconds, message):
    wait = seconds
    if wait < 1:
        wait = 1
    if wait > WINDOW_SECONDS:
        wait = WINDOW_SECONDS
    return {"error": message}, 429, {"Retry-After": str(wait)}


def _wait_if_blocked(limiter, key):
    if not limiter.is_blocked(key):
        return None
    return limiter.retry_after(key)


def login_blocked(username):
    waits = []
    user_wait = _wait_if_blocked(login_limiter, login_key(username))
    if user_wait is not None:
        waits.append(user_wait)
    ip_wait = _wait_if_blocked(login_ip_limiter, client_ip())
    if ip_wait is not None:
        waits.append(ip_wait)
    if not waits:
        return None
    return too_many(max(waits), LOGIN_LIMIT_MESSAGE)


def record_login_failure(username):
    login_limiter.record_failure(login_key(username))
    login_ip_limiter.record_failure(client_ip())


def clear_login_failures(username):
    # A good password clears this name on this IP. The per-IP cap stays,
    # so one success cannot erase a flood of other names.
    login_limiter.clear(login_key(username))


def signup_blocked():
    ip = client_ip()
    wait = _wait_if_blocked(signup_limiter, ip)
    if wait is None:
        return None
    return too_many(wait, SIGNUP_LIMIT_MESSAGE)


def record_signup_attempt():
    signup_limiter.record_failure(client_ip())
