from app.models.user import User

PROFILE_COMPLETION_FIELDS = ("full_name", "email", "phone_number", "locale", "address")


def missing_profile_fields(user: User) -> list[str]:
    missing: list[str] = []
    if not user.full_name.strip():
        missing.append("full_name")
    if not user.email:
        missing.append("email")
    if not user.phone_number:
        missing.append("phone_number")
    if not user.locale:
        missing.append("locale")
    if not (user.address or "").strip():
        missing.append("address")
    return missing


def profile_is_complete(user: User) -> bool:
    return not missing_profile_fields(user)
