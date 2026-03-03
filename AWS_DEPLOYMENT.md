# AWS Free Tier Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Polymarket Analyzer on AWS Free Tier. The deployment uses a single t2.micro EC2 instance to minimize costs while maintaining full functionality.

## AWS Free Tier Limits & Allocation

### Monthly Allocations

| Service | Free Tier Limit | Our Usage | Status |
|---------|-----------------|-----------|--------|
| EC2 t2.micro | 750 hours/month | ~730 hours | ✓ Within limit |
| DynamoDB | 25 GB storage + 25 RCU/WCU | ~5-10 GB | ✓ Within limit |
| S3 | 5 GB storage | ~2-3 GB | ✓ Within limit |
| Lambda | 1M requests/month | Minimal | ✓ Not used |
| CloudWatch | 10 custom metrics | ~5 metrics | ✓ Within limit |
| Data Transfer | 1 GB outbound | ~100-200 MB | ✓ Within limit |

## Pre-Deployment Setup

### AWS Account Requirements

1. Create an AWS account at https://aws.amazon.com
2. Enable Free Tier benefits
3. Set up billing alerts (recommended):
   - Go to AWS Billing Dashboard
   - Set alert threshold to $5 USD
   - Receive email notifications

### Required IAM Permissions

Create an IAM user with the following policy for deployment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "dynamodb:*",
        "s3:*",
        "cloudwatch:*",
        "logs:*",
        "iam:GetRole",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}
```

## Step 1: EC2 Instance Setup

### Launch EC2 Instance

1. Go to EC2 Dashboard
2. Click "Launch Instance"
3. Select "Ubuntu Server 22.04 LTS" (Free Tier eligible)
4. Instance type: `t2.micro` (Free Tier)
5. Storage: 30 GB (Free Tier includes 30 GB)
6. Security group: Create new with rules:
   - SSH (22): Your IP
   - HTTP (80): 0.0.0.0/0
   - HTTPS (443): 0.0.0.0/0
   - Custom TCP (3000): 0.0.0.0/0 (for development)

### Connect to Instance

```bash
# Download key pair (save as polymarket-key.pem)
chmod 600 polymarket-key.pem

# SSH into instance
ssh -i polymarket-key.pem ubuntu@<your-instance-public-ip>
```

### Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

# Install pnpm
sudo npm install -g pnpm

# Install MySQL client (for DynamoDB local testing)
sudo apt install -y mysql-client

# Install Git
sudo apt install -y git

# Install PM2 for process management
sudo npm install -g pm2
```

## Step 2: DynamoDB Setup

### Create DynamoDB Tables

1. Go to DynamoDB Dashboard
2. Click "Create table"
3. Create each table with these settings:

**Markets Table**
- Table name: `polymarket-markets`
- Partition key: `marketId` (String)
- Sort key: `timestamp` (Number)
- Billing mode: On-demand

**Predictions Table**
- Table name: `polymarket-predictions`
- Partition key: `predictionId` (String)
- Sort key: `timestamp` (Number)
- Billing mode: On-demand

**Market Snapshots Table**
- Table name: `polymarket-snapshots`
- Partition key: `marketId` (String)
- Sort key: `snapshotHour` (Number)
- Billing mode: On-demand
- TTL: `expiresAt` (90 days)

**Notifications Table**
- Table name: `polymarket-notifications`
- Partition key: `userId` (String)
- Sort key: `notificationId` (String)
- Billing mode: On-demand
- TTL: `expiresAt` (30 days)

### Enable TTL for Cost Optimization

For each table with TTL:
1. Go to table settings
2. Click "TTL"
3. Enable TTL with attribute name `expiresAt`
4. Items automatically delete after expiration

## Step 3: S3 Bucket Setup

### Create S3 Bucket

1. Go to S3 Dashboard
2. Click "Create bucket"
3. Bucket name: `polymarket-analyzer-data-<your-account-id>`
4. Region: Same as EC2 instance
5. Block public access: Enable
6. Versioning: Enable (optional, for data protection)

### Configure Bucket Lifecycle

1. Go to bucket settings
2. Click "Lifecycle"
3. Add rule:
   - Prefix: `market-snapshots/`
   - Transition to Glacier after 90 days
   - Delete after 365 days

### Create IAM Role for EC2

1. Go to IAM Dashboard
2. Create role: `PolymarketAnalyzerRole`
3. Attach policies:
   - `AmazonDynamoDBFullAccess`
   - `AmazonS3FullAccess`
   - `CloudWatchLogsFullAccess`
4. Attach role to EC2 instance

## Step 4: Application Deployment

### Clone Repository

```bash
cd /home/ubuntu
git clone <your-repository-url> polymarket-analyzer
cd polymarket-analyzer
```

### Configure Environment Variables

Create `.env` file:

```bash
# Database
DATABASE_URL="mysql://user:password@rds-endpoint:3306/polymarket"

# AWS
AWS_REGION=us-east-1
AWS_S3_BUCKET=polymarket-analyzer-data-<account-id>

# Polymarket API
POLYMARKET_API_URL=https://gamma-api.polymarket.com

# Manus Forge API (for LLM)
BUILT_IN_FORGE_API_KEY=<your-key>
BUILT_IN_FORGE_API_URL=<your-url>

# Application
NODE_ENV=production
PORT=3000
```

