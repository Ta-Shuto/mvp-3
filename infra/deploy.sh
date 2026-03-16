#!/bin/bash
set -euo pipefail

# ============================================
# Interview Support Platform - Deploy Script
# ============================================
#
# Usage:
#   ./infra/deploy.sh [environment]
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Docker installed
#   - jq installed
#
# Environment variables (set in .env.production):
#   DB_PASSWORD, NEXTAUTH_SECRET, ANTHROPIC_API_KEY
# ============================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

ENV="${1:-production}"
REGION="${AWS_REGION:-ap-northeast-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
STACK_NAME="${ENV}-interview-support"

echo "=== Deploying Interview Support Platform ==="
echo "Environment: ${ENV}"
echo "Region: ${REGION}"
echo "Account: ${ACCOUNT_ID}"
echo ""

# ---- Step 1: Load environment variables ----
if [ -f ".env.production" ]; then
  _tmpenv=$(mktemp)
  tr -d '\r' < .env.production > "$_tmpenv"
  set +u
  set -a
  source "$_tmpenv"
  set +a
  set -u
  rm -f "$_tmpenv"
else
  echo "ERROR: .env.production not found."
  echo "Create it with: DB_PASSWORD, NEXTAUTH_SECRET, ANTHROPIC_API_KEY"
  exit 1
fi

# ---- Step 2: Deploy CloudFormation stack ----
echo ">> Deploying infrastructure..."
aws cloudformation deploy \
  --template-file infra/cloudformation.yml \
  --stack-name "${STACK_NAME}" \
  --capabilities CAPABILITY_IAM \
  --region "${REGION}" \
  --parameter-overrides \
    Environment="${ENV}" \
    DBPassword="${DB_PASSWORD}" \
    NextAuthSecret="${NEXTAUTH_SECRET}" \
    AnthropicApiKey="${ANTHROPIC_API_KEY}" \
    RecallApiKey="${RECALL_API_KEY:-}" \
  --no-fail-on-empty-changeset

# ---- Step 3: Get stack outputs ----
echo ">> Getting stack outputs..."
ECR_WEB_REPO=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='ECRWebRepo'].OutputValue" \
  --output text --region "${REGION}")

ECR_WS_REPO=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='ECRWSRepo'].OutputValue" \
  --output text --region "${REGION}")

ALB_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='ALBURL'].OutputValue" \
  --output text --region "${REGION}")

# ---- Step 4: Login to ECR ----
echo ">> Logging in to ECR..."
aws ecr get-login-password --region "${REGION}" | \
  docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# ---- Step 5: Build & push Next.js image ----
echo ">> Building Next.js image..."
docker build -t interview-support-web -f Dockerfile .
docker tag interview-support-web:latest "${ECR_WEB_REPO}:latest"
docker push "${ECR_WEB_REPO}:latest"

# ---- Step 6: Build & push WebSocket server image ----
echo ">> Building WebSocket server image..."
docker build -t interview-support-ws -f ws-server/Dockerfile .
docker tag interview-support-ws:latest "${ECR_WS_REPO}:latest"
docker push "${ECR_WS_REPO}:latest"

# ---- Step 7: Run database migration ----
echo ">> Running database migration..."
DB_ENDPOINT=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseEndpoint'].OutputValue" \
  --output text --region "${REGION}")

# Run migration as a one-off ECS task
CLUSTER_NAME="${ENV}-interview-support"
TASK_DEF="${ENV}-interview-support-web"

aws ecs run-task \
  --cluster "${CLUSTER_NAME}" \
  --task-definition "${TASK_DEF}" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$(aws cloudformation describe-stack-resources \
    --stack-name "${STACK_NAME}" \
    --query "StackResources[?LogicalResourceId=='PrivateSubnet1'].PhysicalResourceId" \
    --output text --region "${REGION}")],securityGroups=[$(aws cloudformation describe-stack-resources \
    --stack-name "${STACK_NAME}" \
    --query "StackResources[?LogicalResourceId=='AppSecurityGroup'].PhysicalResourceId" \
    --output text --region "${REGION}")]}" \
  --overrides '{
    "containerOverrides": [{
      "name": "web",
      "command": ["npx", "prisma", "migrate", "deploy"]
    }]
  }' \
  --region "${REGION}"

echo ">> Waiting for migration to complete..."
sleep 30

# ---- Step 8: Start ECS services (set desired count to 1) ----
echo ">> Starting ECS services..."
aws ecs update-service \
  --cluster "${CLUSTER_NAME}" \
  --service "${ENV}-web" \
  --desired-count 1 \
  --force-new-deployment \
  --region "${REGION}" > /dev/null

aws ecs update-service \
  --cluster "${CLUSTER_NAME}" \
  --service "${ENV}-ws" \
  --desired-count 1 \
  --force-new-deployment \
  --region "${REGION}" > /dev/null

echo ""
echo "=== Deployment Complete ==="
echo "URL: ${ALB_URL}"
echo ""
echo "Next steps:"
echo "  1. Wait 2-3 minutes for services to stabilize"
echo "  2. Run seed data: adjust deploy.sh to run db:seed task"
echo "  3. Set up HTTPS: add ACM certificate + update listener"
echo "  4. Set up custom domain: add Route53 record -> ALB"
