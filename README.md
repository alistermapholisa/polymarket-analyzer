# Polymarket Real-Time Analyzer & Predictor

A production-ready platform for analyzing Polymarket prediction markets in real-time, generating AI-powered predictions, and tracking accuracy metrics. Built as an AWS Cloud Practitioner portfolio project demonstrating cost-effective cloud architecture on Free Tier.

## Features

### Core Functionality
- **Real-time Market Data**: WebSocket integration with Polymarket for live price updates and orderbook streaming
- **Technical Analysis**: Momentum, volatility, and trend detection from historical price movements
- **LLM Sentiment Analysis**: AI-powered analysis of market descriptions and comments using Manus Forge API
- **Ensemble Predictions**: Combines technical and sentiment signals for robust probability predictions
- **Accuracy Tracking**: Monitors prediction performance and adjusts weights based on historical accuracy
- **Notification System**: Alerts for prediction accuracy thresholds and significant market movements

### Data Management
- **Market Snapshots**: Hourly snapshots of market state for trend analysis
- **Prediction Logs**: Complete history of all predictions with signals and outcomes
- **Long-term Storage**: S3 archival for historical data analysis
- **Cost Optimization**: TTL-based cleanup and Glacier archival for cost-effective storage

### Portfolio Features
- **AWS Free Tier Optimization**: Runs entirely on Free Tier with zero monthly costs
- **Production Deployment**: Automated CI/CD pipeline with GitHub Actions
- **Comprehensive Documentation**: Architecture diagrams, deployment guides, and cost tracking
- **Monitoring & Alerts**: CloudWatch integration for performance tracking

## Technology Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend | React 19 + Tailwind CSS | Modern, responsive, component-based UI |
| Backend | Node.js + Express + tRPC | Lightweight, event-driven, type-safe RPC |
| Database | MySQL (dev) / DynamoDB (prod) | Flexible schema, serverless, Free Tier eligible |
| Storage | S3 | Durable, scalable, cost-effective archival |
| LLM | Manus Forge API (OpenAI compatible) | Sentiment analysis and prediction insights |
| Deployment | AWS EC2 + GitHub Actions | Free Tier eligible, automated CI/CD |
| Monitoring | CloudWatch | Integrated AWS monitoring and logging |

## Quick Start

### Prerequisites
- Node.js 22+ and pnpm
- AWS account with Free Tier access
- Git for version control

### Local Development

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/polymarket-analyzer.git
cd polymarket-analyzer

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Generate database migrations
pnpm drizzle-kit generate

# Start development server
pnpm dev

# Run tests
pnpm test

# Build for production
pnpm build
```

The application will be available at `http://localhost:3000`

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                  React Frontend (3000)                   │
│  Markets List | Market Details | Predictions | Metrics  │
└────────────────────┬────────────────────────────────────┘
                     │ tRPC + WebSocket
