# AWS Cost Optimization & Tracking Guide

## Free Tier Overview

The Polymarket Analyzer is designed to operate within AWS Free Tier limits, resulting in **$0 monthly cost** for the first 12 months.

### Free Tier Services

| Service | Free Tier Limit | Monthly Cost (if exceeded) |
|---------|-----------------|---------------------------|
| **EC2** | 750 hours/month t2.micro | $0.0116/hour |
| **RDS** | 750 hours/month db.t2.micro | $0.017/hour |
| **S3** | 5 GB storage | $0.023/GB |
| **DynamoDB** | 25 GB storage, 1 GB/month | $1.25/GB (write), $0.25/GB (read) |
| **CloudWatch** | 5 GB logs/month | $0.50/GB |
| **Data Transfer** | 1 GB/month outbound | $0.09/GB |
| **Lambda** | 1 million requests/month | $0.20/million requests |

---

## Cost Breakdown

### Monthly Costs (Free Tier)

```
EC2 t2.micro:        $0.00 (750 hours included)
RDS db.t2.micro:     $0.00 (750 hours included)
S3 Storage:          $0.00 (5 GB included)
DynamoDB:            $0.00 (25 GB included)
CloudWatch:          $0.00 (5 GB logs included)
Data Transfer:       $0.00 (1 GB included)
Lambda:              $0.00 (1M requests included)
───────────────────────────
TOTAL:               $0.00/month
```

### Monthly Costs (After Free Tier Expires)

Assuming moderate usage:

```
EC2 t2.micro:        $8.70 (730 hours × $0.0116/hour)
RDS db.t2.micro:     $12.41 (730 hours × $0.017/hour)
S3 Storage:          $0.46 (20 GB × $0.023/GB)
DynamoDB:            $0.00 (on-demand, minimal usage)
CloudWatch:          $0.00 (logs within free tier)
Data Transfer:       $0.90 (10 GB × $0.09/GB)
Lambda:              $0.00 (within free tier)
───────────────────────────
TOTAL:               $22.47/month
```

---

## Cost Optimization Strategies

### 1. Compute Optimization

#### EC2 Instance Sizing

```bash
# Monitor CPU usage
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-xxxxx \
  --start-time 2024-01-01T00:00:00Z \
  --end-time 2024-01-31T23:59:59Z \
  --period 3600 \
  --statistics Average

# If consistently < 20%, consider t2.nano
# If consistently > 70%, upgrade to t2.small
```

#### Reserved Instances (After Free Tier)

```bash
# Purchase 1-year reserved instance (saves ~30%)
aws ec2 purchase-reserved-instances-offering \
  --reserved-instances-offering-id xxxxx \
  --instance-count 1
```

#### Scheduled Shutdown

```bash
# Stop instance during off-hours
# Create Lambda function to stop/start on schedule

# Example: Stop at 6 PM, start at 8 AM
# Saves ~33% on compute costs
```

### 2. Database Optimization

#### RDS Cost Reduction

```bash
# Use db.t2.micro (smallest instance)
# Enable automated backups (7 days)
# Disable Multi-AZ (not needed for dev)

aws rds modify-db-instance \
  --db-instance-identifier polymarket-db \
  --multi-az false \
  --backup-retention-period 7 \
  --apply-immediately
```

#### Connection Pooling

```javascript
// server/db.ts - Implement connection pooling
import { createPool } from 'mysql2/promise';

const pool = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});
```

#### Query Optimization

```sql
-- Add indexes for frequently queried columns
CREATE INDEX idx_market_id ON predictions(marketId);
CREATE INDEX idx_created_at ON predictions(createdAt);
CREATE INDEX idx_user_id ON notifications(userId);

-- Use EXPLAIN to analyze queries
EXPLAIN SELECT * FROM markets WHERE polymarketId = 'xxx';
```

### 3. Storage Optimization

#### S3 Lifecycle Policies

```json
{
  "Rules": [
    {
      "Id": "ArchiveOldData",
      "Status": "Enabled",
      "Filter": { "Prefix": "market-snapshots/" },
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "STANDARD_IA"
        },
        {
          "Days": 90,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 365
      }
    }
  ]
}
```

```bash
# Apply lifecycle policy
aws s3api put-bucket-lifecycle-configuration \
  --bucket polymarket-analyzer-data \
  --lifecycle-configuration file://lifecycle.json
```

#### S3 Intelligent-Tiering

```bash
# Enable automatic cost optimization
aws s3api put-bucket-intelligent-tiering-configuration \
  --bucket polymarket-analyzer-data \
  --id AutoArchive \
  --intelligent-tiering-configuration file://tiering.json
```

### 4. Data Transfer Optimization

#### CloudFront CDN

```bash
# Create CloudFront distribution for static assets
aws cloudfront create-distribution \
  --distribution-config file://distribution.json

# Saves 50-80% on data transfer costs
```

#### Compression

```javascript
// Enable gzip compression in Express
import compression from 'compression';
app.use(compression());

// Reduces data transfer by 60-70%
```

#### Batch Operations

```javascript
// Instead of 1000 individual API calls
// Batch into 10 calls with 100 items each
const batchSize = 100;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  await processBatch(batch);
}
```

### 5. Lambda Cost Reduction

#### Scheduled Jobs

