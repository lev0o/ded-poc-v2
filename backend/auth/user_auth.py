# backend/auth/user_auth.py
"""
Fabric-based user authentication and authorization system.
Integrates with Microsoft Fabric's security model for RLS.
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

class UserRole(Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    ANALYST = "analyst"
    VIEWER = "viewer"

@dataclass
class FabricUser:
    """Represents an authenticated Fabric user."""
    user_id: str
    email: str
    name: str
    tenant_id: str
    roles: List[UserRole]
    groups: List[str]
    permissions: Dict[str, Any]
    last_login: datetime
    token_expires: datetime

class FabricAuthService:
    """Service for handling Fabric-based authentication."""
    
    def __init__(self):
        self.token_cache: Dict[str, FabricUser] = {}
        self._setup_fabric_scopes()
    
    def _setup_fabric_scopes(self):
        """Setup Fabric API scopes for user authentication."""
        self.fabric_scopes = [
            "https://api.fabric.microsoft.com/Workspace.Read.All",
            "https://api.fabric.microsoft.com/Item.Read.All",
            "https://graph.microsoft.com/User.Read",
            "https://graph.microsoft.com/Group.Read.All",
            "openid",
            "profile",
            "email"
        ]
    
    async def authenticate_user(self, access_token: str) -> Optional[FabricUser]:
        """Authenticate a user using their access token."""
        try:
            # Decode the JWT token to get user info
            user_info = self._decode_token(access_token)
            if not user_info:
                return None
            
            # Get additional user details from Microsoft Graph
            user_details = await self._get_user_details_from_graph(access_token)
            if not user_details:
                return None
            
            # Determine user roles based on groups and permissions
            roles = self._determine_user_roles(user_details)
            
            # Create FabricUser object
            fabric_user = FabricUser(
                user_id=user_info.get("oid", user_info.get("sub")),
                email=user_info.get("email", user_info.get("preferred_username")),
                name=user_info.get("name", user_details.get("displayName", "")),
                tenant_id=user_info.get("tid"),
                roles=roles,
                groups=user_details.get("memberOf", []),
                permissions=self._get_user_permissions(user_details),
                last_login=datetime.now(),
                token_expires=datetime.fromtimestamp(user_info.get("exp", 0))
            )
            
            # Cache the user
            self.token_cache[access_token] = fabric_user
            
            return fabric_user
            
        except Exception as e:
            print(f"Authentication error: {e}")
            return None
    
    def _decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode JWT token to extract user information."""
        try:
            # Decode without verification for now (in production, verify signature)
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
    
    def _determine_user_roles(self, user_details: Dict[str, Any]) -> List[UserRole]:
        """Determine user roles based on groups and permissions."""
        roles = []
        groups = user_details.get("memberOf", [])
        
        # Map groups to roles (customize based on your organization)
        group_role_mapping = {
            "Fabric Admins": UserRole.ADMIN,
            "Fabric Managers": UserRole.MANAGER,
            "Fabric Analysts": UserRole.ANALYST,
            "Fabric Viewers": UserRole.VIEWER,
            "Power BI Admins": UserRole.ADMIN,
            "Power BI Contributors": UserRole.MANAGER,
            "Power BI Viewers": UserRole.VIEWER
        }
        
        for group in groups:
            if group in group_role_mapping:
                roles.append(group_role_mapping[group])
        
        # Default role if no specific groups found
        if not roles:
            roles.append(UserRole.VIEWER)
        
        return roles
    
    def _get_user_permissions(self, user_details: Dict[str, Any]) -> Dict[str, Any]:
        """Get user permissions based on roles and groups."""
        roles = self._determine_user_roles(user_details)
        
        permissions = {
            "can_read_all_workspaces": UserRole.ADMIN in roles,
            "can_write_workspaces": UserRole.ADMIN in roles or UserRole.MANAGER in roles,
            "can_execute_sql": UserRole.ADMIN in roles or UserRole.MANAGER in roles or UserRole.ANALYST in roles,
            "can_view_sensitive_data": UserRole.ADMIN in roles or UserRole.MANAGER in roles,
            "can_manage_users": UserRole.ADMIN in roles,
            "workspace_access": "all" if UserRole.ADMIN in roles else "limited",
            "data_access_level": "full" if UserRole.ADMIN in roles else "filtered"
        }
        
        return permissions
    
    def get_user_from_token(self, access_token: str) -> Optional[FabricUser]:
        """Get cached user from access token."""
        return self.token_cache.get(access_token)
    
    def is_token_valid(self, access_token: str) -> bool:
        """Check if the access token is still valid."""
        user = self.token_cache.get(access_token)
        if not user:
            return False
        
        return datetime.now() < user.token_expires
    
    async def refresh_user_token(self, access_token: str) -> Optional[str]:
        """Refresh user's access token."""
        try:
            # Use the existing broker to get a new token
            new_token = broker.token(self.fabric_scopes)
            return new_token
        except Exception as e:
            print(f"Token refresh error: {e}")
            return None

