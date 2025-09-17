# Azure Deployment Guide

## Environment Variables Required

### Backend Environment Variables
Add these to your Azure App Service Configuration:

```
TENANT_ID=your-tenant-id
CLIENT_ID=your-client-id
FABRIC_BASE=https://api.fabric.microsoft.com/v1/
PBI_BASE=https://api.powerbi.com/v1.0/myorg/
AZURE_OPENAI_API_KEY=your-openai-key
AZURE_OPENAI_ENDPOINT_BASE=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_VERSION=2024-08-01-preview
AZURE_OPENAI_DEPLOYMENT=gpt-4.1
BACKEND_BASE=https://ded-poc-backend.azurewebsites.net
ALLOWED_ORIGINS=https://ded-poc-frontend.azurewebsites.net
```

### Frontend Environment Variables
Add these to your Azure App Service Configuration:

```
NEXT_PUBLIC_BACKEND_BASE=https://ded-poc-backend.azurewebsites.net
```

## GitHub Secrets Required

Add these secrets to your GitHub repository:

1. `AZURE_WEBAPP_PUBLISH_PROFILE_BACKEND` - Backend publish profile
2. `AZURE_WEBAPP_PUBLISH_PROFILE_FRONTEND` - Frontend publish profile

## Deployment URLs

- Backend: https://ded-poc-backend.azurewebsites.net
- Frontend: https://ded-poc-frontend.azurewebsites.net

## Deployment Process

1. Add GitHub secrets
2. Add environment variables to Azure App Services
3. Commit and push to main branch
4. GitHub Actions will automatically deploy both apps
