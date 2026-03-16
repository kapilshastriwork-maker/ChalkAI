#!/bin/bash
PROJECT_ID="chalkai-app-2026"
REGION="us-central1"
SERVICE_NAME="chalkai-backend"

echo "Building and deploying ChalkAI backend to Cloud Run..."

cd backend

gcloud run deploy $SERVICE_NAME \
  --source . \
  --project $PROJECT_ID \
  --region $REGION \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY \
  --memory 512Mi \
  --timeout 300

echo "Deployment complete!"
