"""Operator utilities. Credentials are read from the environment, never CLI arguments."""
import argparse
from uuid import UUID
from sqlalchemy import select
from backend.app.storage import transaction, roles


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["grant-admin", "revoke-admin"])
    parser.add_argument("user_id", type=UUID)
    args = parser.parse_args()
    with transaction() as conn:
        user_id = str(args.user_id)
        if args.command == "grant-admin":
            if not conn.execute(select(roles).where(roles.c.user_id == user_id)).first():
                conn.execute(roles.insert().values(user_id=user_id, role="admin"))
        else:
            conn.execute(roles.delete().where(roles.c.user_id == user_id))
    print("Rol actualizado. El acceso administrativo requiere MFA.")


if __name__ == "__main__":
    main()
