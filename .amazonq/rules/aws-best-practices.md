# AWS Best Practices Rules for Amazon Q

## Security Best Practices
- Implement least privilege access for all IAM roles and policies
- Use AWS Secrets Manager for storing sensitive information
- Enable AWS CloudTrail for audit logging
- Use VPC endpoints for private communication
- Implement proper encryption at rest and in transit
- Regularly rotate access keys and credentials
- Use AWS Config for compliance monitoring

## IAM Policy Guidelines
- Follow principle of least privilege
- Use specific resource ARNs instead of wildcards when possible
- Implement condition statements for additional security
- Regularly review and audit IAM policies
- Use AWS Access Analyzer to validate policies
- Document policy purposes and requirements
- Test policies in development environments first

## Lambda Best Practices
- Keep functions small and focused on single responsibilities
- Use environment variables for configuration
- Implement proper error handling and logging
- Set appropriate timeout and memory limits
- Use Lambda layers for shared dependencies
- Monitor function performance and costs
- Implement dead letter queues for error handling

## DynamoDB Best Practices
- Design partition keys for even distribution
- Use sort keys for query flexibility
- Implement proper indexing strategies
- Monitor read/write capacity and costs
- Use DynamoDB Streams for change tracking
- Implement proper backup and recovery strategies
- Consider using DynamoDB Accelerator (DAX) for caching

## API Gateway Best Practices
- Implement proper authentication and authorization
- Use request validation to prevent malformed requests
- Implement rate limiting and throttling
- Use caching for frequently accessed data
- Monitor API performance and usage
- Implement proper CORS configuration
- Use custom domain names for production APIs

## Monitoring and Logging
- Use CloudWatch for monitoring and alerting
- Implement structured logging with JSON format
- Set up appropriate CloudWatch alarms
- Use X-Ray for distributed tracing
- Monitor costs and set up billing alerts
- Implement log retention policies
- Use CloudWatch Insights for log analysis

## Cost Optimization
- Right-size resources based on actual usage
- Use Reserved Instances for predictable workloads
- Implement auto-scaling for variable workloads
- Monitor and optimize data transfer costs
- Use S3 lifecycle policies for data archiving
- Regularly review and clean up unused resources
- Implement cost allocation tags

## Deployment Best Practices
- Use Infrastructure as Code (CDK/CloudFormation)
- Implement proper CI/CD pipelines
- Use multiple environments (dev, staging, prod)
- Implement blue-green or canary deployments
- Use AWS Systems Manager for configuration management
- Implement proper rollback strategies
- Test deployments in non-production environments

## Disaster Recovery
- Implement regular backups for all data
- Design for multi-AZ deployment
- Consider cross-region replication for critical data
- Document and test disaster recovery procedures
- Implement proper RTO and RPO requirements
- Use AWS Backup for centralized backup management
- Regularly test backup restoration procedures

## Performance Optimization
- Use CloudFront for content delivery
- Implement proper caching strategies
- Optimize database queries and indexes
- Use connection pooling for database connections
- Monitor and optimize cold start times for Lambda
- Implement proper pagination for large datasets
- Use compression for data transfer
