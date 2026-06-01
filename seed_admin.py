import argparse
import secrets
import string
import sys

import psycopg2
from argon2 import PasswordHasher

hasher = PasswordHasher(
    time_cost=3,
    memory_cost=64 * 1024,
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def generate_password(length: int = 16) -> str:
    alphabet = (
        "ABCDEFGHJKLMNPQRSTUVWXYZ"
        "abcdefghijkmnpqrstuvwxyz"
        "23456789"
        "!@#$%&*+-="
    )
    while True:
        pw = "".join(secrets.choice(alphabet) for _ in range(length))
        # require at least one of each category for resilience
        if (any(c.islower() for c in pw)
                and any(c.isupper() for c in pw)
                and any(c.isdigit() for c in pw)
                and any(c in "!@#$%&*+-=" for c in pw)):
            return pw


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--dsn", required=True,
                   help='psycopg2 connection string, e.g. "host=127.0.0.1 port=5432 dbname=scorecard user=scorecard_app password=..."')
    p.add_argument("--email", help="Admin user's email")
    p.add_argument("--name", help="Admin user's full name")
    p.add_argument("--reset", action="store_true",
                   help="If the email already exists, reset its password instead of failing.")
    args = p.parse_args()

    email = (args.email or input("Admin email: ").strip()).lower()
    if "@" not in email:
        print("ERROR: invalid email.", file=sys.stderr)
        sys.exit(1)

    name = args.name or input("Full name: ").strip()
    if not name:
        print("ERROR: full name required.", file=sys.stderr)
        sys.exit(1)

    password = generate_password()
    password_hash = hasher.hash(password)

    conn = psycopg2.connect(args.dsn)
    try:
        with conn:
            with conn.cursor() as cur:
                cur.execute("SELECT user_id, is_admin FROM app_user WHERE email = %s", (email,))
                existing = cur.fetchone()

                if existing and not args.reset:
                    print(f"ERROR: a user with email {email!r} already exists "
                          f"(user_id={existing[0]}). Use --reset to overwrite the password.",
                          file=sys.stderr)
                    sys.exit(1)

                if existing:
                    cur.execute(
                        """UPDATE app_user
                           SET password_hash = %s,
                               must_change_password = TRUE,
                               is_admin = TRUE,
                               active = TRUE,
                               full_name = %s
                         WHERE email = %s
                         RETURNING user_id;""",
                        (password_hash, name, email),
                    )
                    action = "reset password for"
                else:
                    cur.execute(
                        """INSERT INTO app_user
                             (email, full_name, password_hash,
                              is_admin, is_global, active, must_change_password)
                           VALUES (%s, %s, %s, TRUE, FALSE, TRUE, TRUE)
                           RETURNING user_id;""",
                        (email, name, password_hash),
                    )
                    action = "created"

                user_id = cur.fetchone()[0]
    finally:
        conn.close()

    bar = "=" * 60
    print()
    print(bar)
    print(f"  Admin user {action}: {email}  (user_id={user_id})")
    print(bar)
    print()
    print(f"  TEMPORARY PASSWORD:   {password}")
    print()
    print("  This password is shown ONCE and is not stored anywhere.")
    print("  Give it to the user through a direct channel.")
    print("  They will be required to change it on first login.")
    print(bar)


if __name__ == "__main__":
    main()