### Build and Deploy

```bash
# Install dependencies
pnpm install

# Build application
pnpm build

# Start with PM2
pm2 start dist/index.js --name "polymarket-analyzer"
pm2 startup
pm2 save
```

### Verify Deployment

```bash
# Check application status
pm2 status

# View logs
pm2 logs polymarket-analyzer

# Test endpoint
curl http://localhost:3000/api/health
```

## Step 5: Domain & SSL Setup

### Option A: Use AWS Route 53

1. Register domain in Route 53
2. Create hosted zone
3. Add A record pointing to EC2 public IP
4. Update security group to allow port 80/443

### Option B: Use Existing Domain

1. Update domain DNS records to point to EC2 public IP
2. Wait for DNS propagation (24-48 hours)

### Enable HTTPS with Let's Encrypt

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain certificate
sudo certbot certonly --standalone -d yourdomain.com

# Configure auto-renewal
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

## Cost Tracking

### Monitor AWS Costs

1. Go to AWS Billing Dashboard
2. Set up cost anomaly detection
3. Review monthly costs:

**Typical Monthly Costs (Free Tier)**:
- EC2: $0 (750 hours included)
- DynamoDB: $0 (25 GB included)
- S3: $0 (5 GB included)
- Data Transfer: $0 (1 GB included)
- **Total: $0 USD**

**After Free Tier Expires**:
- EC2 t2.micro: ~$10/month
- DynamoDB on-demand: ~$5-10/month (depends on usage)
- S3 storage: ~$0.50/month
- Data transfer: ~$1-2/month
- **Estimated Total: $15-25/month**

### Cost Optimization Tips

1. **Use On-Demand DynamoDB**: Pay only for what you use
2. **Enable S3 Lifecycle**: Archive old data to Glacier
3. **Set CloudWatch Alarms**: Alert on unusual usage
4. **Monitor API Calls**: Optimize Polymarket API usage
5. **Use EC2 Spot Instances**: After Free Tier (70% savings)

## Monitoring & Alerts

### CloudWatch Metrics

Set up custom metrics for:
- API response times
- WebSocket connection count
- DynamoDB read/write capacity
- Prediction accuracy
- Error rates

### CloudWatch Alarms

Create alarms for:
- High error rate (> 5%)
- DynamoDB throttling
- S3 storage exceeding 4 GB
- EC2 CPU > 80%
- Application downtime

```bash
# Example: Create alarm for high error rate
aws cloudwatch put-metric-alarm \
  --alarm-name polymarket-high-errors \
  --alarm-description "Alert when error rate exceeds 5%" \
  --metric-name ErrorRate \
  --namespace PolymarketAnalyzer \
  --statistic Average \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:AlertTopic
```

## Troubleshooting

### Common Issues

**Issue**: EC2 instance running out of disk space
```bash
# Check disk usage
df -h

# Clean up old logs
sudo journalctl --vacuum=size=100M
```

**Issue**: DynamoDB throttling
```bash
# Check capacity
aws dynamodb describe-table --table-name polymarket-markets

# Increase capacity if needed
aws dynamodb update-table \
  --table-name polymarket-markets \
  --provisioned-throughput ReadCapacityUnits=100,WriteCapacityUnits=100
```

**Issue**: Application crashes
```bash
# Check PM2 logs
pm2 logs polymarket-analyzer --err

# Restart application
pm2 restart polymarket-analyzer
```

## Scaling Beyond Free Tier

### Phase 2: Growth (After Free Tier)

1. **Add RDS MySQL**: Replace local database
2. **Auto-scaling EC2**: Use load balancer
3. **CloudFront CDN**: Cache static assets
4. **Lambda Functions**: Scheduled analysis jobs

### Phase 3: Production

1. **Multi-region deployment**: High availability
2. **Advanced prediction models**: GPU instances
3. **Real-time alerting**: SNS/SQS integration
4. **API Gateway**: Rate limiting and throttling

## Security Checklist

- [ ] Enable MFA on AWS account
- [ ] Use IAM roles (not access keys)
- [ ] Enable VPC security groups
- [ ] Enable S3 encryption
- [ ] Enable DynamoDB encryption
- [ ] Use HTTPS/SSL certificates
- [ ] Enable CloudTrail logging
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Implement rate limiting

## Backup & Disaster Recovery

### DynamoDB Backups

```bash
# Enable point-in-time recovery
aws dynamodb update-continuous-backups \
  --table-name polymarket-markets \
  --point-in-time-recovery-specification PointInTimeRecoveryEnabled=true
```

### S3 Backups

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket polymarket-analyzer-data-ACCOUNT_ID \
  --versioning-configuration Status=Enabled
```

### EC2 Snapshots

1. Go to EC2 Dashboard
2. Create AMI from instance
3. Schedule weekly snapshots
4. Store snapshots in separate region

## Support & Resources

- AWS Documentation: https://docs.aws.amazon.com
- AWS Free Tier: https://aws.amazon.com/free
- Polymarket API: https://docs.polymarket.com
- Node.js Documentation: https://nodejs.org/docs
- PM2 Documentation: https://pm2.keymetrics.io

## Next Steps

1. Deploy application following this guide
2. Monitor costs and performance
3. Set up automated backups
4. Configure monitoring and alerts
5. Plan scaling strategy for growth
