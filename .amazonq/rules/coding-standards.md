# Coding Standards Rules for Amazon Q

## General Principles
- Write clean, readable, and maintainable code
- Follow the principle of least privilege for AWS permissions
- Implement comprehensive error handling
- Use descriptive variable and function names
- Add meaningful comments for complex logic

## TypeScript/JavaScript Standards
- Use TypeScript for all new code
- Enable strict mode in TypeScript configuration
- Use interfaces for type definitions
- Implement proper error boundaries in React
- Follow React hooks best practices
- Use async/await instead of promises where possible

## Python Standards
- Follow PEP 8 style guidelines
- Use type hints for function parameters and return values
- Implement proper exception handling
- Use context managers for resource management
- Write docstrings for all functions and classes
- Use f-strings for string formatting

## AWS CDK Standards
- Use constructs appropriately (L1, L2, L3)
- Implement proper resource naming conventions
- Use environment variables for configuration
- Implement least privilege IAM policies
- Add resource tags for cost tracking
- Use AWS CDK best practices for stack organization

## Testing Standards
- Write tests for all new functionality
- Maintain minimum 80% code coverage
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies appropriately
- Write both unit and integration tests

## Security Standards
- Never hardcode secrets or credentials
- Use AWS Secrets Manager for sensitive data
- Implement proper input validation
- Use HTTPS for all communications
- Follow OWASP security guidelines
- Regularly update dependencies

## Git Standards
- Use conventional commit messages
- Create focused, atomic commits
- Write descriptive commit messages
- Use feature branches for development
- Require code reviews for all changes
- Keep commit history clean and meaningful

## Documentation Standards
- Update README files for significant changes
- Document API endpoints and parameters
- Include setup and deployment instructions
- Maintain architecture decision records
- Document known issues and limitations
- Keep documentation up to date with code changes
