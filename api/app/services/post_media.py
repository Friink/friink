from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.config import Settings


MAX_POST_MEDIA_BYTES = 500 * 1024
POST_MEDIA_PREFIX = "post-media"
CHAT_MEDIA_PREFIX = "chat-media"


class PostMediaStorageNotConfiguredError(RuntimeError):
    """Raised when post-media R2 settings or its client dependency are missing."""


class PostMediaObjectError(RuntimeError):
    """Raised when a post-media object cannot be verified or deleted."""


@dataclass(frozen=True)
class PostMediaUpload:
    upload_url: str
    public_url: str | None
    object_key: str


class PostMediaStorageService:
    """R2 operations for authenticated JPEG media.

    Profile pictures retain their separate storage contract. Post and chat
    media use distinct namespaces but share this upload implementation.
    """

    def __init__(self, settings: Settings):
        self.settings = settings

    def _client(self):
        values = (
            self.settings.r2_account_id,
            self.settings.r2_access_key_id,
            self.settings.r2_secret_access_key,
            self.settings.r2_bucket_name,
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

    def public_url(self, object_key: str) -> str | None:
        if not self.settings.r2_public_url.strip():
            return None
        return f"{self.settings.r2_public_url.rstrip('/')}/{object_key}"

    def create_upload(self, user_id: uuid.UUID, prefix: str = POST_MEDIA_PREFIX) -> PostMediaUpload:
        object_key = f"{prefix}/{user_id}/{uuid.uuid4().hex}.jpg"
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

    def confirm(self, object_key: str, user_id: uuid.UUID, prefix: str = POST_MEDIA_PREFIX) -> None:
        """Confirm an API-issued key after the client receives a successful PUT.

        Public object reads are deliberately not part of confirmation because
        staging may use a private bucket or a delivery domain that rejects
        HEAD/GET.
        """
        self._validate_key(object_key, user_id, prefix)

    def delete(self, object_key: str, user_id: uuid.UUID, prefix: str = POST_MEDIA_PREFIX) -> None:
        self._validate_key(object_key, user_id, prefix)
        try:
            self._client().delete_object(Bucket=self.settings.r2_bucket_name, Key=object_key)
        except PostMediaStorageNotConfiguredError:
            raise
        except Exception as exc:
            raise PostMediaObjectError("The post image could not be removed.") from exc

    @staticmethod
    def validate_key(object_key: str, user_id: uuid.UUID, namespace: str = POST_MEDIA_PREFIX) -> None:
        PostMediaStorageService._validate_key(object_key, user_id, namespace)

    @staticmethod
    def _validate_key(object_key: str, user_id: uuid.UUID, namespace: str = POST_MEDIA_PREFIX) -> None:
        prefix = f"{namespace}/{user_id}/"
        if not object_key.startswith(prefix) or object_key.count("/") != 2 or not object_key.endswith(".jpg"):
            raise ValueError("Post media object key is invalid.")
