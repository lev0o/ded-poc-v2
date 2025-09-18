# backend/auth/fabric_rls.py
"""
Proper Microsoft Fabric RLS implementation using correct token flow.
Based on Microsoft's official documentation and best practices.
"""
import jwt
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import json
import base64
from settings import settings
from auth.broker import broker, AUTHORITY

class FabricRLSUser:
    """Represents a user authenticated for Fabric RLS."""
    
    def __init__(
        self,
        user_id: str,
        upn: str,  # User Principal Name (email) - critical for USER_NAME()
        name: str,
        tenant_id: str,
        roles: List[str],
        groups: List[str],
        access_token: str,
        sql_token: str,
        token_expires: datetime
    ):
        self.user_id = user_id
        self.upn = upn  # This is what USER_NAME() returns in Fabric
        self.name = name
        self.tenant_id = tenant_id
        self.roles = roles
        self.groups = groups
        self.access_token = access_token
        self.sql_token = sql_token
        self.token_expires = token_expires
        self.created_at = datetime.now()

class FabricRLSManager:
    """Manages Fabric RLS authentication and token handling."""
    
    def __init__(self):
        self.authenticated_users: Dict[str, FabricRLSUser] = {}
        self._setup_fabric_scopes()
    
    def _setup_fabric_scopes(self):
        """Setup Fabric API scopes for proper authentication."""
        # Fabric API scopes
        self.fabric_scopes = [
            "https://api.fabric.microsoft.com/Workspace.Read.All",
            "https://api.fabric.microsoft.com/Item.Read.All",
            "https://graph.microsoft.com/User.Read",
            "https://graph.microsoft.com/Group.Read.All",
            "openid",
            "profile",
            "email"
        ]
        
        # SQL access scope - CRITICAL for RLS
        self.sql_scope = "https://database.windows.net/.default"
    
    async def authenticate_user_for_rls(self, device_code_token: str) -> Optional[FabricRLSUser]:
        """
        Authenticate user using device code flow and get proper tokens for RLS.
        This is the correct way to authenticate for Fabric RLS.
        """
        try:
            # Step 1: Get access token for Fabric API
            fabric_token = broker.token(self.fabric_scopes)
            
            # Step 2: Get SQL access token - CRITICAL for RLS
            sql_token = broker.token([self.sql_scope])
            
            # Step 3: Decode tokens to get user information
            fabric_claims = self._decode_token(fabric_token)
            sql_claims = self._decode_token(sql_token)
            
            if not fabric_claims or not sql_claims:
                return None
            
            # Step 4: Get user details from Microsoft Graph
            user_details = await self._get_user_details_from_graph(fabric_token)
            if not user_details:
                return None
            
            # Step 5: Extract UPN (User Principal Name) - this is what USER_NAME() returns
            upn = fabric_claims.get("preferred_username") or fabric_claims.get("email") or user_details.get("userPrincipalName")
            if not upn:
                return None
            
            # Step 6: Determine user roles from groups
            roles = self._determine_user_roles(user_details)
            
            # Step 7: Create FabricRLSUser
            fabric_user = FabricRLSUser(
                user_id=fabric_claims.get("oid", fabric_claims.get("sub")),
                upn=upn,  # Critical for USER_NAME() function
                name=fabric_claims.get("name", user_details.get("displayName", "")),
                tenant_id=fabric_claims.get("tid"),
                roles=roles,
                groups=user_details.get("memberOf", []),
                access_token=fabric_token,
                sql_token=sql_token,
                token_expires=datetime.fromtimestamp(fabric_claims.get("exp", 0))
            )
            
            # Step 8: Cache the user
            self.authenticated_users[fabric_token] = fabric_user
            
            return fabric_user
            
        except Exception as e:
            print(f"Fabric RLS authentication error: {e}")
            return None
    
    def _decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode JWT token to extract claims."""
        try:
            # Decode without verification for demo (in production, verify signature)
            decoded = jwt.decode(token, options={"verify_signature": False})
            return decoded
        except Exception as e:
            print(f"Token decode error: {e}")
            return None
    
    async def _get_user_details_from_graph(self, access_token: str) -> Optional[Dict[str, Any]]:
        """Get user details from Microsoft Graph API."""
        try:
            async with httpx.AsyncClient() as client:
                headers = {"Authorization": f"Bearer {access_token}"}
                
                # Get user profile
                user_response = await client.get(
                    "https://graph.microsoft.com/v1.0/me",
                    headers=headers
                )
                
                if user_response.status_code != 200:
                    return None
                
                user_data = user_response.json()
                
                # Get user groups
                groups_response = await client.get(
                    "https://graph.microsoft.com/v1.0/me/memberOf",
                    headers=headers
                )
                
                groups = []
                if groups_response.status_code == 200:
                    groups_data = groups_response.json()
                    groups = [group.get("displayName", "") for group in groups_data.get("value", [])]
                
                user_data["memberOf"] = groups
                return user_data
                
        except Exception as e:
            print(f"Graph API error: {e}")
            return None
    
    def _determine_user_roles(self, user_details: Dict[str, Any]) -> List[str]:
        """Determine user roles based on groups."""
        roles = []
        groups = user_details.get("memberOf", [])
        
        # Map groups to roles (customize based on your organization)
        group_role_mapping = {
            "Fabric Admins": "admin",
            "Fabric Managers": "manager",
            "Fabric Analysts": "analyst",
            "Fabric Viewers": "viewer",
            "Power BI Admins": "admin",
            "Power BI Contributors": "manager",
            "Power BI Viewers": "viewer"
        }
        
        for group in groups:
            if group in group_role_mapping:
                roles.append(group_role_mapping[group])
        
        # Default role if no specific groups found
        if not roles:
            roles.append("viewer")
        
        return roles
    
    def get_user_from_token(self, access_token: str) -> Optional[FabricRLSUser]:
        """Get authenticated user from access token."""
        return self.authenticated_users.get(access_token)
    
    def is_token_valid(self, access_token: str) -> bool:
        """Check if the access token is still valid."""
        user = self.authenticated_users.get(access_token)
        if not user:
            return False
        
        return datetime.now() < user.token_expires
    
    def get_sql_token_for_user(self, access_token: str) -> Optional[str]:
        """Get SQL access token for a user (required for RLS)."""
        user = self.authenticated_users.get(access_token)
        if not user:
            return None
        
        # Check if SQL token is still valid
        if datetime.now() < user.token_expires:
            return user.sql_token
        
        # Token expired, need to refresh
        try:
            new_sql_token = broker.token([self.sql_scope])
            user.sql_token = new_sql_token
            return new_sql_token
        except Exception as e:
            print(f"SQL token refresh error: {e}")
            return None

class FabricRLSPolicy:
    """Represents a Fabric RLS policy."""
    
    def __init__(self, table_name: str, policy_name: str, predicate_function: str):
        self.table_name = table_name
        self.policy_name = policy_name
        self.predicate_function = predicate_function
    
    def get_create_policy_sql(self) -> str:
        """Generate SQL to create the RLS policy."""
        return f"""
