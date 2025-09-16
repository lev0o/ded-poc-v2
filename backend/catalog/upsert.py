# backend/catalog/upsert.py
from typing import Iterable
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from catalog.models import Workspace, Item, SqlEndpoint, Schema, Table, Column

async def upsert_workspaces(session: AsyncSession, rows: Iterable[dict]):
    for r in rows:
        obj = await session.get(Workspace, r["id"])
        if obj:
            for k, v in r.items(): setattr(obj, k, v)
        else:
            obj = Workspace(**r)
            session.add(obj)

async def upsert_items(session: AsyncSession, rows: Iterable[dict]):
    for r in rows:
        obj = await session.get(Item, r["id"])
        if obj:
            for k, v in r.items(): setattr(obj, k, v)
        else:
            obj = Item(**r)
            session.add(obj)

async def upsert_sql_endpoints(session: AsyncSession, rows: Iterable[dict]):
    for r in rows:
        obj = await session.get(SqlEndpoint, r["database_id"])
        if obj:
            for k, v in r.items(): setattr(obj, k, v)
        else:
            obj = SqlEndpoint(**r)
            session.add(obj)

async def upsert_schemas(session: AsyncSession, rows: Iterable[dict]):
    for r in rows:
        key = (r["workspace_id"], r["database_id"], r["schema_name"])
        obj = await session.get(Schema, key)
        if obj:
            for k, v in r.items(): setattr(obj, k, v)
        else:
            session.add(Schema(**r))

async def upsert_tables(session: AsyncSession, rows: Iterable[dict]):
    for r in rows:
        key = (r["workspace_id"], r["database_id"], r["schema_name"], r["table_name"])
        obj = await session.get(Table, key)
        if obj:
            for k, v in r.items(): setattr(obj, k, v)
        else:
            session.add(Table(**r))

async def upsert_columns(session: AsyncSession, rows: Iterable[dict]):
    for r in rows:
        key = (r["workspace_id"], r["database_id"], r["schema_name"], r["table_name"], r["column_name"])
        obj = await session.get(Column, key)
        if obj:
            for k, v in r.items(): setattr(obj, k, v)
        else:
            session.add(Column(**r))
