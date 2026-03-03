# Polymarket Analyzer - System Architecture & Design

## Executive Summary

The Polymarket Analyzer is a real-time market analysis and prediction platform that fetches live market data from Polymarket, performs sentiment analysis using LLM, generates probability predictions, and displays results through an interactive dashboard. The system is designed to operate within AWS Free Tier constraints with minimal operational costs.

## System Architecture Overview

### High-Level Architecture

The system follows a three-tier architecture optimized for AWS Free Tier:

**Presentation Tier (Frontend)**: React 19 application running on EC2 t2.micro, displaying real-time market data, predictions, and historical accuracy metrics through an interactive dashboard.

**Application Tier (Backend)**: Node.js/Express server handling Polymarket API integration, WebSocket management, data analysis, LLM sentiment analysis, and business logic.

**Data Tier (Storage)**: DynamoDB for hot data (market snapshots, recent predictions), S3 for cold storage (historical data, analysis archives), and CloudWatch for monitoring and logging.

### Component Breakdown

#### 1. Polymarket Data Fetcher
The data fetcher module manages all interactions with Polymarket's public APIs. It fetches events and markets on startup, maintains a cache of active markets, and handles API rate limiting gracefully. The module implements exponential backoff for failed requests and logs all API interactions for debugging.

**Key Responsibilities**:
- Fetch active events from Gamma API
- Retrieve market orderbooks from CLOB API
- Cache market metadata locally
- Handle API rate limiting and errors
- Track API call counts for cost optimization

#### 2. WebSocket Manager
Real-time market updates flow through WebSocket connections to the Polymarket market channel. The WebSocket manager maintains persistent connections, handles subscription/unsubscription dynamically, and implements heartbeat mechanisms to prevent connection drops.

**Key Responsibilities**:
- Establish and maintain WebSocket connections
- Subscribe to relevant market channels
- Parse incoming orderbook and price update messages
- Emit events to analysis pipeline
- Implement automatic reconnection with exponential backoff
- Send heartbeats every 10 seconds

#### 3. Market Analyzer
The analyzer processes raw market data and computes technical indicators used by the prediction engine. It calculates price momentum, volatility, volume-weighted probabilities, and trend direction.

**Key Responsibilities**:
- Calculate price momentum from historical snapshots
- Compute volatility metrics
- Calculate volume-weighted probabilities
- Detect significant price movements
- Generate technical signals for predictions

#### 4. LLM Sentiment Analysis Engine
This module integrates with the Manus Forge API to perform sentiment analysis on market descriptions, comments, and historical data. It generates probability predictions and confidence scores based on textual analysis.

**Key Responsibilities**:
- Process market descriptions and comments
- Generate sentiment-based probability predictions
- Calculate confidence scores
- Cache LLM responses to minimize API calls
- Handle LLM API errors gracefully

#### 5. Prediction Engine
The prediction engine combines signals from technical analysis and LLM sentiment analysis to generate ensemble predictions. It tracks prediction accuracy and adjusts confidence scores based on historical performance.

**Key Responsibilities**:
- Combine multiple prediction signals
- Calculate ensemble predictions
- Generate confidence scores
- Track prediction accuracy
- Adjust weights based on historical performance
- Store predictions for later analysis

#### 6. Data Persistence Layer
Market snapshots, predictions, and metrics are persisted to DynamoDB for fast access and to S3 for long-term archival. The persistence layer implements TTL-based cleanup for DynamoDB and automated archival to S3.

**Key Responsibilities**:
- Store market snapshots in DynamoDB
- Persist predictions with metadata
- Archive old data to S3
- Implement TTL-based cleanup
- Query historical data for analysis

#### 7. Notification System
When prediction accuracy crosses defined thresholds or significant market movements are detected, the system generates notifications. Notifications are stored in the database and displayed in the frontend.

**Key Responsibilities**:
- Monitor prediction accuracy thresholds
- Detect significant market movements
- Generate notification events
- Store notifications in database
- Push notifications to frontend via WebSocket

#### 8. Frontend Dashboard
The React frontend displays real-time market data, predictions, accuracy metrics, and historical trends. It connects to the backend via tRPC and WebSocket for real-time updates.

**Key Responsibilities**:
- Display active markets with real-time prices
- Show prediction results and confidence scores
- Display accuracy metrics and trends
- Provide market filtering and search
- Show notification center
- Display prediction history

## Database Schema

### DynamoDB Tables

#### Markets Table
Stores current market state and metadata with TTL for automatic cleanup.

