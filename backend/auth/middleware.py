# backend/auth/middleware.py
"""
Authentication middleware for FastAPI.
Handles JWT token validation and user context.
"""
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
import jwt
from auth.user_auth import auth_service, FabricUser

security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> FabricUser:
    """Dependency to get current authenticated user."""
    token = credentials.credentials
    
    # Check if token is cached
    user = auth_service.get_user_from_token(token)
    if user and auth_service.is_token_valid(token):
        return user
    
    # Authenticate user with token
    user = await auth_service.authenticate_user(token)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

async def get_current_user_optional(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[FabricUser]:
    """Optional dependency to get current user (for public endpoints)."""
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None

def require_role(required_roles: list):
    """Decorator to require specific roles."""
    def role_checker(user: FabricUser = Depends(get_current_user)) -> FabricUser:
        user_roles = [role.value for role in user.roles]
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=403,
                detail=f"Required roles: {required_roles}. User has: {user_roles}"
            )
        return user
    return role_checker

def require_permission(permission: str):
    """Decorator to require specific permission."""
    def permission_checker(user: FabricUser = Depends(get_current_user)) -> FabricUser:
        if not user.permissions.get(permission, False):
            raise HTTPException(
                status_code=403,
                detail=f"Required permission: {permission}"
            )
        return user
    return permission_checker
