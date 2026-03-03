# GitHub Repository Setup & CI/CD Pipeline

## Repository Structure

```
polymarket-analyzer/
├── .github/
│   └── workflows/
│       ├── test.yml          # Run tests on every push
│       ├── deploy.yml        # Deploy to AWS on main branch
│       └── codeql.yml        # Security scanning
├── client/                   # React frontend
├── server/                   # Node.js backend
├── drizzle/                  # Database schema & migrations
├── shared/                   # Shared types & constants
├── storage/                  # S3 storage helpers
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
├── README.md                 # Project documentation
├── ARCHITECTURE.md           # System architecture
├── AWS_DEPLOYMENT.md         # AWS deployment guide
└── package.json              # Dependencies
```

## Initial GitHub Setup

### Create Repository

1. Go to https://github.com/new
2. Repository name: `polymarket-analyzer`
3. Description: "Real-time Polymarket market analyzer with AI-powered predictions"
4. Visibility: Public (for portfolio)
5. Initialize with README: No (we have one)

### Clone and Push

```bash
# Navigate to project directory
cd /home/ubuntu/polymarket-analyzer

# Initialize git repository
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Polymarket analyzer with LLM sentiment analysis"

# Add remote repository
git remote add origin https://github.com/YOUR_USERNAME/polymarket-analyzer.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### Configure Git

```bash
# Set up git credentials
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Optional: Set up SSH key for passwordless authentication
ssh-keygen -t ed25519 -C "your.email@example.com"
# Add public key to GitHub Settings > SSH Keys
```

## GitHub Actions CI/CD

### Test Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mysql:
        image: mysql:8.0
        env:
          MYSQL_ROOT_PASSWORD: root
          MYSQL_DATABASE: polymarket_test
        options: >-
          --health-cmd="mysqladmin ping"
          --health-interval=10s
          --health-timeout=5s
          --health-retries=3
        ports:
          - 3306:3306

    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'pnpm'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run type check
        run: pnpm check
      
      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: mysql://root:root@localhost:3306/polymarket_test
      
      - name: Build
        run: pnpm build
```

### Deploy Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
          cache: 'pnpm'
      
      - name: Install pnpm
        run: npm install -g pnpm
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Build
        run: pnpm build
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ${{ secrets.EC2_USER }}
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ubuntu/polymarket-analyzer
            git pull origin main
            pnpm install
            pnpm build
            pm2 restart polymarket-analyzer
            pm2 save
```

### Security Scanning

Create `.github/workflows/codeql.yml`:

```yaml
name: CodeQL

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  analyze:
    runs-on: ubuntu-latest
    
    permissions:
      security-events: write
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Initialize CodeQL
        uses: github/codeql-action/init@v2
        with:
          languages: 'javascript'
      
      - name: Autobuild
        uses: github/codeql-action/autobuild@v2
      
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
```

## GitHub Secrets Configuration

### Add Secrets for CI/CD

1. Go to Repository Settings > Secrets and variables > Actions
2. Add the following secrets:

| Secret Name | Value | Purpose |
|-------------|-------|---------|
| `EC2_HOST` | Your EC2 public IP | SSH deployment target |
| `EC2_USER` | `ubuntu` | EC2 SSH username |
| `EC2_SSH_KEY` | Private SSH key content | EC2 authentication |
| `AWS_ACCESS_KEY_ID` | Your AWS access key | AWS API access |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret key | AWS API authentication |
| `DATABASE_URL` | MySQL connection string | Database connection |
| `BUILT_IN_FORGE_API_KEY` | Your Forge API key | LLM API access |

### Generate SSH Key for GitHub Actions

```bash
# Generate new SSH key for deployment
ssh-keygen -t ed25519 -f deploy-key -N ""

# Copy private key content (deploy-key) to EC2_SSH_KEY secret
cat deploy-key

# Add public key to EC2 authorized_keys
cat deploy-key.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Clean up local copies
rm deploy-key deploy-key.pub
```

## Branch Strategy

### Main Branches

- **main**: Production-ready code, automatically deployed
- **develop**: Integration branch for features

### Feature Branches

```bash
# Create feature branch
git checkout -b feature/market-filtering

# Make changes and commit
git add .
git commit -m "feat: add market filtering by event"

# Push to GitHub
git push origin feature/market-filtering

# Create Pull Request on GitHub
# After review and approval, merge to develop
# Periodically merge develop to main for releases
```

### Commit Message Convention

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(predictor): add ensemble prediction combining signals
fix(analyzer): correct momentum calculation for edge cases
docs(deployment): add AWS Free Tier setup guide
```

## Release Management

### Semantic Versioning

