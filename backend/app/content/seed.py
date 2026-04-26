"""
CLI: python -m app.content.seed
UPSERTs compiled.json into script_steps table.
"""
import asyncio

from sqlalchemy.dialects.postgresql import insert

from app.content.loader import load_steps
from app.db.session import AsyncSessionLocal
from app.db.models import ScriptStep


async def seed() -> None:
    steps = load_steps()
    async with AsyncSessionLocal() as session:
        for s in steps:
            stmt = insert(ScriptStep).values(
                id=s.id,
                aspect=s.aspect,
                level=s.level,
                ord=s.ord,
                kind=s.kind,
                source_file=s.source_file,
                title=s.title,
                body_md=s.body_md,
                meta=s.meta,
            ).on_conflict_do_update(
                index_elements=["id"],
                set_=dict(title=s.title, body_md=s.body_md, meta=s.meta, ord=s.ord),
            )
            await session.execute(stmt)
        await session.commit()
    print(f"Seeded {len(steps)} steps into script_steps.")


if __name__ == "__main__":
    asyncio.run(seed())
