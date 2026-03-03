# Polymarket Analyzer - Complete Deployment Instructions

## Quick Start (5 minutes)

### Option 1: Local Development with Docker

```bash
# Clone repository
git clone https://github.com/yourusername/polymarket-analyzer.git
cd polymarket-analyzer

# Start services
docker-compose up -d

# Initialize database
docker exec polymarket-mysql mysql -u root -proot polymarket < drizzle/0001_unusual_gladiator.sql

# Access application
open http://localhost:3000
```

### Option 2: AWS Free Tier Deployment

```bash
# Make deploy script executable
chmod +x scripts/deploy.sh

# Run deployment
./scripts/deploy.sh production deploy

# Follow prompts and wait for completion (15-20 minutes)
```

---

## Prerequisites

### Required Software

- **Node.js 18+**: https://nodejs.org
- **pnpm**: `npm install -g pnpm`
- **Git**: https://git-scm.com
- **AWS CLI**: https://aws.amazon.com/cli
- **Docker** (optional): https://docker.com

### AWS Account Setup

1. Create AWS account: https://aws.amazon.com
2. Create IAM user with EC2, RDS, S3 permissions
3. Generate access keys
4. Configure AWS CLI:
   ```bash
   aws configure
   ```

### GitHub Account

1. Create GitHub account: https://github.com
2. Create new repository
3. Generate personal access token for CI/CD

---

## Deployment Methods

### Method 1: Docker Compose (Recommended for Development)

**Pros**: Fast, isolated, reproducible
**Cons**: Not suitable for production

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Clean up volumes
docker-compose down -v
```

### Method 2: Manual AWS Deployment

**Pros**: Full control, production-ready
**Cons**: More steps, manual management

#### Step 1: Create EC2 Instance

```bash
# Create security group
aws ec2 create-security-group \
  --group-name polymarket-sg \
  --description "Polymarket Analyzer security group"

# Get security group ID
SG_ID=$(aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=polymarket-sg" \
  --query 'SecurityGroups[0].GroupId' --output text)

# Add firewall rules
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID --protocol tcp --port 22 --cidr YOUR_IP/32

# Launch t2.micro instance
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t2.micro \
  --security-group-ids $SG_ID \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=polymarket-analyzer}]'
```

#### Step 2: Configure EC2 Instance

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

# Clone repository
git clone https://github.com/yourusername/polymarket-analyzer.git
cd polymarket-analyzer

# Install dependencies
pnpm install

# Create environment file
cat > .env << EOF
DATABASE_URL=mysql://user:password@rds-endpoint:3306/polymarket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
NODE_ENV=production
PORT=3000
EOF

# Build application
pnpm build

# Install PM2
sudo npm install -g pm2

# Start application
pm2 start dist/index.js --name polymarket-analyzer
pm2 startup
pm2 save
```

#### Step 3: Set Up RDS Database

```bash
# Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier polymarket-db \
  --db-instance-class db.t2.micro \
  --engine mysql \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20

# Wait for instance to be available
aws rds wait db-instance-available \
  --db-instance-identifier polymarket-db

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier polymarket-db \
  --query 'DBInstances[0].Endpoint.Address'

# Connect and initialize
mysql -h your-rds-endpoint -u admin -p << EOF
CREATE DATABASE polymarket;
USE polymarket;
-- Run migration SQL from drizzle/0001_unusual_gladiator.sql
EOF
```

#### Step 4: Set Up S3 Bucket

```bash
# Create bucket
aws s3 mb s3://polymarket-analyzer-$(date +%s)

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket polymarket-analyzer-$(date +%s) \
  --versioning-configuration Status=Enabled

# Block public access
aws s3api put-public-access-block \
  --bucket polymarket-analyzer-$(date +%s) \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Method 3: Automated Deployment Script

```bash
# Make script executable
chmod +x scripts/deploy.sh

# Deploy to production
./scripts/deploy.sh production deploy

# Check health
./scripts/deploy.sh production health

