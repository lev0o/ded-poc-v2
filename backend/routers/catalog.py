# backend/routers/catalog.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from typing import Dict, List, Optional
import httpx

from catalog.db import get_session
from catalog.models import Workspace, SqlEndpoint, Schema, Table, Column
from settings import settings

router = APIRouter(prefix="/catalog", tags=["catalog"])


async def _build_catalog_from_catalog_tables(session: AsyncSession) -> Dict[str, object]:
    """Build catalog from cached backend catalog tables (Workspace, SqlEndpoint, Schema, Table, Column)."""
    try:
        # Get all workspaces
        workspaces_stmt = select(Workspace)
        workspaces_result = await session.execute(workspaces_stmt)
        workspaces_list = list(workspaces_result.scalars())
        
        catalog = {
            "workspaces": [],
            "total_workspaces": len(workspaces_list),
            "total_databases": 0,
            "total_schemas": 0,
            "total_tables": 0,
            "total_columns": 0,
            "source": "cached_catalog_tables"
        }
        
        for ws in workspaces_list:
            workspace_info = {
                "id": ws.id,
                "name": ws.name,
                "state": ws.state,
                "databases": []
            }
            
            # Get databases for this workspace
            databases_stmt = select(SqlEndpoint).where(SqlEndpoint.workspace_id == ws.id)
            databases_result = await session.execute(databases_stmt)
            databases_list = list(databases_result.scalars())
            
            for db in databases_list:
                database_info = {
                    "id": db.database_id,
                    "name": db.name or f"Database {db.database_id[:8]}",
                    "kind": db.kind,
                    "server": db.server,
                    "database": db.database,
                    "port": db.port or 1433,
                    "schemas": []
                }
                
                # Get schemas for this database
                schemas_stmt = select(Schema).where(
                    (Schema.workspace_id == ws.id) & 
                    (Schema.database_id == db.database_id)
                )
                schemas_result = await session.execute(schemas_stmt)
                schemas_list = list(schemas_result.scalars())
                
                for schema in schemas_list:
                    schema_info = {
                        "name": schema.schema_name,
                        "tables": []
                    }
                    
                    # Get tables for this schema
                    tables_stmt = select(Table).where(
                        (Table.workspace_id == ws.id) & 
                        (Table.database_id == db.database_id) & 
                        (Table.schema_name == schema.schema_name)
                    )
                    tables_result = await session.execute(tables_stmt)
                    tables_list = list(tables_result.scalars())
                    
                    for table in tables_list:
                        table_info = {
                            "name": table.table_name,
                            "row_count": table.row_count,
                            "last_modified": table.last_modified,
                            "columns": []
                        }
                        
                        # Get columns for this table
                        columns_stmt = select(Column).where(
                            (Column.workspace_id == ws.id) & 
                            (Column.database_id == db.database_id) & 
                            (Column.schema_name == schema.schema_name) &
                            (Column.table_name == table.table_name)
                        )
                        columns_result = await session.execute(columns_stmt)
                        columns_list = list(columns_result.scalars())
                        
                        for column in columns_list:
                            table_info["columns"].append({
                                "name": column.column_name,
                                "data_type": column.data_type,
                                "is_nullable": column.is_nullable,
                                "max_length": column.max_length,
                                "numeric_precision": column.numeric_precision,
                                "numeric_scale": column.numeric_scale,
                                "ordinal": column.ordinal
                            })
                        
                        schema_info["tables"].append(table_info)
                    
                    database_info["schemas"].append(schema_info)
                
                workspace_info["databases"].append(database_info)
                catalog["total_databases"] += 1
                catalog["total_schemas"] += len(database_info["schemas"])
                catalog["total_tables"] += sum(len(s["tables"]) for s in database_info["schemas"])
                catalog["total_columns"] += sum(sum(len(t["columns"]) for t in s["tables"]) for s in database_info["schemas"])
            
            catalog["workspaces"].append(workspace_info)
        
        return catalog
        
    except Exception as e:
        raise HTTPException(500, f"Failed to build catalog from catalog tables: {type(e).__name__}: {e}")


@router.get("")
async def get_catalog(session: AsyncSession = Depends(get_session)) -> Dict[str, object]:
    """Get the full catalog of workspaces, databases, schemas, tables, and columns."""
    return await _build_catalog_from_catalog_tables(session)


