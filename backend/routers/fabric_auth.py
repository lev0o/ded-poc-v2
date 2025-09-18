# backend/routers/fabric_auth.py
"""
Proper Microsoft Fabric authentication endpoints using device code flow.
This implements the correct authentication flow for Fabric RLS.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any, Optional
from pydantic import BaseModel
from auth.fabric_rls import fabric_rls_manager, FabricRLSUser, DEMO_RLS_POLICIES
from auth.middleware import get_current_user_optional

router = APIRouter(prefix="/fabric-auth", tags=["fabric-authentication"])

class DeviceCodeResponse(BaseModel):
    user_code: str
    device_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int
    message: str

class AuthStatusResponse(BaseModel):
    authenticated: bool
    user: Optional[Dict[str, Any]]
    rls_enabled: bool
    policies_available: list

class RLSPolicyResponse(BaseModel):
    table_name: str
    policy_name: str
    create_sql: str
    description: str

@router.get("/device-code", response_model=DeviceCodeResponse)
async def initiate_device_code_flow():
    """
    Initiate device code flow for Fabric authentication.
    This is the proper way to authenticate for Fabric RLS.
    """
    try:
        # Use the existing broker to initiate device code flow
        from auth.broker import broker
        flow = broker.app.initiate_device_flow(scopes=fabric_rls_manager.fabric_scopes)
        
        if "user_code" not in flow:
            raise HTTPException(status_code=500, detail="Device code flow initiation failed")
        
        return DeviceCodeResponse(
            user_code=flow["user_code"],
            device_code=flow["device_code"],
            verification_uri=flow["verification_uri"],
            verification_uri_complete=flow["verification_uri_complete"],
            expires_in=flow["expires_in"],
            interval=flow["interval"],
            message=flow["message"]
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Device code flow failed: {str(e)}")

@router.post("/authenticate")
async def authenticate_with_device_code(device_code: str):
    """
    Complete authentication using device code.
    Returns access token for Fabric RLS.
    """
    try:
        from auth.broker import broker
        
        # Complete the device code flow
        result = broker.app.acquire_token_by_device_flow({"device_code": device_code})
        
        if "access_token" not in result:
            raise HTTPException(status_code=401, detail="Device code authentication failed")
        
        access_token = result["access_token"]
        
        # Authenticate user for Fabric RLS
        fabric_user = await fabric_rls_manager.authenticate_user_for_rls(access_token)
        if not fabric_user:
            raise HTTPException(status_code=401, detail="Fabric RLS authentication failed")
        
        return {
            "access_token": access_token,
            "user": {
                "user_id": fabric_user.user_id,
                "upn": fabric_user.upn,
                "email": fabric_user.upn,
                "name": fabric_user.name,
                "roles": fabric_user.roles,
                "groups": fabric_user.groups,
                "tenant_id": fabric_user.tenant_id
            },
            "rls_enabled": True,
            "message": "Fabric RLS authentication successful"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@router.get("/status", response_model=AuthStatusResponse)
async def get_auth_status(user: Optional[FabricRLSUser] = Depends(get_current_user_optional)):
    """Get current authentication status."""
    if not user:
        return AuthStatusResponse(
            authenticated=False,
            user=None,
            rls_enabled=False,
            policies_available=[]
        )
    
    return AuthStatusResponse(
        authenticated=True,
        user={
            "user_id": user.user_id,
            "upn": user.upn,
            "email": user.upn,
            "name": user.name,
            "roles": user.roles,
            "groups": user.groups,
            "tenant_id": user.tenant_id
        },
        rls_enabled=True,
        policies_available=list(DEMO_RLS_POLICIES.keys())
    )

@router.get("/rls-policies")
async def get_rls_policies():
    """Get available RLS policies and their SQL creation scripts."""
    policies = []
    
    for table_name, policy in DEMO_RLS_POLICIES.items():
        policies.append({
            "table_name": table_name,
            "policy_name": policy.policy_name,
            "create_sql": policy.get_create_policy_sql(),
            "description": f"RLS policy for {table_name} table using USER_NAME() function"
        })
    
    return {"policies": policies}

@router.get("/user-name")
async def get_user_name(user: Optional[FabricRLSUser] = Depends(get_current_user_optional)):
    """
    Get the value that USER_NAME() would return for the current user.
    This is critical for understanding Fabric RLS behavior.
    """
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    return {
        "user_name": user.upn,  # This is what USER_NAME() returns in Fabric
        "user_id": user.user_id,
        "email": user.upn,
        "name": user.name,
        "roles": user.roles,
        "explanation": "In Fabric RLS, USER_NAME() returns the user's UPN (User Principal Name), which is typically their email address."
    }

@router.post("/test-rls")
async def test_rls_query(
    query: str,
    user: Optional[FabricRLSUser] = Depends(get_current_user_optional)
):
    """
    Test RLS query filtering for current user.
    Shows how USER_NAME() would be used in the query.
    """
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    # Get SQL token for RLS
    sql_token = fabric_rls_manager.get_sql_token_for_user(user.access_token)
    
    return {
        "original_query": query,
        "user_name": user.upn,
        "sql_token_available": sql_token is not None,
        "rls_explanation": f"In Fabric, this query would be automatically filtered by RLS policies using USER_NAME() = '{user.upn}'",
        "policies_that_would_apply": [
            table for table in DEMO_RLS_POLICIES.keys() 
            if table in query.lower()
        ]
    }

@router.post("/logout")
async def logout(user: Optional[FabricRLSUser] = Depends(get_current_user_optional)):
    """Logout current user."""
    if user:
        # Remove from cache
        fabric_rls_manager.authenticated_users.pop(user.access_token, None)
    
    return {"message": "Logged out successfully"}