# Cleanup (if needed)
./scripts/deploy.sh production cleanup
```

### Method 4: GitHub Actions CI/CD

1. Push code to GitHub
2. Add secrets in Settings → Secrets:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `EC2_HOST`
   - `EC2_USER`
   - `EC2_SSH_KEY`

3. Workflows automatically run on push to main

---

## Environment Configuration

### Development (.env.development)

```env
NODE_ENV=development
DATABASE_URL=mysql://root:root@localhost:3306/polymarket
AWS_REGION=us-east-1
PORT=3000
DEBUG=*
```

### Production (.env.production)

```env
NODE_ENV=production
DATABASE_URL=mysql://user:password@rds-endpoint:3306/polymarket
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
S3_BUCKET_NAME=your-bucket
PORT=3000
LOG_LEVEL=info
```

---

## Verification Checklist

After deployment, verify:

- [ ] Application is running: `curl http://your-ip:3000`
- [ ] Database is connected: Check application logs
- [ ] S3 bucket is accessible: `aws s3 ls`
- [ ] CloudWatch metrics are available
- [ ] SSL certificate is valid (if using HTTPS)
- [ ] Health check endpoint responds: `curl http://your-ip:3000/health`
- [ ] Markets data is loading: Check `/markets` endpoint
- [ ] Predictions are generating: Check logs

---

## Monitoring & Maintenance

### View Logs

```bash
# Application logs
pm2 logs polymarket-analyzer

# System logs
sudo tail -f /var/log/syslog

# CloudWatch logs
aws logs tail /aws/ec2/polymarket-analyzer --follow
```

### Monitor Resources

```bash
# CPU and memory
top

# Disk usage
df -h

# Network
netstat -an | grep ESTABLISHED

# Database connections
mysql -h $RDS_ENDPOINT -u admin -p -e "SHOW PROCESSLIST;"
```

### Backup Database

```bash
# Manual backup
mysqldump -h $RDS_ENDPOINT -u admin -p polymarket > backup.sql

# Upload to S3
aws s3 cp backup.sql s3://your-bucket/backups/
```

---

## Cost Optimization

### Free Tier Limits

| Service | Limit | Monthly Cost |
|---------|-------|--------------|
| EC2 t2.micro | 750 hours | $0 |
| RDS db.t2.micro | 750 hours | $0 |
| S3 | 5 GB | $0 |
| Data transfer | 1 GB/month | $0 |

### Cost Tracking

```bash
# Get cost estimate
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost

# Set up budget alert
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget file://budget.json
```

---

## Troubleshooting

### Application Won't Start

```bash
# Check logs
pm2 logs polymarket-analyzer

# Check port
sudo lsof -i :3000

# Restart
pm2 restart polymarket-analyzer
```

### Database Connection Error

```bash
# Test connection
mysql -h $RDS_ENDPOINT -u admin -p -e "SELECT 1;"

# Check security group
aws ec2 describe-security-groups --group-ids $SG_ID

# Check RDS status
aws rds describe-db-instances --db-instance-identifier polymarket-db
```

### High Memory Usage

```bash
# Check Node.js memory
node --max-old-space-size=512 dist/index.js

# Monitor memory
watch -n 1 'free -h'
```

### S3 Access Issues

```bash
# Test S3 access
aws s3 ls s3://your-bucket

# Check IAM permissions
aws iam get-user-policy --user-name polymarket-deployer --policy-name S3Access
```

---

## Scaling for Production

### When to Scale

- CPU consistently > 70%
- Memory usage > 80%
- Response time > 1 second
- Database connections at limit

### Scaling Options

1. **Vertical**: Upgrade to t2.small/medium
2. **Horizontal**: Use Auto Scaling Groups
3. **Caching**: Add ElastiCache (Redis)
4. **CDN**: Use CloudFront for static assets

---

## Security Best Practices

1. **Use HTTPS**: Install SSL certificate with Let's Encrypt
2. **Rotate Credentials**: Change passwords every 90 days
3. **Enable MFA**: Multi-factor authentication for AWS
4. **Restrict Access**: Use security groups and IAM policies
5. **Monitor Logs**: Set up CloudWatch alarms
6. **Backup Data**: Daily automated backups
7. **Update Dependencies**: Regular security patches

---

## Support & Resources

- **AWS Documentation**: https://docs.aws.amazon.com
- **Node.js Documentation**: https://nodejs.org/docs
- **GitHub Issues**: https://github.com/yourusername/polymarket-analyzer/issues
- **AWS Support**: https://console.aws.amazon.com/support

---

## Next Steps

1. **Set up GitHub repository** with CI/CD workflows
2. **Configure custom domain** with Route53
3. **Enable SSL/TLS** with ACM certificate
4. **Set up monitoring** with CloudWatch dashboards
5. **Configure backups** with automated snapshots
6. **Document architecture** with diagrams
7. **Share portfolio** on GitHub and LinkedIn

---

**Last Updated**: March 3, 2026
**Status**: Production Ready
**Maintainer**: Your Name
