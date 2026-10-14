import bcrypt

from django.contrib.auth.hashers import BasePasswordHasher


class FriinkBcryptPasswordHasher(BasePasswordHasher):
    """Verify imported raw Friink bcrypt hashes, then upgrade on login."""

    algorithm = "friink_bcrypt"

    def encode(self, password, salt):
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        return f"{self.algorithm}${hashed.decode('ascii')}"

    def verify(self, password, encoded):
        try:
            algorithm, raw_hash = encoded.split("$", 1)
            if algorithm != self.algorithm:
                return False
            return bcrypt.checkpw(password.encode("utf-8"), raw_hash.encode("ascii"))
        except (ValueError, UnicodeError):
            return False

    def decode(self, encoded):
        algorithm, raw_hash = encoded.split("$", 1)
        if algorithm != self.algorithm:
            raise ValueError("Invalid password hash algorithm")
        return {"algorithm": algorithm, "hash": raw_hash, "iterations": 0, "salt": ""}

    def safe_summary(self, encoded):
        decoded = self.decode(encoded)
        return {"algorithm": decoded["algorithm"], "hash": "****************"}

    def must_update(self, encoded):
        return True
