# Polymarket Analyzer - Research Notes

## Phase 1: Research & Planning

### Polymarket API Overview
- **Public REST APIs**: No authentication required for market data
  - Gamma API: Events and markets discovery
  - CLOB API: Prices and orderbooks
  - Data API: Positions, trades, and analytics
- **WebSocket Channels**:
  - Market Channel: Orderbook updates, price changes, trades
  - User Channel: Personal order activity (requires auth)
  - Sports Channel: Sports event data
  - RTDS: Real-Time Data Socket for crypto prices and comments
- **Data Model**:
  - Events: Top-level questions (e.g., "Who will win 2024 election?")
  - Markets: Binary outcomes within events (Yes/No)
  - Outcomes & Prices: Implied probabilities from price data

### AWS Free Tier Constraints
- **EC2**: 1 t2.micro instance (750 hours/month)
- **DynamoDB**: 25 GB storage, 25 provisioned write/read capacity units
- **Lambda**: 1 million requests/month, 3.2 million seconds compute
- **S3**: 5 GB storage, 20,000 GET requests, 2,000 PUT requests
- **CloudWatch**: 10 custom metrics, 1 GB logs ingestion
- **NAT Gateway**: Not included in Free Tier (use EC2 for outbound internet)

### Prediction Model Approach
- Historical price movement analysis (momentum, volatility)
- Volume-weighted probability calculations
- LLM sentiment analysis on market descriptions
- Ensemble predictions combining multiple signals
- Accuracy tracking and confidence scoring

### Architecture Strategy
- Single t2.micro EC2 instance running Node.js backend + frontend
- DynamoDB for market snapshots and prediction logs
- S3 for long-term data storage and analysis results
- WebSocket for real-time updates (minimize polling)
- Lambda for scheduled analysis jobs (if needed)

---

## Key Findings

### Polymarket API Endpoints
- `GET /events?limit=N` - Fetch events
- `GET /markets?eventId=X` - Fetch markets for event
- `GET /orderbooks/{conditionId}` - Get orderbook for market
- WebSocket: `wss://es-subscriptions-clob.polymarket.com/ws/market`

### Cost Optimization Tips
1. Use WebSocket instead of polling (reduces API calls)
2. Store snapshots in DynamoDB with TTL for auto-cleanup
3. Batch Lambda invocations for analysis
4. Use CloudWatch Logs Insights for cost-effective querying
5. Archive old data to S3 Glacier for long-term storage

---

## Next Steps
- [ ] Design database schema for market snapshots and predictions
- [ ] Plan WebSocket connection management
- [ ] Design LLM sentiment analysis pipeline
- [ ] Create AWS deployment templates
- [ ] Set up GitHub CI/CD workflows
