from datetime import datetime, timezone
from pathlib import Path
import re

import psycopg
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from allauth.account.models import EmailAddress
from dotenv import dotenv_values

from accounts.models import FriinkAccountLink


BCRYPT_PATTERN = re.compile(r"^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$")


class Command(BaseCommand):
    help = "Copy existing development accounts into the development auth database."

    def handle(self, *args, **options):
        if __import__("os").environ.get("AUTH_ENVIRONMENT", "local").lower() != "development":
            raise CommandError("Set AUTH_ENVIRONMENT=development before running this import.")

        root = Path(__file__).resolve().parents[4]
        source_config = dotenv_values(root / "api" / ".env.development")
        source_url = (source_config.get("DATABASE_URL") or "").strip()
        if not source_url:
            raise CommandError("api/.env.development must contain DATABASE_URL.")
        source_url = source_url.replace("postgresql+psycopg://", "postgresql://", 1)
        if not source_url.startswith(("postgresql://", "postgres://")):
            raise CommandError("The userdata DATABASE_URL must be PostgreSQL.")

        try:
            with psycopg.connect(source_url, row_factory=psycopg.rows.dict_row) as connection:
                with connection.cursor() as cursor:
                    cursor.execute(
                        """SELECT id, email, username, password_hash, is_verified,
                                  is_staff, account_locked, locked_until,
                                  lifecycle_status, deleted_at
                           FROM users ORDER BY id"""
                    )
                    source_users = cursor.fetchall()
        except Exception as exc:
            raise CommandError("Could not read development userdata. No target rows were changed.") from exc

        User = get_user_model()
        created = 0
        linked = 0
        try:
            with transaction.atomic():
                for record in source_users:
                    existing_link = FriinkAccountLink.objects.select_related("user").filter(
                        friink_user_id=record["id"]
                    ).first()
                    if existing_link:
                        linked += 1
                        continue
                    raw_hash = record["password_hash"]
                    if not BCRYPT_PATTERN.fullmatch(raw_hash or ""):
                        raise CommandError("A source account has an unsupported password hash; import aborted.")
                    if User.objects.filter(email__iexact=record["email"]).exists() or User.objects.filter(
                        username__iexact=record["username"]
                    ).exists():
                        raise CommandError("An unlinked auth account conflicts with a source email or username.")

                    locked = record["account_locked"] or (
                        record["locked_until"] is not None
                        and record["locked_until"] > datetime.now(timezone.utc)
                    )
                    active = (
                        record["lifecycle_status"] == "active"
                        and record["deleted_at"] is None
                        and not locked
                    )
                    user = User.objects.create(
                        username=record["username"],
                        email=record["email"],
                        password=f"friink_bcrypt${raw_hash}",
                        is_active=active,
                        is_staff=record["is_staff"],
                        is_superuser=False,
                    )
                    EmailAddress.objects.create(
                        user=user,
                        email=record["email"],
                        verified=record["is_verified"],
                        primary=True,
                    )
                    FriinkAccountLink.objects.create(user=user, friink_user_id=record["id"])
                    created += 1
        except CommandError:
            raise
        except Exception as exc:
            raise CommandError("The target import failed and was rolled back.") from exc

        self.stdout.write(self.style.SUCCESS(
            f"Imported {created} accounts; {linked} existing mappings were already present."
        ))