@router.post("/refresh")
async def refresh_catalog(session: AsyncSession = Depends(get_session)) -> Dict[str, str]:
    """Refresh the entire catalog by calling all workspace reload endpoints."""
    try:
        async with httpx.AsyncClient(base_url=str(settings.backend_base), timeout=60) as c:
            # Refresh all workspaces (this will populate workspaces, items, and sql endpoints)
            r = await c.post("/workspaces/refresh")
            if r.status_code != 200:
                raise HTTPException(500, f"Failed to refresh workspaces: {r.status_code}")
            
            # Get all workspaces to refresh their metadata
            workspaces_stmt = select(Workspace)
            workspaces_result = await session.execute(workspaces_stmt)
            workspaces_list = list(workspaces_result.scalars())
            
            # For each workspace, refresh SQL databases (skip inactive workspaces)
            for ws in workspaces_list:
                # Skip SQL database refresh for inactive workspaces
                if ws.state and ws.state.lower() in ['suspended', 'deleted']:
                    print(f"Skipping SQL database refresh for inactive workspace {ws.id} (state: {ws.state})")
                    continue
                    
                r = await c.post(f"/workspaces/{ws.id}/sqldb/refresh")
                if r.status_code != 200:
                    print(f"Warning: Failed to refresh SQL databases for workspace {ws.id}: {r.status_code}")
            
            # Get all SQL endpoints to refresh their metadata (schemas, tables, columns)
            databases_stmt = select(SqlEndpoint)
            databases_result = await session.execute(databases_stmt)
            databases_list = list(databases_result.scalars())
            
            # For each database, introspect to get schemas, tables, and columns (skip inactive workspaces)
            for db in databases_list:
                # Check if the workspace is active before introspecting
                workspace_stmt = select(Workspace).where(Workspace.id == db.workspace_id)
                workspace_result = await session.execute(workspace_stmt)
                workspace = workspace_result.scalar_one_or_none()
                
                if workspace and workspace.state and workspace.state.lower() in ['suspended', 'deleted']:
                    print(f"Skipping introspection for database {db.database_id} in inactive workspace {db.workspace_id} (state: {workspace.state})")
                    continue
                
                try:
                    r = await c.post(f"/workspaces/{db.workspace_id}/sqldb/{db.database_id}/introspect/refresh")
                    if r.status_code != 200:
                        print(f"Warning: Failed to introspect database {db.database_id}: {r.status_code}")
                except Exception as e:
                    print(f"Warning: Failed to introspect database {db.database_id}: {e}")
        
        return {"status": "success", "message": "Catalog refreshed successfully"}
        
    except Exception as e:
        raise HTTPException(500, f"Failed to refresh catalog: {type(e).__name__}: {e}")


@router.post("/refresh/{workspace_id}")
async def refresh_workspace_catalog(
    workspace_id: str, 
    session: AsyncSession = Depends(get_session)
) -> Dict[str, str]:
    """Refresh the catalog for a specific workspace."""
    try:
        async with httpx.AsyncClient(base_url=str(settings.backend_base), timeout=60) as c:
            # Refresh specific workspace
            r = await c.post(f"/workspaces/{workspace_id}/refresh")
            if r.status_code != 200:
                raise HTTPException(500, f"Failed to refresh workspace {workspace_id}: {r.status_code}")
            
            # Check workspace state before proceeding with SQL operations
            workspace_stmt = select(Workspace).where(Workspace.id == workspace_id)
            workspace_result = await session.execute(workspace_stmt)
            workspace = workspace_result.scalar_one_or_none()
            
            if workspace and workspace.state and workspace.state.lower() in ['suspended', 'deleted']:
                return {"status": "skipped", "message": f"Skipped SQL operations for inactive workspace {workspace_id} (state: {workspace.state})"}
            
            # Refresh SQL databases for this workspace
            r = await c.post(f"/workspaces/{workspace_id}/sqldb/refresh")
            if r.status_code != 200:
                raise HTTPException(500, f"Failed to refresh SQL databases for workspace {workspace_id}: {r.status_code}")
            
            # Get SQL endpoints for this workspace and introspect them
            databases_stmt = select(SqlEndpoint).where(SqlEndpoint.workspace_id == workspace_id)
            databases_result = await session.execute(databases_stmt)
            databases_list = list(databases_result.scalars())
            
            # For each database, introspect to get schemas, tables, and columns
            for db in databases_list:
                try:
                    r = await c.post(f"/workspaces/{db.workspace_id}/sqldb/{db.database_id}/introspect/refresh")
                    if r.status_code != 200:
                        print(f"Warning: Failed to introspect database {db.database_id}: {r.status_code}")
                except Exception as e:
                    print(f"Warning: Failed to introspect database {db.database_id}: {e}")
        
        return {"status": "success", "message": f"Catalog refreshed for workspace {workspace_id}"}
        
    except Exception as e:
        raise HTTPException(500, f"Failed to refresh workspace catalog: {type(e).__name__}: {e}")


