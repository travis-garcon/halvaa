from sqlmodel import Session, select

from app.core.auth import hash_password
from app.db import engine
from app.models.enums import UserRole
from app.models.user import User

EMAIL = "dev@example.com"
PASSWORD = "devpassword123"


def main() -> None:
    with Session(engine) as session:
        user = session.exec(select(User).where(User.email == EMAIL)).first()
        if user is None:
            user = User(
                email=EMAIL,
                full_name="Halvaa Dev Admin",
                locale="en",
                hashed_password=hash_password(PASSWORD),
                is_superuser=True,
                role=UserRole.ADMIN,
            )
            session.add(user)
        else:
            user.is_superuser = True
            user.role = UserRole.ADMIN
            if not user.hashed_password:
                user.hashed_password = hash_password(PASSWORD)
            session.add(user)
        session.commit()
    print(f"Admin ready: {EMAIL} / {PASSWORD}")


if __name__ == "__main__":
    main()