```
PK: marketId (String)
SK: timestamp (Number)
Attributes:
  - eventId: String
  - eventName: String
  - marketName: String
  - outcomes: List<String>
  - outcomePrices: List<Number>
  - volume24h: Number
  - lastUpdate: Number
  - TTL: Number (30 days)
```

#### Predictions Table
Stores all generated predictions with accuracy tracking.

```
PK: predictionId (String)
SK: timestamp (Number)
Attributes:
  - marketId: String
  - predictedOutcome: String
  - predictedProbability: Number
  - confidence: Number
  - signals: Map<String, Number>
  - actualOutcome: String (populated after market resolution)
  - isAccurate: Boolean (populated after resolution)
  - TTL: Number (90 days)
```

#### Market Snapshots Table
Stores hourly market snapshots for trend analysis.

```
PK: marketId (String)
SK: snapshotHour (Number)
Attributes:
  - prices: List<Number>
  - volume: Number
  - momentum: Number
  - volatility: Number
  - TTL: Number (90 days)
```

#### Notifications Table
Stores user notifications and alerts.

```
PK: userId (String)
SK: notificationId (String)
Attributes:
  - type: String (THRESHOLD_CROSSED, MOVEMENT_DETECTED)
  - marketId: String
  - message: String
  - severity: String (INFO, WARNING, ALERT)
  - timestamp: Number
  - isRead: Boolean
  - TTL: Number (30 days)
```

#### Metrics Table
Stores aggregated accuracy and performance metrics.

```
PK: metricsId (String)
SK: period (String) (DAILY, WEEKLY, MONTHLY)
Attributes:
  - totalPredictions: Number
  - accuratePredictions: Number
  - accuracy: Number
  - averageConfidence: Number
  - timestamp: Number
```

### S3 Bucket Structure

```
polymarket-analyzer-data/
├── market-snapshots/
│   ├── YYYY/MM/DD/
│   │   └── marketId-HH.json
├── predictions/
│   ├── YYYY/MM/DD/
│   │   └── predictions-HH.json
├── analysis-results/
│   ├── YYYY/MM/
│   │   └── monthly-report.json
└── archives/
    └── YYYY/MM/
        └── full-archive.tar.gz
```

## API Endpoints

### Public Procedures

**markets.list** - Fetch all active markets with current predictions
- Query Parameters: `limit`, `offset`, `sortBy`
- Returns: Array of markets with predictions

**markets.detail** - Get detailed view of a single market
- Query Parameters: `marketId`
- Returns: Market data, prediction history, accuracy metrics

**predictions.history** - Get prediction history for a market
- Query Parameters: `marketId`, `limit`
- Returns: Array of predictions with outcomes

**metrics.accuracy** - Get accuracy metrics for a time period
- Query Parameters: `period` (DAILY, WEEKLY, MONTHLY)
- Returns: Accuracy statistics and trends

**notifications.list** - Get user notifications
- Query Parameters: `limit`, `unreadOnly`
- Returns: Array of notifications

### Protected Procedures

**markets.watchlist** - Manage user watchlist
- Mutation: Add/remove markets from watchlist
- Returns: Updated watchlist

**notifications.markRead** - Mark notifications as read
- Mutation: Mark single or all notifications as read
- Returns: Updated notification status

## Real-Time Data Flow

### WebSocket Event Flow

1. **Connection Establishment**: Client connects to backend WebSocket, backend subscribes to Polymarket market channel
2. **Market Update**: Polymarket sends price update, backend receives and parses
3. **Analysis**: Backend runs market analyzer on new data
4. **Prediction**: Prediction engine generates new prediction if conditions met
5. **Persistence**: Snapshot and prediction stored to DynamoDB
6. **Broadcast**: Backend broadcasts update to all connected clients
7. **Display**: Frontend updates dashboard in real-time

### Notification Flow

1. **Threshold Check**: Prediction accuracy checked against thresholds
2. **Movement Detection**: Significant price movements detected
3. **Notification Generation**: Notification created with severity level
4. **Persistence**: Notification stored in DynamoDB
5. **User Push**: Notification pushed to connected clients
6. **Display**: Frontend shows notification in notification center

## AWS Free Tier Resource Allocation

### EC2 (t2.micro)
- **Allocation**: 1 instance, 750 hours/month
- **Usage**: Backend server + frontend serving
- **Optimization**: Auto-scaling not needed for Free Tier, single instance sufficient

### DynamoDB
- **Allocation**: 25 GB storage, 25 RCU/WCU provisioned
- **Usage**: Hot data storage with TTL-based cleanup
- **Optimization**: On-demand pricing after Free Tier, but TTL keeps storage minimal

