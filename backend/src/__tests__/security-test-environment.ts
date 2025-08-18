/**
 * Security Testing Environment Setup
 * Isolated testing environment for security validation
 */

import * as fs from 'fs';
import * as path from 'path';

export class SecurityTestEnvironment {
    private static instance: SecurityTestEnvironment;
    private testDataPath: string;
    private mockServices: Map<string, any>;
    private securityConfig: any;

    private constructor() {
        this.testDataPath = path.join(__dirname, '../../../test-data/security');
        this.mockServices = new Map();
        this.securityConfig = this.loadSecurityConfig();
        this.setupTestEnvironment();
    }

    public static getInstance(): SecurityTestEnvironment {
        if (!SecurityTestEnvironment.instance) {
            SecurityTestEnvironment.instance = new SecurityTestEnvironment();
        }
        return SecurityTestEnvironment.instance;
    }

    private loadSecurityConfig(): any {
        const configPath = path.join(__dirname, '../../../config/security-test-config.json');

        const defaultConfig = {
            testUsers: {
                admin: {
                    userId: 'test-admin-001',
                    email: 'admin@test.example.com',
                    roles: ['Admin'],
                    groups: ['admin']
                },
                contributor: {
                    userId: 'test-contributor-001',
                    email: 'contributor@test.example.com',
                    roles: ['Contributor'],
                    groups: ['contributor']
                },
                viewer: {
                    userId: 'test-viewer-001',
                    email: 'viewer@test.example.com',
                    roles: ['Viewer'],
                    groups: ['viewer']
                },
                malicious: {
                    userId: 'test-malicious-001',
                    email: 'malicious@test.example.com',
                    roles: [],
                    groups: []
                }
            },
            testData: {
                validTasks: [
                    {
                        taskId: 'test-task-001',
                        title: 'Test Task 1',
                        description: 'A valid test task',
                        assignedTo: 'test-contributor-001',
                        createdBy: 'test-admin-001',
                        status: 'pending',
                        priority: 'medium',
                        deadline: new Date(Date.now() + 86400000).toISOString()
                    }
                ],
                maliciousPayloads: {
                    xss: [
                        '<script>alert("xss")</script>',
                        'javascript:alert("xss")',
                        '<img src="x" onerror="alert(1)">',
                        '<svg onload="alert(1)">',
                        '"><script>alert("xss")</script>'
                    ],
                    sqlInjection: [
                        "'; DROP TABLE users; --",
                        "1' OR '1'='1",
                        "admin'/*",
                        "1; DELETE FROM tasks WHERE 1=1; --"
                    ],
                    commandInjection: [
                        '; ls -la',
                        '| cat /etc/passwd',
                        '&& rm -rf /',
                        '`whoami`',
                        '$(id)'
                    ],
                    pathTraversal: [
                        '../../../etc/passwd',
                        '..\\..\\..\\windows\\system32\\config\\sam',
                        '....//....//....//etc/passwd',
                        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
                    ]
                },
                testTokens: {
                    valid: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMDAxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjk5OTk5OTk5OTl9.test',
                    expired: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMDAxIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE2MDAwMDAwMDF9.test',
                    malformed: 'invalid.jwt.token',
                    empty: ''
                }
            },
            attackScenarios: {
                bruteForce: {
                    maxAttempts: 5,
                    lockoutDuration: 300000, // 5 minutes
                    testPasswords: ['password', '123456', 'admin', 'test']
                },
                rateLimiting: {
                    maxRequestsPerMinute: 100,
                    testDuration: 60000
                },
                sessionFixation: {
                    testSessionIds: ['session-1', 'session-2', 'session-3']
                }
            }
        };

        if (fs.existsSync(configPath)) {
            const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return { ...defaultConfig, ...userConfig };
        }

        // Create default config file
        this.ensureDirectoryExists(path.dirname(configPath));
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));

        return defaultConfig;
    }

    private setupTestEnvironment(): void {
        // Ensure test data directory exists
        this.ensureDirectoryExists(this.testDataPath);

        // Setup mock services
        this.setupMockServices();

        // Create test data files
        this.createTestDataFiles();

        // Setup environment variables for testing
        this.setupTestEnvironmentVariables();
    }

    private ensureDirectoryExists(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    private setupMockServices(): void {
        // Mock AWS services for testing
        this.mockServices.set('dynamodb', {
            scan: jest.fn(),
            query: jest.fn(),
            put: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        });

        this.mockServices.set('cognito', {
            adminGetUser: jest.fn(),
            adminCreateUser: jest.fn(),
            adminDeleteUser: jest.fn(),
            adminSetUserPassword: jest.fn()
        });

        this.mockServices.set('kms', {
            encrypt: jest.fn(),
            decrypt: jest.fn(),
            generateDataKey: jest.fn()
        });

        this.mockServices.set('secretsManager', {
            getSecretValue: jest.fn(),
            createSecret: jest.fn(),
            updateSecret: jest.fn()
        });
    }

    private createTestDataFiles(): void {
        // Create test user data
        const usersFile = path.join(this.testDataPath, 'test-users.json');
        fs.writeFileSync(usersFile, JSON.stringify(this.securityConfig.testUsers, null, 2));

        // Create test task data
        const tasksFile = path.join(this.testDataPath, 'test-tasks.json');
        fs.writeFileSync(tasksFile, JSON.stringify(this.securityConfig.testData.validTasks, null, 2));

        // Create malicious payload data
        const payloadsFile = path.join(this.testDataPath, 'malicious-payloads.json');
        fs.writeFileSync(payloadsFile, JSON.stringify(this.securityConfig.testData.maliciousPayloads, null, 2));

        // Create attack scenario data
        const scenariosFile = path.join(this.testDataPath, 'attack-scenarios.json');
        fs.writeFileSync(scenariosFile, JSON.stringify(this.securityConfig.attackScenarios, null, 2));
    }

    private setupTestEnvironmentVariables(): void {
        // Set test-specific environment variables
        process.env.NODE_ENV = 'test';
        process.env.AWS_REGION = 'us-east-1';
        process.env.DYNAMODB_TABLE_NAME = 'test-tasks-table';
        process.env.COGNITO_USER_POOL_ID = 'test-user-pool';
        process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
        process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters';
    }

    public getTestUser(role: 'admin' | 'contributor' | 'viewer' | 'malicious'): any {
        return this.securityConfig.testUsers[role];
    }

    public getTestData(type: 'validTasks' | 'maliciousPayloads' | 'testTokens'): any {
        return this.securityConfig.testData[type];
    }

    public getAttackScenario(type: 'bruteForce' | 'rateLimiting' | 'sessionFixation'): any {
        return this.securityConfig.attackScenarios[type];
    }

    public getMockService(serviceName: string): any {
        return this.mockServices.get(serviceName);
    }

    public createMaliciousRequest(attackType: 'xss' | 'sqlInjection' | 'commandInjection' | 'pathTraversal'): any {
        const payloads = this.securityConfig.testData.maliciousPayloads[attackType];
        const randomPayload = payloads[Math.floor(Math.random() * payloads.length)];

        return {
            httpMethod: 'POST',
            path: '/tasks',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'SecurityTestAgent/1.0',
                'X-Forwarded-For': '192.168.1.100'
            },
            body: JSON.stringify({
                title: randomPayload,
                description: `Test payload: ${attackType}`,
                maliciousField: randomPayload
            }),
            requestContext: {
                requestId: `test-${Date.now()}`,
                identity: {
                    sourceIp: '192.168.1.100'
                }
            }
        };
    }

    public createAuthenticatedRequest(userRole: 'admin' | 'contributor' | 'viewer', method: string = 'GET', path: string = '/tasks'): any {
        const user = this.getTestUser(userRole);
        const token = this.generateTestToken(user);

        return {
            httpMethod: method,
            path: path,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'User-Agent': 'SecurityTestAgent/1.0'
            },
            requestContext: {
                requestId: `test-${Date.now()}`,
                authorizer: {
                    claims: {
                        sub: user.userId,
                        email: user.email,
                        'cognito:groups': user.groups.join(',')
                    }
                },
                identity: {
                    sourceIp: '192.168.1.100'
                }
            }
        };
    }

    public generateTestToken(user: any): string {
        // In a real implementation, this would generate a proper JWT
        // For testing, we return a mock token
        return `test-token-${user.userId}-${Date.now()}`;
    }

    public simulateBruteForceAttack(targetEndpoint: string, credentials: any[]): any[] {
        const results = [];
        const scenario = this.getAttackScenario('bruteForce');

        for (let i = 0; i < scenario.maxAttempts + 2; i++) {
            const credential = credentials[i % credentials.length];
            const request = {
                httpMethod: 'POST',
                path: targetEndpoint,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BruteForceBot/1.0'
                },
                body: JSON.stringify(credential),
                requestContext: {
                    requestId: `brute-force-${i}`,
                    identity: {
                        sourceIp: '192.168.1.200'
                    }
                },
                attempt: i + 1
            };

            results.push(request);
        }

        return results;
    }

    public simulateRateLimitAttack(targetEndpoint: string): any[] {
        const results = [];
        const scenario = this.getAttackScenario('rateLimiting');

        for (let i = 0; i < scenario.maxRequestsPerMinute + 10; i++) {
            const request = {
                httpMethod: 'GET',
                path: targetEndpoint,
                headers: {
                    'User-Agent': 'RateLimitBot/1.0'
                },
                requestContext: {
                    requestId: `rate-limit-${i}`,
                    identity: {
                        sourceIp: '192.168.1.201'
                    }
                },
                timestamp: Date.now() + (i * 100) // Spread requests over time
            };

            results.push(request);
        }

        return results;
    }

    public createPenetrationTestSuite(): any {
        return {
            authenticationTests: [
                {
                    name: 'Weak Password Test',
                    type: 'authentication',
                    payload: { email: 'test@example.com', password: 'weak' }
                },
                {
                    name: 'SQL Injection in Login',
                    type: 'authentication',
                    payload: { email: "admin'--", password: 'anything' }
                },
                {
                    name: 'Brute Force Protection',
                    type: 'authentication',
                    payload: this.simulateBruteForceAttack('/auth/login', [
                        { email: 'admin@example.com', password: 'password' },
                        { email: 'admin@example.com', password: '123456' },
                        { email: 'admin@example.com', password: 'admin' }
                    ])
                }
            ],
            authorizationTests: [
                {
                    name: 'Privilege Escalation Test',
                    type: 'authorization',
                    user: this.getTestUser('viewer'),
                    action: 'DELETE',
                    resource: '/tasks/test-task-001'
                },
                {
                    name: 'Horizontal Privilege Escalation',
                    type: 'authorization',
                    user: this.getTestUser('contributor'),
                    action: 'GET',
                    resource: '/tasks/other-user-task'
                }
            ],
            inputValidationTests: [
                {
                    name: 'XSS Attack Test',
                    type: 'input_validation',
                    payloads: this.getTestData('maliciousPayloads').xss
                },
                {
                    name: 'SQL Injection Test',
                    type: 'input_validation',
                    payloads: this.getTestData('maliciousPayloads').sqlInjection
                },
                {
                    name: 'Command Injection Test',
                    type: 'input_validation',
                    payloads: this.getTestData('maliciousPayloads').commandInjection
                }
            ],
            sessionManagementTests: [
                {
                    name: 'Session Fixation Test',
                    type: 'session_management',
                    scenario: this.getAttackScenario('sessionFixation')
                },
                {
                    name: 'Token Expiration Test',
                    type: 'session_management',
                    tokens: this.getTestData('testTokens')
                }
            ],
            networkSecurityTests: [
                {
                    name: 'CORS Policy Test',
                    type: 'network_security',
                    origins: ['https://malicious.com', 'http://localhost:3000', 'null']
                },
                {
                    name: 'Rate Limiting Test',
                    type: 'network_security',
                    requests: this.simulateRateLimitAttack('/api/tasks')
                }
            ]
        };
    }

    public generateSecurityReport(testResults: any[]): string {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests: testResults.length,
                passed: testResults.filter(r => r.status === 'passed').length,
                failed: testResults.filter(r => r.status === 'failed').length,
                warnings: testResults.filter(r => r.status === 'warning').length
            },
            vulnerabilities: testResults.filter(r => r.status === 'failed').map(r => ({
                test: r.name,
                severity: r.severity || 'medium',
                description: r.description,
                recommendation: r.recommendation
            })),
            recommendations: [
                'Implement additional input validation for detected vulnerabilities',
                'Review and strengthen authentication mechanisms',
                'Enhance monitoring and alerting for security events',
                'Conduct regular security assessments'
            ]
        };

        const reportPath = path.join(this.testDataPath, `security-report-${Date.now()}.json`);
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        return reportPath;
    }

    public cleanup(): void {
        // Clean up test data and reset environment
        if (fs.existsSync(this.testDataPath)) {
            const files = fs.readdirSync(this.testDataPath);
            files.forEach(file => {
                if (file.startsWith('security-report-')) {
                    fs.unlinkSync(path.join(this.testDataPath, file));
                }
            });
        }

        // Reset mock services
        this.mockServices.forEach(service => {
            Object.keys(service).forEach(method => {
                if (typeof service[method].mockReset === 'function') {
                    service[method].mockReset();
                }
            });
        });

        // Reset environment variables
        delete process.env.JWT_SECRET;
        delete process.env.ENCRYPTION_KEY;
    }

    public validateTestEnvironment(): boolean {
        try {
            // Check if all required directories exist
            if (!fs.existsSync(this.testDataPath)) {
                console.error('Test data directory does not exist');
                return false;
            }

            // Check if test configuration is valid
            if (!this.securityConfig.testUsers || !this.securityConfig.testData) {
                console.error('Invalid security test configuration');
                return false;
            }

            // Check if mock services are properly initialized
            if (this.mockServices.size === 0) {
                console.error('Mock services not initialized');
                return false;
            }

            // Validate test data integrity
            const requiredFiles = ['test-users.json', 'test-tasks.json', 'malicious-payloads.json'];
            for (const file of requiredFiles) {
                const filePath = path.join(this.testDataPath, file);
                if (!fs.existsSync(filePath)) {
                    console.error(`Required test file missing: ${file}`);
                    return false;
                }
            }

            console.log('✅ Security test environment validation passed');
            return true;
        } catch (error) {
            console.error('Security test environment validation failed:', error);
            return false;
        }
    }
}

// Export singleton instance
export const securityTestEnv = SecurityTestEnvironment.getInstance();