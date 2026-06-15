#!/bin/bash

# Configuration
RESOURCE_GROUP="dwightsage-ml-rg"
LOCATION="centralus"
ACR_NAME="dwightsagemlacr"
CONTAINER_APP_NAME="dwightsage-label-verifier"
CONTAINER_APP_ENV="dwightsage-ml-env"
IMAGE_NAME="label-verifier"
IMAGE_TAG="v1"

# Login to Azure
echo "Logging in to Azure..."
az login --use-device-code

# Create resource group
echo "Creating resource group..."
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Azure Container Registry
echo "Creating container registry..."
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Build and push the Docker image
echo "Building Docker image..."
az acr build \
  --registry $ACR_NAME \
  --image $IMAGE_NAME:$IMAGE_TAG \
  --file Dockerfile .

# Get the ACR credentials
ACR_USERNAME=$(az acr credential show --name $ACR_NAME --query "username" -o tsv)
ACR_PASSWORD=$(az acr credential show --name $ACR_NAME --query "passwords[0].value" -o tsv)

# Create Container Apps environment
echo "Creating container app environment..."
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# *** NEW: Create secrets BEFORE creating the container app ***
# Read secrets from your .env file
echo "Loading secrets from .env file..."
export $(cat .env | grep -v '^#' | xargs)

# Create the container app with secrets inline
echo "Creating container app with secrets..."
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image $ACR_NAME.azurecr.io/$IMAGE_NAME:$IMAGE_TAG \
  --registry-server $ACR_NAME.azurecr.io \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 8000 \
  --ingress external \
  --cpu 2.0 \
  --memory 4.0Gi \
  --min-replicas 0 \
  --max-replicas 3 \
  --secrets \
    storage-connection-string="$AZURE_STORAGE_CONNECTION_STRING" \
    api-key="$API_KEY" \
  --env-vars \
    AZURE_STORAGE_CONNECTION_STRING=secretref:storage-connection-string \
    AZURE_STORAGE_CONTAINER=label-images \
    API_KEY=secretref:api-key

# Get the public URL
echo "Getting app URL..."
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" -o tsv)

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "App URL: https://$APP_URL"
echo "=========================================="
echo ""
echo "Test the endpoint:"
echo "curl -X POST https://$APP_URL/verify \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -H 'x-api-key: $API_KEY' \\"
echo "  -d '{\"data\": []}'"
