# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.catalog.db import init_db
from backend.routers import workspaces
from backend.routers import sqldb
from backend.routers import dbmeta
from backend.routers import diagnostics_sqldb
from backend.routers import introspect
from backend.routers import agent_graph
from backend.routers import catalog

app = FastAPI(title="Fabric Explorer API", version="0.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(workspaces.router)
app.include_router(sqldb.router)
app.include_router(dbmeta.router)
app.include_router(diagnostics_sqldb.router)
app.include_router(introspect.router)
app.include_router(agent_graph.router)
app.include_router(catalog.router)

@app.on_event("startup")
async def _startup():
    await init_db()