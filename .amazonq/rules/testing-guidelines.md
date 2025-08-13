# Testing Guidelines Rules for Amazon Q

## Testing Philosophy
- Tests are first-class citizens in the codebase
- Write tests before or alongside implementation
- Tests should be reliable, fast, and maintainable
- Every bug fix should include a test to prevent regression
- Tests serve as living documentation

## Test Structure and Organization
- Follow the AAA pattern: Arrange, Act, Assert
- Use descriptive test names that explain the scenario
- Group related tests in classes or describe blocks
- Keep tests focused on a single behavior
- Use setup and teardown methods appropriately

## Testing Frameworks and Tools
- **Python**: pytest, Playwright, moto for AWS mocking
- **JavaScript/TypeScript**: Jest, React Testing Library
- **E2E Testing**: Playwright for browser automation
- **API Testing**: Use appropriate HTTP clients for testing
- **AWS Testing**: Mock AWS services using moto or similar tools

## Test Categories
1. **Unit Tests**: Test individual functions/methods in isolation
2. **Integration Tests**: Test component interactions
3. **E2E Tests**: Test complete user workflows
4. **API Tests**: Test REST/GraphQL endpoints
5. **Performance Tests**: Test response times and load handling

## AWS Testing Best Practices
- Mock AWS services in unit tests
- Use LocalStack or moto for AWS service simulation
- Test IAM policies with AWS Access Analyzer
- Validate CloudFormation/CDK templates
- Test error scenarios (permissions, network failures)

## Test Data Management
- Use fixtures for consistent test data
- Create realistic but anonymized test data
- Clean up test data after each test
- Use factories or builders for complex test objects
- Avoid hardcoded values in tests

## Mocking and Stubbing
- Mock external dependencies and services
- Use dependency injection for better testability
- Mock at the appropriate level (not too high, not too low)
- Verify mock interactions when behavior matters
- Reset mocks between tests

## Test Coverage
- Aim for 80%+ code coverage
- Focus on critical paths and edge cases
- Don't chase 100% coverage at the expense of quality
- Use coverage reports to identify untested code
- Exclude generated code from coverage metrics

## Continuous Integration
- Run tests on every commit and pull request
- Fail builds on test failures
- Run tests in parallel when possible
- Use appropriate test environments
- Generate and publish test reports

## Test Maintenance
- Keep tests up to date with code changes
- Refactor tests when they become hard to maintain
- Remove obsolete tests
- Update test documentation
- Review and improve slow tests

## Error Testing
- Test error conditions and edge cases
- Verify proper error messages and codes
- Test timeout and retry scenarios
- Validate error handling in user interfaces
- Test security-related error conditions

## Performance Testing
- Include performance tests for critical paths
- Set reasonable performance benchmarks
- Test under various load conditions
- Monitor test execution times
- Identify and address performance regressions