@router.post("/refresh-active")
async def refresh_active_catalog(session: AsyncSession = Depends(get_session)) -> Dict[str, str]:
    """Refresh the catalog for active workspaces only (skip suspended/deleted)."""
    try:
        async with httpx.AsyncClient(base_url=str(settings.backend_base), timeout=60) as c:
            # Refresh all workspaces (this will populate workspaces, items, and sql endpoints)
            r = await c.post("/workspaces/refresh")
            if r.status_code != 200:
                raise HTTPException(500, f"Failed to refresh workspaces: {r.status_code}")
            
            # Get all workspaces to refresh their metadata
            workspaces_stmt = select(Workspace)
            workspaces_result = await session.execute(workspaces_stmt)
            workspaces_list = list(workspaces_result.scalars())
            
            # For each workspace, refresh SQL databases (skip inactive workspaces)
            for ws in workspaces_list:
                # Skip SQL database refresh for inactive workspaces
                if ws.state and ws.state.lower() in ['suspended', 'deleted']:
                    print(f"Skipping SQL database refresh for inactive workspace {ws.id} (state: {ws.state})")
                    continue
                    
                r = await c.post(f"/workspaces/{ws.id}/sqldb/refresh")
                if r.status_code != 200:
                    print(f"Warning: Failed to refresh SQL databases for workspace {ws.id}: {r.status_code}")
            
            # Get all SQL endpoints to refresh their metadata (schemas, tables, columns)
            databases_stmt = select(SqlEndpoint)
            databases_result = await session.execute(databases_stmt)
            databases_list = list(databases_result.scalars())
            
            # For each database, introspect to get schemas, tables, and columns (skip inactive workspaces)
            for db in databases_list:
                # Check if the workspace is active before introspecting
                workspace_stmt = select(Workspace).where(Workspace.id == db.workspace_id)
                workspace_result = await session.execute(workspace_stmt)
                workspace = workspace_result.scalar_one_or_none()
                
                if workspace and workspace.state and workspace.state.lower() in ['suspended', 'deleted']:
                    print(f"Skipping introspection for database {db.database_id} in inactive workspace {db.workspace_id} (state: {workspace.state})")
                    continue
                
                try:
                    r = await c.post(f"/workspaces/{db.workspace_id}/sqldb/{db.database_id}/introspect/refresh")
                    if r.status_code != 200:
                        print(f"Warning: Failed to introspect database {db.database_id}: {r.status_code}")
                except Exception as e:
                    print(f"Warning: Failed to introspect database {db.database_id}: {e}")
            
            return {"status": "success", "message": "Active workspaces catalog refreshed successfully"}
        
    except Exception as e:
        raise HTTPException(500, f"Failed to refresh active catalog: {type(e).__name__}: {e}")


@router.get("/stats")
async def get_catalog_stats(session: AsyncSession = Depends(get_session)) -> Dict[str, int]:
    """Get catalog statistics."""
    try:
        # Count workspaces
        workspaces_count = (await session.execute(select(Workspace))).scalars().all()
        workspaces_count = len(workspaces_count)
        
        # Count databases
        databases_count = (await session.execute(select(SqlEndpoint))).scalars().all()
        databases_count = len(databases_count)
        
        # Count schemas
        schemas_count = (await session.execute(select(Schema))).scalars().all()
        schemas_count = len(schemas_count)
        
        # Count tables
        tables_count = (await session.execute(select(Table))).scalars().all()
        tables_count = len(tables_count)
        
        # Count columns
        columns_count = (await session.execute(select(Column))).scalars().all()
        columns_count = len(columns_count)
        
        return {
            "workspaces": workspaces_count,
            "databases": databases_count,
            "schemas": schemas_count,
            "tables": tables_count,
            "columns": columns_count
        }
        
    except Exception as e:
        raise HTTPException(500, f"Failed to get catalog stats: {type(e).__name__}: {e}")
