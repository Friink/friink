from __future__ import annotations

import uuid
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings


MAX_POST_MEDIA_BYTES = 500 * 1024
POST_MEDIA_PREFIX = "post-media"


class PostMediaStorageNotConfiguredError(RuntimeError):
    """Raised when post-media R2 settings or its client dependency are missing."""


class PostMediaObjectError(RuntimeError):
    """Raised when a post-media object cannot be verified or deleted."""


@dataclass(frozen=True)
class PostMediaUpload:
    upload_url: str
    public_url: str
    object_key: str


class PostMediaStorageService:
    """R2 operations for post media only.

    This service deliberately owns the post-media namespace and limits. It
    does not share profile-picture key validation, confirmation, or deletion.
    """

    def __init__(self, settings: Settings):
        self.settings = settings

    def _client(self):
        values = (
            self.settings.r2_account_id,
            self.settings.r2_access_key_id,
            self.settings.r2_secret_access_key,
            self.settings.r2_bucket_name,
            self.settings.r2_public_url,
        )
        if not all(value.strip() for value in values):
            raise PostMediaStorageNotConfiguredError("R2 storage is not configured for post media.")

        try:
            import boto3
        except ImportError as exc:  # pragma: no cover - dependency is installed in deployed environments
            raise PostMediaStorageNotConfiguredError("The post-media storage client dependency is not installed.") from exc

        return boto3.client(
            "s3",
            endpoint_url=f"https://{self.settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=self.settings.r2_access_key_id,
            aws_secret_access_key=self.settings.r2_secret_access_key,
            region_name="auto",
        )

    def public_url(self, object_key: str) -> str:
        return f"{self.settings.r2_public_url.rstrip('/')}/{object_key}"

    def create_upload(self, user_id: uuid.UUID) -> PostMediaUpload:
        object_key = f"{POST_MEDIA_PREFIX}/{user_id}/{uuid.uuid4().hex}.jpg"
        upload_url = self._client().generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.settings.r2_bucket_name,
                "Key": object_key,
                "ContentType": "image/jpeg",
            },
            ExpiresIn=900,
            HttpMethod="PUT",
        )
        return PostMediaUpload(
            upload_url=upload_url,
            public_url=self.public_url(object_key),
            object_key=object_key,
        )

    def confirm(self, object_key: str, user_id: uuid.UUID) -> None:
        self._validate_key(object_key, user_id)
        try:
            metadata = self._client().head_object(Bucket=self.settings.r2_bucket_name, Key=object_key)
        except PostMediaStorageNotConfiguredError:
            raise
        except Exception:
            try:
                self._verify_public_object(self.public_url(object_key))
                return
            except PostMediaObjectError:
                raise
            except Exception as exc:
                raise PostMediaObjectError("The post image could not be verified.") from exc

        content_type = str(metadata.get("ContentType", "")).split(";", 1)[0].lower()
        if content_type != "image/jpeg":
            raise PostMediaObjectError("Post images must be JPEG files.")
        if int(metadata.get("ContentLength", 0)) > MAX_POST_MEDIA_BYTES:
            raise PostMediaObjectError("Post images must be 500 KB or smaller.")

    def delete(self, object_key: str, user_id: uuid.UUID) -> None:
        self._validate_key(object_key, user_id)
        try:
            self._client().delete_object(Bucket=self.settings.r2_bucket_name, Key=object_key)
        except PostMediaStorageNotConfiguredError:
            raise
        except Exception as exc:
            raise PostMediaObjectError("The post image could not be removed.") from exc

    @staticmethod
    def _validate_key(object_key: str, user_id: uuid.UUID) -> None:
        prefix = f"{POST_MEDIA_PREFIX}/{user_id}/"
        if not object_key.startswith(prefix) or object_key.count("/") != 2 or not object_key.endswith(".jpg"):
            raise ValueError("Post media object key is invalid.")

    def _verify_public_object(self, public_url: str) -> None:
        try:
            with urlopen(Request(public_url, method="HEAD"), timeout=10) as response:
                self._validate_public_headers(response.headers)
                return
        except PostMediaObjectError:
            raise
        except (HTTPError, URLError, TimeoutError, ValueError):
            pass

        with urlopen(Request(public_url, method="GET"), timeout=10) as response:
            self._validate_public_headers(response.headers)
            content_length = response.headers.get("Content-Length")
            if not content_length and len(response.read(MAX_POST_MEDIA_BYTES + 1)) > MAX_POST_MEDIA_BYTES:
                raise PostMediaObjectError("Post images must be 500 KB or smaller.")

    @staticmethod
    def _validate_public_headers(headers) -> None:
        content_type = headers.get("Content-Type", "").split(";", 1)[0].lower()
        if content_type != "image/jpeg":
            raise PostMediaObjectError("Post images must be JPEG files.")
        content_length = headers.get("Content-Length")
        if content_length and int(content_length) > MAX_POST_MEDIA_BYTES:
            raise PostMediaObjectError("Post images must be 500 KB or smaller.")
