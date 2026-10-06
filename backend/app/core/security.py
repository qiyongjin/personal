import hashlib
import hmac
import re
import secrets
from urllib.parse import urlsplit


def valid_password_hash(value: str) -> bool:
    return re.fullmatch(r"scrypt:[a-f0-9]{32}:[a-f0-9]{128}", value) is not None


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return f"scrypt:{salt}:{key.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    if not valid_password_hash(encoded):
        return False
    _, salt, expected = encoded.split(":")
    actual = hashlib.scrypt(password.encode(), salt=salt.encode(), n=16384, r=8, p=1, dklen=64)
    return hmac.compare_digest(actual, bytes.fromhex(expected))


def trusted_origin(actual: str | None, expected: str, production: bool) -> bool:
    if not actual:
        return False
    if actual == expected:
        return True
    if production:
        return False
    try:
        left, right = urlsplit(actual), urlsplit(expected)
        loopback = {"localhost", "127.0.0.1", "::1"}
        return (
            left.scheme in {"http", "https"}
            and not left.path
            and not left.query
            and not left.fragment
            and not left.username
            and left.hostname in loopback
            and right.hostname in loopback
            and left.scheme == right.scheme
            and (left.port or (443 if left.scheme == "https" else 80))
            == (right.port or (443 if right.scheme == "https" else 80))
        )
    except ValueError:
        return False
