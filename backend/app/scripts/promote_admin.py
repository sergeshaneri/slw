"""
Одноразовый скрипт: выставить is_admin=true для web-пользователя.

Запуск на Railway (через Service Settings → Deploy → Custom Start Command,
либо через Railway CLI «railway run»):

    python -m app.scripts.promote_admin               # если в БД один юзер — промоутит его
    python -m app.scripts.promote_admin --list        # просто перечислить всех
    python -m app.scripts.promote_admin --email a@b.c # промоутить по email

Без флагов и при >1 юзере — печатает список и завершается.
"""
import argparse
import asyncio

from sqlalchemy import select, update

from app.db.models import WebUser
from app.db.session import AsyncSessionLocal


def _fmt(u: WebUser) -> str:
    name = u.telegram_first_name or "—"
    return (
        f"id={u.id} email={u.email or '—':25} "
        f"tg_id={u.telegram_id or '—':>12} "
        f"tg_name={name:20} "
        f"admin={u.is_admin}"
    )


async def main(email: str | None, list_only: bool) -> None:
    async with AsyncSessionLocal() as session:
        rows = (await session.execute(select(WebUser))).scalars().all()

        print(f"=== web_users: {len(rows)} ===")
        for u in rows:
            print(_fmt(u))
        print()

        if list_only:
            return

        target: WebUser | None = None

        if email:
            target = next((u for u in rows if u.email == email), None)
            if not target:
                print(f"[!] Юзер с email={email} не найден.")
                return
        elif len(rows) == 1:
            target = rows[0]
            print(f"[i] В базе один пользователь — промочу его.")
        else:
            print("[i] В базе >1 пользователя. Передай --email <addr> чтобы выбрать конкретного.")
            return

        if target.is_admin:
            print(f"[=] {_fmt(target)} — уже админ, ничего не делаю.")
            return

        await session.execute(
            update(WebUser).where(WebUser.id == target.id).values(is_admin=True)
        )
        await session.commit()
        print(f"[OK] is_admin=true для:")
        print(f"     {_fmt(target)}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--email", default=None, help="Email пользователя для промоушена.")
    p.add_argument("--list", dest="list_only", action="store_true", help="Только показать список.")
    args = p.parse_args()
    asyncio.run(main(args.email, args.list_only))
