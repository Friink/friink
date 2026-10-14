import uuid

from django.conf import settings
from django.db import models


class FriinkAccountLink(models.Model):
    """Private cross-reference from an auth identity to its userdata account."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    friink_user_id = models.UUIDField(unique=True)
    oidc_subject = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)

    class Meta:
        db_table = "friink_account_links"
