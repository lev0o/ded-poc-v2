# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from catalog.db import init_db
from routers import workspaces
from routers import sqldb
from routers import dbmeta
from routers import diagnostics_sqldb
from routers import introspect
from routers import agent_graph
from routers import catalog

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