-- Create security predicate function
CREATE FUNCTION dbo.fn_securitypredicate_{self.table_name}(@UserName AS sysname)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN SELECT 1 AS fn_securitypredicate_result
WHERE @UserName = USER_NAME();

-- Create security policy
CREATE SECURITY POLICY dbo.{self.policy_name}
ADD FILTER PREDICATE dbo.fn_securitypredicate_{self.table_name}(UserName)
ON dbo.{self.table_name}
WITH (STATE = ON);
"""

# Global RLS manager instance
fabric_rls_manager = FabricRLSManager()

# Predefined RLS policies for demo
DEMO_RLS_POLICIES = {
    "sales_data": FabricRLSPolicy(
        table_name="sales_data",
        policy_name="SalesDataRLS",
        predicate_function="fn_securitypredicate_sales_data"
    ),
    "customer_data": FabricRLSPolicy(
        table_name="customer_data", 
        policy_name="CustomerDataRLS",
        predicate_function="fn_securitypredicate_customer_data"
    ),
    "financial_data": FabricRLSPolicy(
        table_name="financial_data",
        policy_name="FinancialDataRLS", 
        predicate_function="fn_securitypredicate_financial_data"
    )
}

def get_fabric_rls_user(access_token: str) -> Optional[FabricRLSUser]:
    """Get Fabric RLS user from access token."""
    return fabric_rls_manager.get_user_from_token(access_token)

def get_sql_token_for_rls(access_token: str) -> Optional[str]:
    """Get SQL token for RLS enforcement."""
    return fabric_rls_manager.get_sql_token_for_user(access_token)
