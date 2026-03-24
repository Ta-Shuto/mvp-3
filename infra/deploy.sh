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
#   DB_PASSWORD, NEXTAUTH_SECRET, GEMINI_API_KEY
#
# Optional SSL variables:
#   DOMAIN_NAME       - Custom domain (e.g. interview.example.com)
#   CERTIFICATE_ARN   - ACM certificate ARN
#   HOSTED_ZONE_ID    - Route 53 Hosted Zone ID
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
  echo "Create it with: DB_PASSWORD, NEXTAUTH_SECRET, GEMINI_API_KEY"
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
    GeminiApiKey="${GEMINI_API_KEY}" \
    RecallApiKey="${RECALL_API_KEY:-}" \
    DomainName="${DOMAIN_NAME:-}" \
    CertificateArn="${CERTIFICATE_ARN:-}" \
    HostedZoneId="${HOSTED_ZONE_ID:-}" \
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

# ---- Step 7.5: Run database seed ----
echo ">> Running database seed..."
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
      "command": ["npx", "tsx", "prisma/seed.ts"]
    }]
  }' \
  --region "${REGION}"

echo ">> Waiting for seed to complete..."
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
if [ -n "${DOMAIN_NAME:-}" ] && [ -n "${CERTIFICATE_ARN:-}" ]; then
  echo "SSL: HTTPS enabled at https://${DOMAIN_NAME}"
  echo "     HTTP -> HTTPS redirect active"
else
  echo "SSL: Not configured. To enable HTTPS, set these in .env.production:"
  echo "  DOMAIN_NAME=interview.example.com"
  echo "  CERTIFICATE_ARN=arn:aws:acm:ap-northeast-1:${ACCOUNT_ID}:certificate/xxxxx"
  echo "  HOSTED_ZONE_ID=Z0123456789  (optional, for auto DNS record)"
  echo ""
  echo "Then re-run this deploy script."
fi
