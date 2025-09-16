# fabric_explorer/catalog/models.py
from typing import Optional
from sqlmodel import SQLModel, Field
from datetime import datetime

class Workspace(SQLModel, table=True):
    id: str = Field(primary_key=True)
    name: str
    state: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    last_activity_at: Optional[str] = None
    region: Optional[str] = None
    version: int = 0
    last_synced_at: Optional[str] = None

class Item(SQLModel, table=True):
    id: str = Field(primary_key=True)
    workspace_id: str = Field(index=True, foreign_key="workspace.id")
    type: str
    name: Optional[str] = None
    updated_at: Optional[str] = None
    last_synced_at: Optional[str] = None

class SqlEndpoint(SQLModel, table=True):
    database_id: str = Field(primary_key=True)         # the Fabric item id
    workspace_id: str = Field(index=True, foreign_key="workspace.id")
    kind: str                                          # SqlDatabase | Warehouse | LakehouseSqlEndpoint
    name: str | None = None
    server: str | None = None
    database: str | None = None
    port: int | None = 1433
    connection_string: str | None = None               # sanitized; token-based auth is used
    last_synced_at: str | None = None

class Schema(SQLModel, table=True):
    workspace_id: str = Field(primary_key=True)
    database_id: str = Field(primary_key=True)
    schema_name: str = Field(primary_key=True)
    sampled_at: Optional[str] = None

class Table(SQLModel, table=True):
    workspace_id: str = Field(primary_key=True)
    database_id: str = Field(primary_key=True)
    schema_name: str = Field(primary_key=True)
    table_name: str = Field(primary_key=True)
    row_count: Optional[int] = None
    last_modified: Optional[str] = None
    sampled_at: Optional[str] = None

class Column(SQLModel, table=True):
    workspace_id: str = Field(primary_key=True)
    database_id: str = Field(primary_key=True)
    schema_name: str = Field(primary_key=True)
    table_name: str = Field(primary_key=True)
    column_name: str = Field(primary_key=True)
    ordinal: Optional[int] = None
    data_type: Optional[str] = None
    is_nullable: Optional[bool] = None
    max_length: Optional[int] = None
    numeric_precision: Optional[int] = None
    numeric_scale: Optional[int] = None
    sampled_at: Optional[str] = None