from __future__ import annotations

import uuid
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.config import Settings


class StorageNotConfiguredError(RuntimeError):
    """Raised when R2 credentials have not been supplied for the environment."""


class StorageObjectError(RuntimeError):
    """Raised when an R2 object cannot be inspected or deleted."""


MAX_PROFILE_PICTURE_BYTES = 3 * 1024 * 1024
MAX_POST_MEDIA_BYTES = 500 * 1024
POST_MEDIA_PREFIX = "post-media"


@dataclass(frozen=True)
class UploadUrl:
    upload_url: str
    public_url: str
    object_key: str


class StorageService:
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
            raise StorageNotConfiguredError("R2 storage is not configured.")

        try:
            import boto3
        except ImportError as exc:  # pragma: no cover - dependency is installed in deployed environments
            raise StorageNotConfiguredError("R2 storage client dependency is not installed.") from exc

        return boto3.client(
            "s3",
            endpoint_url=f"https://{self.settings.r2_account_id}.r2.cloudflarestorage.com",
            aws_access_key_id=self.settings.r2_access_key_id,
            aws_secret_access_key=self.settings.r2_secret_access_key,
            region_name="auto",
        )

    def generate_upload_url(self, user_id: uuid.UUID, content_type: str) -> UploadUrl:
        if not content_type.lower().startswith("image/"):
            raise ValueError("Profile pictures must use an image content type.")
        extension = content_type.split("/", 1)[1].lower().replace("jpeg", "jpg")
        object_key = f"profile-pictures/{user_id}/{uuid.uuid4().hex}.{extension}"
        client = self._client()
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.settings.r2_bucket_name, "Key": object_key, "ContentType": content_type},
            ExpiresIn=900,
            HttpMethod="PUT",
        )
        public_url = f"{self.settings.r2_public_url.rstrip('/')}/{object_key}"
        return UploadUrl(upload_url=upload_url, public_url=public_url, object_key=object_key)

    def generate_post_media_upload_url(self, user_id: uuid.UUID) -> UploadUrl:
        object_key = f"{POST_MEDIA_PREFIX}/{user_id}/{uuid.uuid4().hex}.jpg"
        client = self._client()
        upload_url = client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.settings.r2_bucket_name, "Key": object_key, "ContentType": "image/jpeg"},
            ExpiresIn=900,
            HttpMethod="PUT",
        )
        public_url = f"{self.settings.r2_public_url.rstrip('/')}/{object_key}"
        return UploadUrl(upload_url=upload_url, public_url=public_url, object_key=object_key)

    def public_url(self, object_key: str) -> str:
        return f"{self.settings.r2_public_url.rstrip('/')}/{object_key}"

    def confirm_post_media_object(self, object_key: str, user_id: uuid.UUID) -> None:
        self._validate_post_media_key(object_key, user_id)
        try:
            metadata = self._client().head_object(Bucket=self.settings.r2_bucket_name, Key=object_key)
        except StorageNotConfiguredError:
            raise
        except Exception as exc:
            raise StorageObjectError("The post image could not be verified.") from exc
        if str(metadata.get("ContentType", "")).lower() != "image/jpeg":
            raise StorageObjectError("Post images must be JPEG files.")
        if int(metadata.get("ContentLength", 0)) > MAX_POST_MEDIA_BYTES:
            raise StorageObjectError("Post images must be 500 KB or smaller.")

    def delete_post_media_object(self, object_key: str, user_id: uuid.UUID) -> None:
        self._validate_post_media_key(object_key, user_id)
        try:
            self._client().delete_object(Bucket=self.settings.r2_bucket_name, Key=object_key)
        except StorageNotConfiguredError:
            raise
        except Exception as exc:
            raise StorageObjectError("The post image could not be removed.") from exc

    def confirm_object(self, object_key: str, user_id: uuid.UUID) -> None:
        self._validate_user_key(object_key, user_id)
        try:
            metadata = self._client().head_object(Bucket=self.settings.r2_bucket_name, Key=object_key)
            if int(metadata.get("ContentLength", 0)) > MAX_PROFILE_PICTURE_BYTES:
                raise StorageObjectError("Profile picture exceeds the 3 MB maximum size.")
        except StorageNotConfiguredError:
            raise
        except StorageObjectError:
            raise
        except Exception as exc:
            # R2's public development URL is already the persisted delivery
            # path for profile pictures. Use it as a verification fallback
            # when the S3-compatible HEAD request is unavailable in a hosted
            # runtime. Some R2 public endpoints do not reliably implement
            # HEAD, so fall back to a bounded GET while still enforcing the
            # object-size ceiling.
            public_url = f"{self.settings.r2_public_url.rstrip('/')}/{object_key}"
            try:
                try:
                    with urlopen(Request(public_url, method="HEAD"), timeout=10) as response:
                        content_length = response.headers.get("Content-Length")
                        if content_length and int(content_length) > MAX_PROFILE_PICTURE_BYTES:
                            raise StorageObjectError("Profile picture exceeds the 3 MB maximum size.")
                except (HTTPError, URLError, TimeoutError, ValueError):
                    # A GET is needed for providers/CDN configurations that
                    # answer HEAD with 404/405 even though the object is live.
                    with urlopen(Request(public_url, method="GET"), timeout=10) as response:
                        content_length = response.headers.get("Content-Length")
                        if content_length and int(content_length) > MAX_PROFILE_PICTURE_BYTES:
                            raise StorageObjectError("Profile picture exceeds the 3 MB maximum size.")
                        if not content_length and len(response.read(MAX_PROFILE_PICTURE_BYTES + 1)) > MAX_PROFILE_PICTURE_BYTES:
                            raise StorageObjectError("Profile picture exceeds the 3 MB maximum size.")
            except StorageObjectError:
                raise
            except Exception as public_exc:
                raise StorageObjectError("The profile picture upload could not be verified.") from public_exc

    def delete_object(self, object_key: str, user_id: uuid.UUID, *, allow_legacy_key: bool = False) -> None:
        if allow_legacy_key:
            self._validate_stored_profile_key(object_key)
        else:
            self._validate_user_key(object_key, user_id)
        try:
            self._client().delete_object(Bucket=self.settings.r2_bucket_name, Key=object_key)
        except StorageNotConfiguredError:
            raise
        except Exception as exc:
            raise StorageObjectError("The previous profile picture could not be removed.") from exc

    @staticmethod
    def _validate_user_key(object_key: str, user_id: uuid.UUID) -> None:
        if not object_key.startswith(f"profile-pictures/{user_id}/") or object_key.count("/") != 2:
            raise ValueError("Profile picture object key is invalid.")

    @staticmethod
    def _validate_post_media_key(object_key: str, user_id: uuid.UUID) -> None:
        prefix = f"{POST_MEDIA_PREFIX}/{user_id}/"
        if not object_key.startswith(prefix) or object_key.count("/") != 2 or not object_key.endswith(".jpg"):
            raise ValueError("Post media object key is invalid.")

    @staticmethod
    def _validate_stored_profile_key(object_key: str) -> None:
        # Older uploads used a flat object key. This is safe here because the
        # key comes from the authenticated user's previously stored URL, not
        # from the confirmation request.
        if not object_key or object_key.startswith(("/", "\\")) or ".." in object_key or "\\" in object_key:
            raise ValueError("Stored profile picture object key is invalid.")
