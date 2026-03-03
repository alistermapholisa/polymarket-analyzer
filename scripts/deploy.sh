#!/bin/bash

###############################################################################
# Polymarket Analyzer - AWS Deployment Script
# 
# This script automates the deployment of the Polymarket Analyzer to AWS
# Usage: ./scripts/deploy.sh [environment] [action]
# Example: ./scripts/deploy.sh production deploy
###############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
ACTION=${2:-deploy}
PROJECT_NAME="polymarket-analyzer"
AWS_REGION="${AWS_REGION:-us-east-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t2.micro}"

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed"
        exit 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed"
        exit 1
    fi
    
    # Check pnpm
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm is not installed"
        exit 1
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Build application
build_app() {
    log_info "Building application..."
    
    pnpm install
    pnpm run build
    
    log_success "Application built successfully"
}

# Create security group
create_security_group() {
    log_info "Creating security group..."
    
    SG_NAME="${PROJECT_NAME}-sg-${ENVIRONMENT}"
    
    # Check if security group exists
    SG_ID=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=${SG_NAME}" \
        --query 'SecurityGroups[0].GroupId' \
        --output text \
        --region $AWS_REGION 2>/dev/null || echo "")
    
    if [ "$SG_ID" != "" ] && [ "$SG_ID" != "None" ]; then
        log_warning "Security group already exists: $SG_ID"
        return
    fi
    
    # Create security group
    SG_ID=$(aws ec2 create-security-group \
        --group-name $SG_NAME \
        --description "Security group for $PROJECT_NAME" \
        --region $AWS_REGION \
        --query 'GroupId' \
        --output text)
    
    log_info "Security group created: $SG_ID"
    
    # Add ingress rules
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 80 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION
    
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 443 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION
    
    aws ec2 authorize-security-group-ingress \
        --group-id $SG_ID \
        --protocol tcp \
        --port 22 \
        --cidr 0.0.0.0/0 \
        --region $AWS_REGION
    
    log_success "Security group configured"
}

# Launch EC2 instance
launch_ec2() {
    log_info "Launching EC2 instance..."
    
    # Get latest Ubuntu 22.04 LTS AMI
    AMI_ID=$(aws ec2 describe-images \
        --owners 099720109477 \
        --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*" \
        --query 'sort_by(Images, &CreationDate)[-1].ImageId' \
        --output text \
        --region $AWS_REGION)
    
    log_info "Using AMI: $AMI_ID"
    
    # Get security group ID
    SG_NAME="${PROJECT_NAME}-sg-${ENVIRONMENT}"
    SG_ID=$(aws ec2 describe-security-groups \
        --filters "Name=group-name,Values=${SG_NAME}" \
        --query 'SecurityGroups[0].GroupId' \
        --output text \
        --region $AWS_REGION)
    
    # Launch instance
    INSTANCE_ID=$(aws ec2 run-instances \
        --image-id $AMI_ID \
        --instance-type $INSTANCE_TYPE \
        --security-group-ids $SG_ID \
        --monitoring Enabled=true \
        --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=${PROJECT_NAME}-${ENVIRONMENT}},{Key=Environment,Value=${ENVIRONMENT}}]" \
        --query 'Instances[0].InstanceId' \
        --output text \
        --region $AWS_REGION)
    
    log_success "EC2 instance launched: $INSTANCE_ID"
    
    # Wait for instance to be running
    log_info "Waiting for instance to be running..."
    aws ec2 wait instance-running \
        --instance-ids $INSTANCE_ID \
        --region $AWS_REGION
    
    # Get public IP
    PUBLIC_IP=$(aws ec2 describe-instances \
        --instance-ids $INSTANCE_ID \
        --query 'Reservations[0].Instances[0].PublicIpAddress' \
        --output text \
        --region $AWS_REGION)
    
    log_success "Instance is running at: $PUBLIC_IP"
    
    # Save instance info
    echo "INSTANCE_ID=$INSTANCE_ID" > .env.instance
    echo "PUBLIC_IP=$PUBLIC_IP" >> .env.instance
    
    log_info "Instance information saved to .env.instance"
}