```bash
# Use Lambda instead of EC2 for scheduled tasks
# 1 million free requests/month = ~1,400 daily tasks

# Create Lambda function
aws lambda create-function \
  --function-name polymarket-analyzer-job \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT:role/lambda-role \
  --handler index.handler \
  --zip-file fileb://function.zip

# Schedule with EventBridge
aws events put-rule \
  --name polymarket-daily-job \
  --schedule-expression "cron(0 2 * * ? *)"
```

---

## Cost Monitoring

### Set Up Billing Alerts

```bash
# Enable cost anomaly detection
aws ce create-anomaly-monitor \
  --anomaly-monitor '{
    "MonitorName": "polymarket-cost-monitor",
    "MonitorType": "DIMENSIONAL",
    "MonitorDimension": "SERVICE"
  }'

# Create budget alert
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{
    "BudgetName": "polymarket-monthly",
    "BudgetLimit": {
      "Amount": "50",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "FORECASTED",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "your-email@example.com"
    }]
  }]'
```

### CloudWatch Cost Dashboard

```bash
# Create custom dashboard
aws cloudwatch put-dashboard \
  --dashboard-name polymarket-costs \
  --dashboard-body file://cost-dashboard.json
```

### Cost Analysis Queries

```bash
# Get daily costs by service
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE

# Get costs by region
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=REGION

# Get costs by tag
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=TAG,Key=Environment
```

---

## Monitoring Dashboard

### Create Cost Tracking Script

```bash
#!/bin/bash
# scripts/track-costs.sh

echo "=== AWS Cost Tracking ==="
echo ""

# Get current month costs
CURRENT_COSTS=$(aws ce get-cost-and-usage \
  --time-period Start=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --query 'ResultsByTime[0].Total.BlendedCost.Amount' \
  --output text)

echo "Current Month Cost: \$$CURRENT_COSTS"

# Get costs by service
echo ""
echo "Costs by Service:"
aws ce get-cost-and-usage \
  --time-period Start=$(date -d "$(date +%Y-%m-01)" +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --query 'ResultsByTime[0].Groups[*].[Keys[0],Metrics.BlendedCost.Amount]' \
  --output table

# Get EC2 instance status
echo ""
echo "EC2 Instance Status:"
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=polymarket-analyzer" \
  --query 'Reservations[0].Instances[0].[InstanceId,State.Name,InstanceType]' \
  --output table

# Get RDS instance status
echo ""
echo "RDS Instance Status:"
aws rds describe-db-instances \
  --db-instance-identifier polymarket-db \
  --query 'DBInstances[0].[DBInstanceIdentifier,DBInstanceStatus,DBInstanceClass]' \
  --output table
```

---

## Cost Optimization Checklist

- [ ] EC2 instance is t2.micro
- [ ] RDS instance is db.t2.micro
- [ ] Multi-AZ is disabled for RDS
- [ ] S3 lifecycle policies configured
- [ ] CloudFront CDN enabled for static assets
- [ ] Gzip compression enabled
- [ ] Connection pooling implemented
- [ ] Database indexes created
- [ ] Unused security groups deleted
- [ ] Unused Elastic IPs released
- [ ] Unused volumes deleted
- [ ] CloudWatch log retention set to 7 days
- [ ] Billing alerts configured
- [ ] Cost anomaly detection enabled
- [ ] Reserved instances considered (after free tier)

---

## Scaling Cost Estimates

### Small Scale (Current)

```
Monthly Users: 10-50
Requests/day: 1,000-5,000
Storage: < 1 GB

Cost: $0-25/month
```

### Medium Scale

```
Monthly Users: 100-500
Requests/day: 10,000-50,000
Storage: 1-10 GB

Recommended: t2.small + db.t2.small
Cost: $50-100/month
```

### Large Scale

```
Monthly Users: 1,000+
Requests/day: 100,000+
Storage: 10-100 GB

Recommended: t2.medium + db.t2.medium + RDS read replicas
Cost: $200-500/month
```

---

## Annual Cost Projection

### Year 1 (Free Tier)

```
Months 1-12:  $0/month
Annual Total: $0
```

### Year 2 (Post Free Tier)

```
Months 1-12:  $22.47/month (with optimizations)
Annual Total: $269.64
```

### Year 3+ (Optimized)

```
Months 1-12:  $15-20/month (with reserved instances)
Annual Total: $180-240
```

---

## Cost Reduction Opportunities

### Immediate (No Code Changes)

1. **Disable Multi-AZ**: Save $12/month
2. **Use Reserved Instances**: Save 30-40%
3. **Enable S3 Intelligent-Tiering**: Save 20-30%
4. **Reduce CloudWatch retention**: Save $5/month

### Short Term (1-2 weeks)

1. **Implement connection pooling**: Save 10-15%
2. **Add database indexes**: Reduce query time 50%
3. **Enable CloudFront**: Save 50-80% on data transfer
4. **Implement caching**: Reduce database load 30-40%

### Long Term (1-3 months)

1. **Migrate to Lambda**: Save 60% on compute
2. **Use DynamoDB**: Better for time-series data
3. **Implement auto-scaling**: Pay only for what you use
4. **Optimize data retention**: Archive old data

---

## Resources

- [AWS Pricing Calculator](https://calculator.aws)
- [AWS Cost Explorer](https://console.aws.amazon.com/cost-management)
- [AWS Free Tier](https://aws.amazon.com/free)
- [AWS Cost Optimization](https://aws.amazon.com/architecture/cost-optimization)

---

**Last Updated**: March 3, 2026
**Status**: Production Ready
