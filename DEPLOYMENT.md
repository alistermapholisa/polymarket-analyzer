# Polymarket Analyzer - AWS Free Tier Deployment Guide

This guide provides step-by-step instructions for deploying the Polymarket Analyzer to AWS using the Free Tier, optimized for minimal costs and maximum performance.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [AWS Account Setup](#aws-account-setup)
3. [Infrastructure Overview](#infrastructure-overview)
4. [Deployment Steps](#deployment-steps)
5. [Cost Optimization](#cost-optimization)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- **AWS Account**: Create a free account at [aws.amazon.com](https://aws.amazon.com)
- **AWS CLI**: Install from [aws.amazon.com/cli](https://aws.amazon.com/cli)
- **Node.js 18+**: Download from [nodejs.org](https://nodejs.org)
- **Git**: Install from [git-scm.com](https://git-scm.com)
- **GitHub Account**: For CI/CD and version control
- **Domain (Optional)**: For custom domain setup

### AWS CLI Configuration

```bash
# Configure AWS credentials
aws configure

# You'll be prompted for:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region (us-east-1 recommended for Free Tier)
# - Default output format (json)
```

---

## AWS Account Setup

### 1. Enable Free Tier Services

Log in to your AWS Console and ensure these services are enabled:

- **EC2**: t2.micro instance (1 GB RAM, 1 vCPU)
- **RDS**: MySQL 8.0 (db.t2.micro, 20 GB storage)
- **S3**: Standard storage (5 GB)
- **DynamoDB**: On-demand pricing (recommended)
- **CloudWatch**: Free tier logs (5 GB/month)
- **Lambda**: 1 million free requests/month

### 2. Create IAM User for Deployment

```bash
# Create a new IAM user with programmatic access
aws iam create-user --user-name polymarket-deployer

# Attach policies
aws iam attach-user-policy --user-name polymarket-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2FullAccess
aws iam attach-user-policy --user-name polymarket-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonRDSFullAccess
aws iam attach-user-policy --user-name polymarket-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
aws iam attach-user-policy --user-name polymarket-deployer \
  --policy-arn arn:aws:iam::aws:policy/DynamoDBFullAccess
aws iam attach-user-policy --user-name polymarket-deployer \
  --policy-arn arn:aws:iam::aws:policy/CloudWatchFullAccess

# Create access keys
aws iam create-access-key --user-name polymarket-deployer
```

Save the Access Key ID and Secret Access Key securely.

### 3. Create S3 Bucket for Deployment

```bash
# Create bucket (replace with unique name)
aws s3 mb s3://polymarket-analyzer-deployment-$(date +%s)

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket polymarket-analyzer-deployment-$(date +%s) \
  --versioning-configuration Status=Enabled
```

---

## Infrastructure Overview

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Internet Users                          │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ Route53  │ (DNS)
                    └────┬────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼──┐      ┌──────▼──────┐   ┌────▼────┐
    │ ALB  │      │  CloudFront │   │ S3 CDN  │
    └───┬──┘      └──────┬──────┘   └────┬────┘
        │                │               │
        │         ┌──────▼──────┐        │
        └────────►│ EC2 t2.micro├────────┘
                  │ (Node.js)   │
                  └──────┬──────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
    ┌───▼──┐      ┌──────▼──────┐   ┌────▼────┐
    │ RDS  │      │ DynamoDB    │   │CloudWatch│
    │MySQL │      │ (Metrics)   │   │(Logs)    │
    └──────┘      └─────────────┘   └──────────┘
```

### Free Tier Limits

| Service | Free Tier Limit | Monthly Cost (if exceeded) |
|---------|-----------------|---------------------------|
| EC2 t2.micro | 750 hours/month | $0.0116/hour |
| RDS db.t2.micro | 750 hours/month | $0.017/hour |
| S3 | 5 GB storage | $0.023/GB |
| DynamoDB | 25 GB storage, 1 GB/month | $1.25/GB (write), $0.25/GB (read) |
| Data Transfer | 1 GB/month outbound | $0.09/GB |
| Lambda | 1 million requests/month | $0.20/million requests |

---

## Deployment Steps

### Step 1: Prepare Application

```bash
# Clone repository
git clone https://github.com/yourusername/polymarket-analyzer.git
cd polymarket-analyzer

# Install dependencies
pnpm install

# Build application
pnpm build

# Run tests
pnpm test
```

### Step 2: Create EC2 Instance

```bash
# Create security group
aws ec2 create-security-group \
  --group-name polymarket-analyzer-sg \
  --description "Security group for Polymarket Analyzer"

# Get security group ID
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=polymarket-analyzer-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)

# Allow HTTP/HTTPS/SSH
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID --protocol tcp --port 22 --cidr YOUR_IP/32

# Launch t2.micro instance (Ubuntu 22.04 LTS)
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t2.micro \
  --key-name your-key-pair \
  --security-group-ids $SG_ID \
  --monitoring Enabled=true \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=polymarket-analyzer}]'
```

### Step 3: Configure EC2 Instance

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@your-instance-ip

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
npm install -g pnpm

# Install Git
sudo apt install -y git

# Clone repository
git clone https://github.com/yourusername/polymarket-analyzer.git
cd polymarket-analyzer

# Install dependencies
pnpm install

# Create .env file with AWS credentials
cat > .env << EOF
DATABASE_URL=mysql://user:password@rds-endpoint:3306/polymarket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-s3-bucket
NODE_ENV=production
PORT=3000
EOF

# Build application
pnpm build

# Start application with PM2
sudo npm install -g pm2
pm2 start dist/index.js --name polymarket-analyzer
pm2 startup
pm2 save
```

### Step 4: Set Up RDS MySQL Database

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier polymarket-analyzer-db \
  --db-instance-class db.t2.micro \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20 \
  --storage-type gp2 \
  --publicly-accessible false \
  --multi-az false \
  --backup-retention-period 7 \
  --enable-cloudwatch-logs-exports error,general,slowquery

# Wait for instance to be available (5-10 minutes)
aws rds describe-db-instances \
  --db-instance-identifier polymarket-analyzer-db \
  --query 'DBInstances[0].DBInstanceStatus'

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier polymarket-analyzer-db \
  --query 'DBInstances[0].Endpoint.Address'

# Connect and initialize database
mysql -h your-rds-endpoint -u admin -p << EOF
CREATE DATABASE polymarket;
USE polymarket;
-- Run migration scripts from drizzle/migrations/
SOURCE drizzle/0001_unusual_gladiator.sql;
EOF
```

### Step 5: Configure S3 Bucket

```bash
# Create bucket
aws s3 mb s3://polymarket-analyzer-data-$(date +%s)

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket polymarket-analyzer-data-$(date +%s) \
  --versioning-configuration Status=Enabled

# Set lifecycle policy for cost optimization
aws s3api put-bucket-lifecycle-configuration \
  --bucket polymarket-analyzer-data-$(date +%s) \
  --lifecycle-configuration file://s3-lifecycle.json

# Block public access
aws s3api put-public-access-block \
  --bucket polymarket-analyzer-data-$(date +%s) \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Step 6: Set Up CloudWatch Monitoring

```bash
# Create CloudWatch alarms
aws cloudwatch put-metric-alarm \
  --alarm-name polymarket-high-cpu \
  --alarm-description "Alert when CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

aws cloudwatch put-metric-alarm \
  --alarm-name polymarket-high-memory \
  --alarm-description "Alert when memory exceeds 80%" \
  --metric-name MemoryUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2

# Create SNS topic for notifications
aws sns create-topic --name polymarket-alerts
```

### Step 7: Set Up Domain (Optional)

```bash
# Register domain (or use existing)
# In Route53, create hosted zone for your domain

# Create A record pointing to EC2 instance
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch file://route53-change.json

# Set up SSL certificate with ACM
aws acm request-certificate \
  --domain-name yourdomain.com \
  --validation-method DNS
```

### Step 8: Configure Nginx Reverse Proxy

```bash
# Install Nginx
sudo apt install -y nginx

# Create Nginx config
sudo tee /etc/nginx/sites-available/polymarket << EOF
upstream polymarket {
    server localhost:3000;
}

server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP to HTTPS
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;

    location / {
        proxy_pass http://polymarket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/polymarket /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

# Install Let's Encrypt SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot certonly --nginx -d yourdomain.com
```

---

## Cost Optimization

### 1. Minimize Data Transfer

- Use CloudFront CDN for static assets
- Compress responses with gzip
- Implement pagination for API responses
- Archive old data to S3 Glacier

### 2. Database Optimization

- Use RDS read replicas only if needed
- Enable automated backups (7 days)
- Use connection pooling
- Monitor slow queries

### 3. Compute Optimization

- Use t2.micro for development/low traffic
- Implement auto-scaling for production
- Schedule batch jobs during off-peak hours
- Use Lambda for scheduled tasks

### 4. Storage Optimization

- Set S3 lifecycle policies (transition to Glacier after 30 days)
- Use S3 Intelligent-Tiering
- Enable S3 versioning only for critical data
- Archive logs to S3 Glacier

### 5. Monitoring & Alerts

```bash
# Set up cost anomaly detection
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "polymarket-cost-monitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }'

# Set up budget alert
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

---

## Monitoring & Maintenance

### CloudWatch Dashboards

```bash
# Create custom dashboard
aws cloudwatch put-dashboard \
  --dashboard-name polymarket-analyzer \
  --dashboard-body file://dashboard.json
```

### Log Monitoring

```bash
# View application logs
aws logs tail /aws/ec2/polymarket-analyzer --follow

# Create log group
aws logs create-log-group --log-group-name /polymarket/app

# Set retention
aws logs put-retention-policy \
  --log-group-name /polymarket/app \
  --retention-in-days 7
```

### Automated Backups

```bash
# Enable RDS automated backups
aws rds modify-db-instance \
  --db-instance-identifier polymarket-analyzer-db \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --apply-immediately

# Create S3 backup script
cat > /home/ubuntu/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
mkdir -p $BACKUP_DIR
mysqldump -h $RDS_ENDPOINT -u admin -p$DB_PASSWORD polymarket > $BACKUP_DIR/polymarket-$(date +%Y%m%d).sql
aws s3 cp $BACKUP_DIR/polymarket-$(date +%Y%m%d).sql s3://polymarket-backups/
find $BACKUP_DIR -mtime +7 -delete
EOF

chmod +x /home/ubuntu/backup.sh

# Schedule with cron
crontab -e
# Add: 0 4 * * * /home/ubuntu/backup.sh
```

---

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
pm2 logs polymarket-analyzer

# Check Node.js version
node --version

# Check port availability
sudo lsof -i :3000

# Restart application
pm2 restart polymarket-analyzer
```

#### 2. Database Connection Issues

```bash
# Test connection
mysql -h your-rds-endpoint -u admin -p

# Check security group
aws ec2 describe-security-groups --group-ids $SG_ID

# Check RDS status
aws rds describe-db-instances --db-instance-identifier polymarket-analyzer-db
```

#### 3. High CPU/Memory Usage

```bash
# Monitor processes
top

# Check Node.js memory
node --max-old-space-size=256 dist/index.js

# Enable garbage collection logging
NODE_OPTIONS="--trace-gc" pm2 start dist/index.js
```

#### 4. S3 Access Issues

```bash
# Test S3 access
aws s3 ls s3://your-bucket

# Check IAM permissions
aws iam get-user-policy --user-name polymarket-deployer --policy-name S3Access

# Check bucket policy
aws s3api get-bucket-policy --bucket your-bucket
```

### Health Check

```bash
#!/bin/bash
# health-check.sh

echo "Checking application health..."

# Check EC2 instance
aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].State.Name'

# Check RDS database
aws rds describe-db-instances --db-instance-identifier polymarket-analyzer-db \
  --query 'DBInstances[0].DBInstanceStatus'

# Check application endpoint
curl -s http://localhost:3000/health || echo "Application not responding"

# Check disk space
df -h /

# Check memory usage
free -h
```

---

## Scaling for Production

### When to Scale Up

- CPU consistently > 70%
- Memory usage > 80%
- Response time > 1 second
- Database connections at limit

### Scaling Options

1. **Vertical Scaling**: Upgrade to t2.small/medium
2. **Horizontal Scaling**: Use Auto Scaling Groups with ALB
3. **Database Scaling**: Read replicas for read-heavy workloads
4. **Caching**: Add ElastiCache (Redis) for session/data caching

### Auto Scaling Configuration

```bash
# Create launch template
aws ec2 create-launch-template \
  --launch-template-name polymarket-analyzer \
  --version-description "Production template" \
  --launch-template-data file://launch-template.json

# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name polymarket-analyzer-asg \
  --launch-template LaunchTemplateName=polymarket-analyzer,Version=\$Latest \
  --min-size 1 \
  --max-size 3 \
  --desired-capacity 2 \
  --availability-zones us-east-1a us-east-1b
```

---

## Support & Resources

- **AWS Documentation**: https://docs.aws.amazon.com
- **AWS Free Tier**: https://aws.amazon.com/free
- **AWS Support**: https://console.aws.amazon.com/support
- **Project Repository**: https://github.com/yourusername/polymarket-analyzer
- **Issues & Discussions**: GitHub Issues

---

## Checklist

- [ ] AWS account created and configured
- [ ] IAM user created with appropriate permissions
- [ ] EC2 instance launched and configured
- [ ] RDS database created and initialized
- [ ] S3 bucket created with lifecycle policies
- [ ] Application deployed and running
- [ ] Domain configured (if applicable)
- [ ] SSL certificate installed
- [ ] CloudWatch monitoring enabled
- [ ] Backups configured
- [ ] Health checks passing
- [ ] Cost monitoring enabled
- [ ] Documentation updated
- [ ] Team notified of deployment

---

**Last Updated**: March 3, 2026
**Maintainer**: Your Name
**Status**: Production Ready