Use [Semantic Versioning](https://semver.org/): `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes
- **MINOR**: New features
- **PATCH**: Bug fixes

### Create Release

```bash
# Tag a release
git tag -a v1.0.0 -m "Release version 1.0.0: Initial MVP"

# Push tag to GitHub
git push origin v1.0.0

# Create GitHub Release
# Go to Releases > Create a new release
# Select tag v1.0.0
# Add release notes
# Publish release
```

## Collaboration Guidelines

### Code Review Process

1. Create feature branch from develop
2. Make changes and push to GitHub
3. Create Pull Request with description
4. Request review from team members
5. Address review comments
6. Merge after approval

### Pull Request Template

Create `.github/pull_request_template.md`:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Testing
- [ ] Unit tests added
- [ ] Integration tests added
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings generated
```

## Issue Tracking

### Issue Templates

Create `.github/ISSUE_TEMPLATE/bug_report.md`:

```markdown
---
name: Bug Report
about: Report a bug
title: "[BUG] "
labels: bug
---

## Description
Clear description of the bug

## Steps to Reproduce
1. Step 1
2. Step 2
3. Step 3

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: 
- Browser: 
- Version: 

## Screenshots
If applicable, add screenshots
```

Create `.github/ISSUE_TEMPLATE/feature_request.md`:

```markdown
---
name: Feature Request
about: Suggest a new feature
title: "[FEATURE] "
labels: enhancement
---

## Description
Clear description of the feature

## Motivation
Why this feature is needed

## Proposed Solution
How to implement it

## Alternatives
Other approaches considered
```

## Documentation

### README.md Structure

```markdown
# Polymarket Analyzer

Brief description

## Features
- Real-time market data
- AI-powered predictions
- WebSocket updates

## Quick Start
Installation and setup instructions

## Architecture
System design overview

## Deployment
AWS deployment guide

## Contributing
How to contribute

## License
License information
```

### Keep Documentation Updated

- Update README when adding features
- Keep ARCHITECTURE.md in sync with code
- Document API changes in comments
- Add examples for complex features

## Monitoring & Analytics

### GitHub Insights

1. Go to Repository > Insights
2. Monitor:
   - Commit activity
   - Code frequency
   - Network graph
   - Contributors

### Track Issues

1. Use GitHub Projects for task management
2. Label issues for categorization
3. Use milestones for releases
4. Track progress with automation

## Security Best Practices

### Protect Main Branch

1. Go to Settings > Branches
2. Add branch protection rule for `main`:
   - Require pull request reviews
   - Require status checks to pass
   - Require branches to be up to date
   - Dismiss stale reviews

### Dependabot

1. Go to Settings > Code security and analysis
2. Enable Dependabot alerts
3. Enable Dependabot security updates
4. Review and merge dependency updates

### Secret Scanning

1. Enable secret scanning
2. Review and revoke any exposed secrets
3. Rotate credentials immediately

## Portfolio Presentation

### GitHub Profile

1. Add project to profile README
2. Pin repository to profile
3. Write compelling description
4. Add topics: `polymarket`, `prediction-markets`, `aws`, `react`, `nodejs`

### Project Showcase

1. Create comprehensive README
2. Add architecture diagrams
3. Include deployment guide
4. Show cost tracking
5. Document lessons learned

### Example README Section

```markdown
## Portfolio Highlights

### AWS Cloud Practitioner Showcase
- **Infrastructure**: Single t2.micro EC2 instance
- **Database**: DynamoDB with on-demand pricing
- **Storage**: S3 for long-term data archival
- **Cost**: $0/month on Free Tier, ~$15-20/month after
- **Monitoring**: CloudWatch metrics and alarms

### Technical Achievements
- Real-time WebSocket integration
- LLM-powered sentiment analysis
- Ensemble prediction engine
- Comprehensive error handling
- Production-ready deployment

### Learning Outcomes
- AWS Free Tier optimization
- Full-stack TypeScript development
- Database design and optimization
- CI/CD pipeline implementation
- Production deployment strategies
```

## Continuous Improvement

### Regular Reviews

1. Weekly: Check test coverage
2. Monthly: Review performance metrics
3. Quarterly: Plan new features
4. Annually: Major version releases

### Feedback Loop

1. Monitor GitHub issues
2. Respond to user feedback
3. Implement improvements
4. Document changes
5. Release updates

## Resources

- GitHub Documentation: https://docs.github.com
- GitHub Actions: https://github.com/features/actions
- Conventional Commits: https://www.conventionalcommits.org
- Semantic Versioning: https://semver.org
- GitHub Flow: https://guides.github.com/introduction/flow