# Configure EC2 instance
configure_ec2() {
    log_info "Configuring EC2 instance..."
    
    # Get instance IP from .env.instance
    if [ ! -f .env.instance ]; then
        log_error ".env.instance file not found"
        exit 1
    fi
    
    source .env.instance
    
    log_info "Connecting to instance at $PUBLIC_IP..."
    
    # Wait for SSH to be available
    sleep 30
    
    # SSH and configure
    ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_rsa ubuntu@$PUBLIC_IP << 'EOF'
        # Update system
        sudo apt update && sudo apt upgrade -y
        
        # Install Node.js
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt install -y nodejs
        
        # Install pnpm
        npm install -g pnpm
        
        # Install Git
        sudo apt install -y git
        
        # Install PM2
        sudo npm install -g pm2
        
        # Clone repository
        git clone https://github.com/yourusername/polymarket-analyzer.git
        cd polymarket-analyzer
        
        # Install dependencies
        pnpm install
        
        # Build application
        pnpm build
        
        # Start with PM2
        pm2 start dist/index.js --name polymarket-analyzer
        pm2 startup
        pm2 save
EOF
    
    log_success "EC2 instance configured"
}

# Deploy application
deploy_app() {
    log_info "Deploying application..."
    
    # Get instance IP from .env.instance
    if [ ! -f .env.instance ]; then
        log_error ".env.instance file not found"
        exit 1
    fi
    
    source .env.instance
    
    # Build locally
    build_app
    
    # Deploy via SSH
    ssh -i ~/.ssh/id_rsa ubuntu@$PUBLIC_IP << EOF
        cd polymarket-analyzer
        git pull origin main
        pnpm install
        pnpm build
        pm2 restart polymarket-analyzer
        pm2 save
EOF
    
    log_success "Application deployed successfully"
}

# Health check
health_check() {
    log_info "Running health checks..."
    
    # Get instance IP from .env.instance
    if [ ! -f .env.instance ]; then
        log_error ".env.instance file not found"
        exit 1
    fi
    
    source .env.instance
    
    # Check application
    if curl -s http://$PUBLIC_IP:3000/health > /dev/null; then
        log_success "Application is healthy"
    else
        log_warning "Application health check failed"
    fi
    
    # Check SSH
    if ssh -o ConnectTimeout=5 -i ~/.ssh/id_rsa ubuntu@$PUBLIC_IP "echo OK" > /dev/null 2>&1; then
        log_success "SSH connection is working"
    else
        log_warning "SSH connection failed"
    fi
}

# Cleanup resources
cleanup() {
    log_info "Cleaning up resources..."
    
    if [ ! -f .env.instance ]; then
        log_error ".env.instance file not found"
        exit 1
    fi
    
    source .env.instance
    
    # Terminate instance
    aws ec2 terminate-instances \
        --instance-ids $INSTANCE_ID \
        --region $AWS_REGION
    
    log_success "Instance termination initiated"
    
    # Remove instance file
    rm .env.instance
}

# Show usage
show_usage() {
    cat << EOF
Usage: ./scripts/deploy.sh [environment] [action]

Environments:
  development   - Development environment (default)
  production    - Production environment

Actions:
  check         - Check prerequisites
  build         - Build application
  create-sg     - Create security group
  launch        - Launch EC2 instance
  configure     - Configure EC2 instance
  deploy        - Deploy application
  health        - Run health checks
  cleanup       - Cleanup resources
  help          - Show this help message

Examples:
  ./scripts/deploy.sh development check
  ./scripts/deploy.sh production deploy
  ./scripts/deploy.sh development health
EOF
}

# Main execution
main() {
    case $ACTION in
        check)
            check_prerequisites
            ;;
        build)
            build_app
            ;;
        create-sg)
            create_security_group
            ;;
        launch)
            create_security_group
            launch_ec2
            ;;
        configure)
            configure_ec2
            ;;
        deploy)
            check_prerequisites
            build_app
            create_security_group
            launch_ec2
            configure_ec2
            deploy_app
            health_check
            ;;
        health)
            health_check
            ;;
        cleanup)
            cleanup
            ;;
        help)
            show_usage
            ;;
        *)
            log_error "Unknown action: $ACTION"
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main