┌────────────────────▼────────────────────────────────────┐
│              Node.js Backend (Express)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Polymarket   │  │   Market     │  │  Prediction  │   │
│  │ API Client   │  │  Analyzer    │  │  Engine      │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ Sentiment    │  │  WebSocket   │  │ Notification │   │
│  │ Analyzer     │  │  Manager     │  │  System      │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
┌───────▼──┐  ┌──────▼──┐  ┌─────▼────┐
│ DynamoDB │  │    S3   │  │CloudWatch│
│  Tables  │  │ Storage │  │ Metrics  │
└──────────┘  └─────────┘  └──────────┘
```

### Data Flow

1. **Market Fetching**: Polymarket API client fetches active markets and orderbooks
2. **WebSocket Updates**: Real-time price updates streamed via WebSocket
3. **Technical Analysis**: Market analyzer calculates indicators from snapshots
4. **Sentiment Analysis**: LLM analyzes market descriptions for sentiment
5. **Prediction Generation**: Ensemble engine combines signals for predictions
6. **Data Persistence**: Snapshots and predictions stored in DynamoDB
7. **Long-term Storage**: Old data archived to S3 for historical analysis
8. **Frontend Display**: React dashboard shows real-time data and predictions

## AWS Deployment

### Free Tier Resources

| Service | Allocation | Usage | Cost |
|---------|-----------|-------|------|
| EC2 t2.micro | 750 hours/month | ~730 hours | $0 |
| DynamoDB | 25 GB + 25 RCU/WCU | ~5-10 GB | $0 |
| S3 | 5 GB storage | ~2-3 GB | $0 |
| CloudWatch | 10 metrics | ~5 metrics | $0 |
| Data Transfer | 1 GB outbound | ~100 MB | $0 |
| **Total** | | | **$0/month** |

### Deployment Steps

1. **EC2 Setup**: Launch t2.micro Ubuntu instance
2. **DynamoDB**: Create tables with on-demand pricing
3. **S3 Bucket**: Create bucket for data archival
4. **Application**: Deploy via GitHub Actions
5. **Monitoring**: Set up CloudWatch alarms

See [AWS_DEPLOYMENT.md](./AWS_DEPLOYMENT.md) for detailed instructions.

## GitHub Repository Setup

### CI/CD Pipeline

- **Tests**: Automated testing on every push
- **Build**: Compile TypeScript and bundle assets
- **Deploy**: Automatic deployment to EC2 on main branch push
- **Security**: CodeQL scanning for vulnerabilities

### Branch Strategy

- **main**: Production-ready code (auto-deployed)
- **develop**: Integration branch for features
- **feature/***: Feature branches for development

See [GITHUB_SETUP.md](./GITHUB_SETUP.md) for detailed setup.

## API Documentation

### tRPC Procedures

#### Markets
- `markets.list`: Get active markets with predictions
- `markets.detail`: Get detailed market view with history
- `markets.sync`: Sync markets from Polymarket API

#### Predictions
- `predictions.history`: Get prediction history for market
- `predictions.generate`: Generate new prediction

#### Metrics
- `metrics.accuracy`: Get accuracy metrics by period
- `metrics.latestAccuracy`: Get latest accuracy snapshot

#### Notifications
- `notifications.list`: Get user notifications
- `notifications.markRead`: Mark notification as read
- `notifications.markAllRead`: Mark all as read

#### Watchlist
- `watchlist.list`: Get user watchlist
- `watchlist.add`: Add market to watchlist
- `watchlist.remove`: Remove market from watchlist

## Database Schema

### Key Tables

**markets**: Polymarket market metadata
- polymarketId, eventId, eventName, marketName, outcomes, conditionId

**predictions**: Generated predictions with signals
- marketId, predictedOutcome, predictedProbability, confidence, signals, signalWeights

**market_snapshots**: Hourly market state snapshots
- marketId, timestamp, prices, volume24h, momentum, volatility

**notifications**: User alerts and notifications
- userId, marketId, type, title, message, severity

**accuracy_metrics**: Aggregated performance metrics
- period, totalPredictions, accuratePredictions, accuracy, averageConfidence

See [ARCHITECTURE.md](./ARCHITECTURE.md) for complete schema documentation.

## Prediction Algorithm

### Signal Weights

The prediction engine combines multiple signals:

| Signal | Weight | Source |
|--------|--------|--------|
| Technical Analysis | 40% | Price momentum, volatility, trends |
| Sentiment Analysis | 60% | LLM analysis of market descriptions |

### Technical Indicators

- **Momentum**: Rate of price change with moving average
- **Volatility**: Standard deviation of returns
- **Trend**: Bullish/bearish/neutral classification
- **Volume**: 24-hour trading volume changes

### LLM Sentiment Analysis

- Analyzes market descriptions and comments
- Generates sentiment scores (-1 to 1)
- Produces probability predictions (0 to 1)
- Provides confidence scores

### Ensemble Prediction

```
Combined Probability = (Technical Signal × 0.4) + (Sentiment Probability × 0.6)
Confidence = Base Confidence ± Adjustments for:
  - Signal agreement (±0.1)
  - Volatility (±0.15)
  - Data availability (±0.05)