### S3
- **Allocation**: 5 GB storage, 20,000 GET requests, 2,000 PUT requests
- **Usage**: Long-term data archival and analysis results
- **Optimization**: Archive old data to Glacier after 90 days

### Lambda
- **Allocation**: 1 million requests/month, 3.2 million seconds compute
- **Usage**: Optional scheduled analysis jobs
- **Optimization**: Use EC2 cron jobs instead of Lambda to stay within Free Tier

### CloudWatch
- **Allocation**: 10 custom metrics, 1 GB logs ingestion
- **Usage**: Application monitoring and error logging
- **Optimization**: Use structured logging, aggregate metrics

## Cost Optimization Strategies

### Data Fetching
- Use WebSocket for real-time updates instead of polling (reduces API calls by 90%)
- Implement local caching of market metadata
- Batch API requests when possible
- Implement exponential backoff for failed requests

### Storage
- Enable TTL on DynamoDB tables for automatic cleanup
- Archive data to S3 after 30 days
- Use S3 Glacier for data older than 90 days
- Compress archived data before storage

### Compute
- Run single t2.micro instance for both backend and frontend
- Use Node.js for efficient resource utilization
- Implement connection pooling for database
- Cache LLM responses to minimize API calls

### Monitoring
- Use CloudWatch Logs Insights for cost-effective querying
- Aggregate metrics to reduce custom metric count
- Set up billing alerts to catch unexpected costs
- Monitor Free Tier usage regularly

## Security Considerations

### Data Security
- Store sensitive data (API keys, secrets) in environment variables
- Use HTTPS for all external communications
- Implement request signing for AWS SDK calls
- Encrypt data at rest in S3 using server-side encryption

### API Security
- Implement rate limiting on public endpoints
- Use CORS to restrict frontend access
- Validate all user inputs
- Implement CSRF protection for state-changing operations

### Access Control
- Use IAM roles for EC2 instance (not hardcoded credentials)
- Implement role-based access control for admin functions
- Use OAuth for user authentication
- Log all administrative actions

## Monitoring & Observability

### Key Metrics
- API response times and error rates
- WebSocket connection count and message throughput
- DynamoDB read/write capacity utilization
- S3 storage size and request counts
- Prediction accuracy and confidence scores
- System CPU and memory usage

### Logging Strategy
- Application logs: Error, warning, info levels
- Access logs: HTTP requests and responses
- WebSocket logs: Connection events and messages
- Prediction logs: All predictions with signals and outcomes
- Cost logs: AWS service usage and costs

### Alerting
- Alert on API error rates > 5%
- Alert on WebSocket disconnections
- Alert on DynamoDB throttling
- Alert on S3 storage exceeding 4 GB
- Alert on prediction accuracy < 40%

## Deployment Architecture

### Development Environment
- Local Node.js development server
- SQLite for local database (replaced by DynamoDB in production)
- Environment variables from .env file

### Production Environment (AWS)
- EC2 t2.micro instance running Node.js
- DynamoDB for data storage
- S3 for data archival
- CloudWatch for monitoring
- Route 53 for DNS (optional)
- CloudFront for CDN (optional, not in Free Tier)

### CI/CD Pipeline
- GitHub Actions for automated testing
- Automated deployment to EC2 on main branch push
- Automated database migrations
- Rollback capability for failed deployments

## Scalability Roadmap

### Phase 1: MVP (Current)
- Single EC2 instance
- DynamoDB on-demand pricing
- Basic prediction engine
- Limited market coverage

### Phase 2: Growth
- Auto-scaling EC2 instances
- RDS for relational data
- Lambda for scheduled jobs
- Extended market coverage

### Phase 3: Production
- Multi-region deployment
- Advanced prediction models
- Real-time alerting system
- Mobile app support

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + Tailwind CSS | Modern, responsive, component-based |
| Backend | Node.js + Express | Lightweight, event-driven, WebSocket support |
| Database | DynamoDB | Serverless, auto-scaling, Free Tier eligible |
| Storage | S3 | Durable, scalable, cost-effective |
| Monitoring | CloudWatch | Integrated with AWS, Free Tier eligible |
| Deployment | EC2 t2.micro | Free Tier eligible, sufficient for MVP |
| CI/CD | GitHub Actions | Free for public repos, easy integration |

## Next Steps

1. Implement database schema in Drizzle ORM
2. Create Polymarket API client module
3. Implement WebSocket connection manager
4. Build market analyzer with technical indicators
5. Integrate LLM sentiment analysis
6. Create prediction engine
7. Build frontend dashboard
8. Set up AWS infrastructure
9. Create deployment scripts
10. Write comprehensive documentation