class RLSContext:
    """Context for Row Level Security in Fabric databases."""
    
    def __init__(self, user: FabricUser):
        self.user = user
        self.rls_policies = self._get_rls_policies()
    
    def _get_rls_policies(self) -> Dict[str, str]:
        """Get RLS policies based on user role."""
        policies = {}
        
        if UserRole.ADMIN in self.user.roles:
            # Admins see everything
            policies["sales_data"] = "1=1"  # No filter
            policies["customer_data"] = "1=1"
            policies["financial_data"] = "1=1"
        elif UserRole.MANAGER in self.user.roles:
            # Managers see department and region data
            policies["sales_data"] = f"department IN (SELECT department FROM user_departments WHERE user_id = '{self.user.user_id}')"
            policies["customer_data"] = f"region IN (SELECT region FROM user_regions WHERE user_id = '{self.user.user_id}')"
            policies["financial_data"] = f"department IN (SELECT department FROM user_departments WHERE user_id = '{self.user.user_id}')"
        elif UserRole.ANALYST in self.user.roles:
            # Analysts see region data only
            policies["sales_data"] = f"region IN (SELECT region FROM user_regions WHERE user_id = '{self.user.user_id}')"
            policies["customer_data"] = f"region IN (SELECT region FROM user_regions WHERE user_id = '{self.user.user_id}')"
            policies["financial_data"] = "data_type = 'aggregated'"  # Only aggregated data
        else:  # VIEWER
            # Viewers see only their own data
            policies["sales_data"] = f"user_id = '{self.user.user_id}'"
            policies["customer_data"] = "1=0"  # No access
            policies["financial_data"] = "1=0"  # No access
        
        return policies
    
    def apply_rls_to_query(self, query: str) -> str:
        """
        Apply RLS policies to a SQL query.
        Note: In Fabric, RLS is enforced at the database level using USER_NAME().
        This method is for demonstration purposes only.
        """
        # In real Fabric RLS, the database engine automatically applies security policies
        # based on the USER_NAME() function from the authenticated token
        
        # For demo purposes, we'll add comments showing what RLS would do
        rls_comment = f"-- RLS Applied for user: {self.user.email} (USER_NAME() = '{self.user.email}')\n"
        
        for table_name, policy in self.rls_policies.items():
            if table_name in query.lower():
                rls_comment += f"-- Security Policy: {policy}\n"
        
        return rls_comment + query
    
    def get_rls_status(self) -> Dict[str, Any]:
        """Get RLS status for the current user."""
        return {
            "user_id": self.user.user_id,
            "user_email": self.user.email,
            "user_name": self.user.name,
            "roles": [role.value for role in self.user.roles],
            "rls_enabled": True,
            "policies_applied": len(self.rls_policies),
            "accessible_tables": list(self.rls_policies.keys()),
            "permissions": self.user.permissions
        }

# Global auth service instance
auth_service = FabricAuthService()

def get_current_user(access_token: str) -> Optional[FabricUser]:
    """Get current authenticated user."""
    return auth_service.get_user_from_token(access_token)

def create_rls_context(user: FabricUser) -> RLSContext:
    """Create RLS context for a user."""
    return RLSContext(user)
