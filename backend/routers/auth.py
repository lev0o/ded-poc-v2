# backend/routers/auth.py
"""
Authentication endpoints for user management and RLS.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any, Optional
from pydantic import BaseModel
from auth.user_auth import auth_service, FabricUser, create_rls_context
from auth.middleware import get_current_user, get_current_user_optional

router = APIRouter(prefix="/auth", tags=["authentication"])

class LoginRequest(BaseModel):
    access_token: str

class LoginResponse(BaseModel):
    user: Dict[str, Any]
    rls_status: Dict[str, Any]
    message: str

class UserInfoResponse(BaseModel):
    user_id: str
    email: str
    name: str
    roles: list
    permissions: Dict[str, Any]
    rls_enabled: bool
    last_login: str

@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Authenticate user with access token."""
    try:
        # Authenticate user
        user = await auth_service.authenticate_user(request.access_token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid access token")
        
        # Create RLS context
        rls_context = create_rls_context(user)
        
        return LoginResponse(
            user={
                "user_id": user.user_id,
                "email": user.email,
                "name": user.name,
                "roles": [role.value for role in user.roles],
                "permissions": user.permissions,
                "last_login": user.last_login.isoformat()
            },
            rls_status=rls_context.get_rls_status(),
            message="Authentication successful"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@router.get("/me", response_model=UserInfoResponse)
async def get_current_user_info(user: FabricUser = Depends(get_current_user)):
    """Get current user information."""
    rls_context = create_rls_context(user)
    
    return UserInfoResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        roles=[role.value for role in user.roles],
        permissions=user.permissions,
        rls_enabled=True,
        last_login=user.last_login.isoformat()
    )

@router.get("/rls-status")
async def get_rls_status(user: FabricUser = Depends(get_current_user)):
    """Get RLS status for current user."""
    rls_context = create_rls_context(user)
    return rls_context.get_rls_status()

@router.post("/refresh-token")
async def refresh_token(user: FabricUser = Depends(get_current_user)):
    """Refresh user's access token."""
    try:
        # Get a new token using the broker
        new_token = await auth_service.refresh_user_token(user.user_id)
        if not new_token:
            raise HTTPException(status_code=500, detail="Failed to refresh token")
        
        return {"access_token": new_token, "message": "Token refreshed successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Token refresh failed: {str(e)}")

@router.post("/logout")
async def logout(user: FabricUser = Depends(get_current_user)):
    """Logout current user."""
    # In a real implementation, you would invalidate the token
    # For now, we'll just remove from cache
    auth_service.token_cache.pop(user.user_id, None)
    
    return {"message": "Logged out successfully"}

@router.get("/permissions")
async def get_user_permissions(user: FabricUser = Depends(get_current_user)):
    """Get user permissions."""
    return {
        "user_id": user.user_id,
        "permissions": user.permissions,
        "roles": [role.value for role in user.roles]
    }

@router.post("/test-rls")
async def test_rls_query(
    query: str,
    user: FabricUser = Depends(get_current_user)
):
    """Test RLS query filtering for current user."""
    rls_context = create_rls_context(user)
    filtered_query = rls_context.apply_rls_to_query(query)
    
    return {
        "original_query": query,
        "rls_filtered_query": filtered_query,
        "user_context": {
            "user_id": user.user_id,
            "roles": [role.value for role in user.roles]
        },
        "policies_applied": rls_context.rls_policies
    }