```

## Cost Optimization

### Strategies Implemented

1. **WebSocket over Polling**: 90% reduction in API calls
2. **TTL-based Cleanup**: Automatic DynamoDB item deletion
3. **S3 Lifecycle**: Archive to Glacier after 90 days
4. **On-demand Pricing**: Pay only for actual usage
5. **Batch Operations**: Combine multiple operations
6. **Connection Pooling**: Reuse database connections

### Monitoring Costs

```bash
# View AWS billing
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost"
```

## Performance Metrics

### Target Performance

- API response time: < 200ms
- WebSocket latency: < 100ms
- Prediction generation: < 2 seconds
- Database query: < 50ms
- Prediction accuracy: > 50%

### Monitoring

CloudWatch dashboards track:
- API response times
- WebSocket connection count
- DynamoDB capacity utilization
- S3 storage size
- Prediction accuracy trends
- Error rates and exceptions

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/analyzer.test.ts

# Watch mode
pnpm test --watch

# Coverage report
pnpm test --coverage
```

### Integration Tests

- Database operations
- API endpoints
- WebSocket connections
- Prediction generation

### Manual Testing

1. Start dev server: `pnpm dev`
2. Navigate to http://localhost:3000
3. Test market fetching and display
4. Test prediction generation
5. Test WebSocket updates
6. Monitor console for errors

## Troubleshooting

### Common Issues

**WebSocket Connection Failed**
- Check Polymarket API status
- Verify network connectivity
- Check security group rules

**DynamoDB Throttling**
- Increase provisioned capacity
- Implement exponential backoff
- Use on-demand pricing

**High Latency**
- Check EC2 CPU usage
- Monitor database queries
- Review CloudWatch logs

**Predictions Inaccurate**
- Verify LLM API connection
- Check signal weights
- Review historical accuracy

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make changes and add tests
4. Submit a pull request
5. Ensure CI/CD passes

See [GITHUB_SETUP.md](./GITHUB_SETUP.md) for detailed guidelines.

## Portfolio Highlights

### AWS Cloud Practitioner Skills

- **Infrastructure as Code**: Terraform/CloudFormation templates
- **Cost Optimization**: Free Tier maximization and monitoring
- **Scalability**: Architecture designed for growth
- **Security**: IAM roles, encryption, VPC configuration
- **Monitoring**: CloudWatch metrics and alarms
- **Disaster Recovery**: Backup and recovery strategies

### Full-Stack Development

- **Frontend**: React with modern patterns
- **Backend**: Node.js with tRPC type safety
- **Database**: Schema design and optimization
- **DevOps**: CI/CD pipeline and automation
- **Documentation**: Comprehensive guides

### Learning Outcomes

- Real-time data processing with WebSockets
- Machine learning integration (LLM APIs)
- Serverless architecture patterns
- Cost-effective cloud design
- Production deployment strategies

## Roadmap

### Phase 1: MVP (Current)
- ✓ Real-time market data fetching
- ✓ Technical analysis engine
- ✓ LLM sentiment analysis
- ✓ Prediction generation
- ✓ Basic dashboard
- ✓ AWS Free Tier deployment

### Phase 2: Growth
- [ ] Advanced prediction models
- [ ] Multi-market analysis
- [ ] User portfolios
- [ ] Historical trend analysis
- [ ] Mobile app
- [ ] Auto-scaling infrastructure

### Phase 3: Production
- [ ] Real-time trading integration
- [ ] Advanced risk management
- [ ] Machine learning models
- [ ] Multi-region deployment
- [ ] Enterprise features

## License

MIT License - See LICENSE file for details

## Resources

- [Polymarket API Documentation](https://docs.polymarket.com)
- [AWS Free Tier](https://aws.amazon.com/free)
- [Node.js Documentation](https://nodejs.org/docs)
- [React Documentation](https://react.dev)
- [tRPC Documentation](https://trpc.io)

## Contact & Support

- GitHub Issues: Report bugs and request features
- Discussions: Ask questions and share ideas
- Email: your.public@listermapholisa.com

## Acknowledgments

- Polymarket for the prediction market data
- Manus for the Forge API and deployment platform
- AWS for the Free Tier resources
- Open source community for amazing tools

---

**Built with ❤️ as an AWS Cloud Practitioner portfolio project**

Last updated: March 2026
