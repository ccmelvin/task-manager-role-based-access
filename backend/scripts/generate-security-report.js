#!/usr/bin/env node

/**
 * Security Test Report Generator
 * Processes security test results and generates comprehensive reports
 */

const fs = require('fs');
const path = require('path');

class SecurityReportGenerator {
  constructor() {
    this.reportTemplate = {
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        generator: 'SecurityReportGenerator'
      },
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        warnings: 0,
        skipped: 0,
        duration: 0
      },
      vulnerabilities: {
        critical: [],
        high: [],
        medium: [],
        low: [],
        info: []
      },
      compliance: {
        owasp: {
          score: 0,
          details: {}
        },
        nist: {
          score: 0,
          details: {}
        },
        gdpr: {
          score: 0,
          details: {}
        }
      },
      recommendations: [],
      trends: {
        previousReports: [],
        improvements: [],
        regressions: []
      }
    };
  }

  async generateReport(testResultsPath, outputPath = null) {
    try {
      console.log('🔍 Generating security report...');
      
      // Load test results
      const testResults = this.loadTestResults(testResultsPath);
      
      // Process results
      const report = this.processTestResults(testResults);
      
      // Generate recommendations
      report.recommendations = this.generateRecommendations(report);
      
      // Calculate compliance scores
      report.compliance = this.calculateComplianceScores(report);
      
      // Add trend analysis if previous reports exist
      report.trends = await this.analyzeTrends(report);
      
      // Generate output files
      const outputDir = outputPath || path.join(__dirname, '../reports');
      await this.generateOutputFiles(report, outputDir);
      
      console.log('✅ Security report generated successfully');
      return report;
      
    } catch (error) {
      console.error('❌ Error generating security report:', error);
      throw error;
    }
  }

  loadTestResults(testResultsPath) {
    if (!fs.existsSync(testResultsPath)) {
      throw new Error(`Test results file not found: ${testResultsPath}`);
    }

    const rawData = fs.readFileSync(testResultsPath, 'utf8');
    
    try {
      return JSON.parse(rawData);
    } catch (error) {
      throw new Error(`Invalid JSON in test results file: ${error.message}`);
    }
  }

  processTestResults(testResults) {
    const report = JSON.parse(JSON.stringify(this.reportTemplate));
    
    // Process Jest test results
    if (testResults.testResults) {
      this.processJestResults(testResults, report);
    }
    
    // Process custom security test results
    if (testResults.securityTests) {
      this.processSecurityTests(testResults.securityTests, report);
    }
    
    // Process dependency audit results
    if (testResults.auditResults) {
      this.processAuditResults(testResults.auditResults, report);
    }
    
    // Process infrastructure security results
    if (testResults.infrastructureResults) {
      this.processInfrastructureResults(testResults.infrastructureResults, report);
    }
    
    return report;
  }

  processJestResults(testResults, report) {
    report.summary.totalTests = testResults.numTotalTests || 0;
    report.summary.passed = testResults.numPassedTests || 0;
    report.summary.failed = testResults.numFailedTests || 0;
    report.summary.skipped = testResults.numPendingTests || 0;
    report.summary.duration = testResults.testResults.reduce((total, result) => 
      total + (result.perfStats?.end - result.perfStats?.start || 0), 0);

    // Process individual test results
    testResults.testResults.forEach(testFile => {
      testFile.assertionResults.forEach(test => {
        if (test.status === 'failed') {
          const vulnerability = this.createVulnerabilityFromTest(test, testFile);
          this.categorizeVulnerability(vulnerability, report);
        }
      });
    });
  }

  processSecurityTests(securityTests, report) {
    securityTests.forEach(test => {
      if (test.status === 'failed' || test.vulnerabilities) {
        const vulnerabilities = test.vulnerabilities || [test];
        vulnerabilities.forEach(vuln => {
          const vulnerability = this.normalizeVulnerability(vuln);
          this.categorizeVulnerability(vulnerability, report);
        });
      }
    });
  }

  processAuditResults(auditResults, report) {
    if (auditResults.advisories) {
      Object.values(auditResults.advisories).forEach(advisory => {
        const vulnerability = {
          id: advisory.id,
          title: advisory.title,
          severity: this.mapAuditSeverity(advisory.severity),
          description: advisory.overview,
          cwe: advisory.cwe,
          cvss: advisory.cvss,
          references: advisory.references,
          recommendation: advisory.recommendation,
          affectedPackages: advisory.findings?.map(f => f.paths).flat() || [],
          type: 'dependency'
        };
        
        this.categorizeVulnerability(vulnerability, report);
      });
    }
  }

  processInfrastructureResults(infraResults, report) {
    infraResults.forEach(result => {
      if (result.status === 'failed') {
        const vulnerability = {
          id: `INFRA-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          title: result.title || 'Infrastructure Security Issue',
          severity: result.severity || 'medium',
          description: result.description || result.message,
          recommendation: result.recommendation || 'Review infrastructure configuration',
          type: 'infrastructure',
          resource: result.resource,
          service: result.service
        };
        
        this.categorizeVulnerability(vulnerability, report);
      }
    });
  }

  createVulnerabilityFromTest(test, testFile) {
    const severity = this.extractSeverityFromTest(test);
    const owaspCategory = this.extractOwaspCategory(test.title);
    
    return {
      id: `TEST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: test.title,
      severity: severity,
      description: test.failureMessages?.join('\n') || 'Test failed',
      testFile: testFile.name,
      type: 'security_test',
      owaspCategory: owaspCategory,
      recommendation: this.generateTestRecommendation(test, owaspCategory)
    };
  }

  normalizeVulnerability(vuln) {
    return {
      id: vuln.id || `VULN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: vuln.title || vuln.name || 'Security Vulnerability',
      severity: vuln.severity || 'medium',
      description: vuln.description || vuln.message || 'No description available',
      cwe: vuln.cwe,
      cvss: vuln.cvss,
      recommendation: vuln.recommendation || vuln.fix || 'Review and remediate',
      type: vuln.type || 'unknown'
    };
  }

  categorizeVulnerability(vulnerability, report) {
    const severity = vulnerability.severity.toLowerCase();
    
    switch (severity) {
      case 'critical':
        report.vulnerabilities.critical.push(vulnerability);
        break;
      case 'high':
        report.vulnerabilities.high.push(vulnerability);
        break;
      case 'medium':
        report.vulnerabilities.medium.push(vulnerability);
        break;
      case 'low':
        report.vulnerabilities.low.push(vulnerability);
        break;
      default:
        report.vulnerabilities.info.push(vulnerability);
    }
  }

  extractSeverityFromTest(test) {
    const title = test.title.toLowerCase();
    
    if (title.includes('critical') || title.includes('rce') || title.includes('sql injection')) {
      return 'critical';
    } else if (title.includes('high') || title.includes('xss') || title.includes('auth')) {
      return 'high';
    } else if (title.includes('medium') || title.includes('csrf') || title.includes('validation')) {
      return 'medium';
    } else if (title.includes('low') || title.includes('info') || title.includes('disclosure')) {
      return 'low';
    }
    
    return 'medium';
  }

  extractOwaspCategory(testTitle) {
    const title = testTitle.toLowerCase();
    
    if (title.includes('access control') || title.includes('authorization')) {
      return 'A01:2021-Broken Access Control';
    } else if (title.includes('crypto') || title.includes('encryption')) {
      return 'A02:2021-Cryptographic Failures';
    } else if (title.includes('injection') || title.includes('xss') || title.includes('sql')) {
      return 'A03:2021-Injection';
    } else if (title.includes('design') || title.includes('business logic')) {
      return 'A04:2021-Insecure Design';
    } else if (title.includes('misconfiguration') || title.includes('headers')) {
      return 'A05:2021-Security Misconfiguration';
    } else if (title.includes('component') || title.includes('dependency')) {
      return 'A06:2021-Vulnerable and Outdated Components';
    } else if (title.includes('authentication') || title.includes('session')) {
      return 'A07:2021-Identification and Authentication Failures';
    } else if (title.includes('integrity') || title.includes('tampering')) {
      return 'A08:2021-Software and Data Integrity Failures';
    } else if (title.includes('logging') || title.includes('monitoring')) {
      return 'A09:2021-Security Logging and Monitoring Failures';
    } else if (title.includes('ssrf') || title.includes('request forgery')) {
      return 'A10:2021-Server-Side Request Forgery';
    }
    
    return 'Unknown';
  }

  generateTestRecommendation(test, owaspCategory) {
    const recommendations = {
      'A01:2021-Broken Access Control': 'Implement proper authorization checks and role-based access control',
      'A02:2021-Cryptographic Failures': 'Use strong encryption algorithms and proper key management',
      'A03:2021-Injection': 'Implement input validation and parameterized queries',
      'A04:2021-Insecure Design': 'Review application design and implement security controls',
      'A05:2021-Security Misconfiguration': 'Review and harden security configurations',
      'A06:2021-Vulnerable and Outdated Components': 'Update dependencies and scan for vulnerabilities',
      'A07:2021-Identification and Authentication Failures': 'Strengthen authentication mechanisms',
      'A08:2021-Software and Data Integrity Failures': 'Implement integrity checks and validation',
      'A09:2021-Security Logging and Monitoring Failures': 'Enhance logging and monitoring capabilities',
      'A10:2021-Server-Side Request Forgery': 'Validate and sanitize URLs and implement allowlists'
    };
    
    return recommendations[owaspCategory] || 'Review and remediate the identified security issue';
  }

  generateRecommendations(report) {
    const recommendations = [];
    
    // Critical and high severity recommendations
    const criticalCount = report.vulnerabilities.critical.length;
    const highCount = report.vulnerabilities.high.length;
    
    if (criticalCount > 0) {
      recommendations.push({
        priority: 'immediate',
        category: 'critical_vulnerabilities',
        title: `Address ${criticalCount} Critical Vulnerabilities`,
        description: 'Critical vulnerabilities pose immediate risk and should be addressed immediately',
        actions: [
          'Review and fix all critical vulnerabilities',
          'Consider disabling affected functionality if necessary',
          'Implement emergency patches',
          'Notify security team and stakeholders'
        ]
      });
    }
    
    if (highCount > 0) {
      recommendations.push({
        priority: 'high',
        category: 'high_vulnerabilities',
        title: `Remediate ${highCount} High Severity Vulnerabilities`,
        description: 'High severity vulnerabilities should be addressed within 7 days',
        actions: [
          'Prioritize high severity fixes',
          'Implement additional security controls',
          'Enhance monitoring for affected areas',
          'Update security documentation'
        ]
      });
    }
    
    // OWASP Top 10 recommendations
    const owaspIssues = this.analyzeOwaspCoverage(report);
    if (owaspIssues.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'owasp_compliance',
        title: 'Improve OWASP Top 10 Compliance',
        description: `Address issues in ${owaspIssues.length} OWASP categories`,
        actions: owaspIssues.map(issue => `Address ${issue} vulnerabilities`)
      });
    }
    
    // Dependency recommendations
    const depVulns = [...report.vulnerabilities.critical, ...report.vulnerabilities.high, ...report.vulnerabilities.medium]
      .filter(v => v.type === 'dependency');
    
    if (depVulns.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'dependency_security',
        title: 'Update Vulnerable Dependencies',
        description: `${depVulns.length} vulnerable dependencies found`,
        actions: [
          'Run npm audit fix to automatically fix vulnerabilities',
          'Manually update dependencies that cannot be automatically fixed',
          'Implement automated dependency scanning in CI/CD',
          'Establish dependency update policies'
        ]
      });
    }
    
    // Infrastructure recommendations
    const infraVulns = [...report.vulnerabilities.critical, ...report.vulnerabilities.high, ...report.vulnerabilities.medium]
      .filter(v => v.type === 'infrastructure');
    
    if (infraVulns.length > 0) {
      recommendations.push({
        priority: 'medium',
        category: 'infrastructure_security',
        title: 'Harden Infrastructure Configuration',
        description: `${infraVulns.length} infrastructure security issues found`,
        actions: [
          'Review and update CDK security configurations',
          'Implement infrastructure as code security scanning',
          'Enable additional AWS security services',
          'Regular infrastructure security assessments'
        ]
      });
    }
    
    // General security improvements
    recommendations.push({
      priority: 'low',
      category: 'security_improvements',
      title: 'Enhance Overall Security Posture',
      description: 'Continuous security improvements and best practices',
      actions: [
        'Implement regular security training for developers',
        'Establish security code review processes',
        'Enhance security monitoring and alerting',
        'Regular penetration testing and security assessments',
        'Maintain security documentation and runbooks'
      ]
    });
    
    return recommendations;
  }

  analyzeOwaspCoverage(report) {
    const owaspCategories = new Set();
    
    [...report.vulnerabilities.critical, ...report.vulnerabilities.high, ...report.vulnerabilities.medium]
      .forEach(vuln => {
        if (vuln.owaspCategory && vuln.owaspCategory !== 'Unknown') {
          owaspCategories.add(vuln.owaspCategory);
        }
      });
    
    return Array.from(owaspCategories);
  }

  calculateComplianceScores(report) {
    const totalVulns = Object.values(report.vulnerabilities).flat().length;
    const criticalVulns = report.vulnerabilities.critical.length;
    const highVulns = report.vulnerabilities.high.length;
    
    // OWASP compliance score (0-100)
    const owaspScore = Math.max(0, 100 - (criticalVulns * 25) - (highVulns * 10) - (totalVulns * 2));
    
    // NIST compliance score (simplified)
    const nistScore = Math.max(0, 100 - (criticalVulns * 20) - (highVulns * 8) - (totalVulns * 1.5));
    
    // GDPR compliance score (focused on data protection)
    const dataProtectionVulns = Object.values(report.vulnerabilities).flat()
      .filter(v => v.title.toLowerCase().includes('data') || 
                   v.title.toLowerCase().includes('privacy') ||
                   v.title.toLowerCase().includes('encryption'));
    const gdprScore = Math.max(0, 100 - (dataProtectionVulns.length * 15));
    
    return {
      owasp: {
        score: Math.round(owaspScore),
        details: {
          totalVulnerabilities: totalVulns,
          criticalVulnerabilities: criticalVulns,
          highVulnerabilities: highVulns,
          owaspCategoriesAffected: this.analyzeOwaspCoverage(report).length
        }
      },
      nist: {
        score: Math.round(nistScore),
        details: {
          identifyScore: Math.max(0, 100 - (criticalVulns * 10)),
          protectScore: Math.max(0, 100 - (highVulns * 15)),
          detectScore: Math.max(0, 100 - (totalVulns * 2)),
          respondScore: Math.max(0, 100 - (criticalVulns * 5)),
          recoverScore: Math.max(0, 100 - (criticalVulns * 8))
        }
      },
      gdpr: {
        score: Math.round(gdprScore),
        details: {
          dataProtectionVulnerabilities: dataProtectionVulns.length,
          encryptionIssues: dataProtectionVulns.filter(v => v.title.toLowerCase().includes('encryption')).length,
          privacyIssues: dataProtectionVulns.filter(v => v.title.toLowerCase().includes('privacy')).length
        }
      }
    };
  }

  async analyzeTrends(currentReport) {
    const reportsDir = path.join(__dirname, '../reports/history');
    const trends = {
      previousReports: [],
      improvements: [],
      regressions: []
    };
    
    if (!fs.existsSync(reportsDir)) {
      return trends;
    }
    
    try {
      const reportFiles = fs.readdirSync(reportsDir)
        .filter(file => file.endsWith('.json'))
        .sort()
        .slice(-5); // Last 5 reports
      
      for (const file of reportFiles) {
        const reportPath = path.join(reportsDir, file);
        const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
        trends.previousReports.push({
          date: report.metadata.generatedAt,
          summary: report.summary,
          vulnerabilityCount: Object.values(report.vulnerabilities).flat().length
        });
      }
      
      // Analyze improvements and regressions
      if (trends.previousReports.length > 0) {
        const lastReport = trends.previousReports[trends.previousReports.length - 1];
        const currentVulnCount = Object.values(currentReport.vulnerabilities).flat().length;
        
        if (currentVulnCount < lastReport.vulnerabilityCount) {
          trends.improvements.push(`Reduced vulnerabilities from ${lastReport.vulnerabilityCount} to ${currentVulnCount}`);
        } else if (currentVulnCount > lastReport.vulnerabilityCount) {
          trends.regressions.push(`Increased vulnerabilities from ${lastReport.vulnerabilityCount} to ${currentVulnCount}`);
        }
      }
      
    } catch (error) {
      console.warn('Could not analyze trends:', error.message);
    }
    
    return trends;
  }

  async generateOutputFiles(report, outputDir) {
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Generate JSON report
    const jsonPath = path.join(outputDir, `security-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    
    // Generate HTML report
    const htmlPath = path.join(outputDir, `security-report-${timestamp}.html`);
    const htmlContent = this.generateHtmlReport(report);
    fs.writeFileSync(htmlPath, htmlContent);
    
    // Generate CSV summary
    const csvPath = path.join(outputDir, `security-summary-${timestamp}.csv`);
    const csvContent = this.generateCsvSummary(report);
    fs.writeFileSync(csvPath, csvContent);
    
    // Generate markdown report
    const mdPath = path.join(outputDir, `security-report-${timestamp}.md`);
    const mdContent = this.generateMarkdownReport(report);
    fs.writeFileSync(mdPath, mdContent);
    
    // Save to history
    const historyDir = path.join(outputDir, 'history');
    if (!fs.existsSync(historyDir)) {
      fs.mkdirSync(historyDir, { recursive: true });
    }
    
    const historyPath = path.join(historyDir, `report-${timestamp}.json`);
    fs.writeFileSync(historyPath, JSON.stringify(report, null, 2));
    
    console.log(`📊 Reports generated:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  HTML: ${htmlPath}`);
    console.log(`  CSV:  ${csvPath}`);
    console.log(`  MD:   ${mdPath}`);
  }

  generateHtmlReport(report) {
    const vulnerabilityCount = Object.values(report.vulnerabilities).flat().length;
    const criticalCount = report.vulnerabilities.critical.length;
    const highCount = report.vulnerabilities.high.length;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e9ecef; padding: 15px; border-radius: 5px; text-align: center; }
        .critical { background: #dc3545; color: white; }
        .high { background: #fd7e14; color: white; }
        .medium { background: #ffc107; }
        .low { background: #28a745; color: white; }
        .vulnerability { margin: 10px 0; padding: 15px; border-left: 4px solid #ccc; }
        .recommendations { background: #d1ecf1; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Test Report</h1>
        <p>Generated: ${report.metadata.generatedAt}</p>
        <p>Total Tests: ${report.summary.totalTests} | Passed: ${report.summary.passed} | Failed: ${report.summary.failed}</p>
    </div>
    
    <div class="summary">
        <div class="metric critical">
            <h3>${criticalCount}</h3>
            <p>Critical</p>
        </div>
        <div class="metric high">
            <h3>${highCount}</h3>
            <p>High</p>
        </div>
        <div class="metric medium">
            <h3>${report.vulnerabilities.medium.length}</h3>
            <p>Medium</p>
        </div>
        <div class="metric low">
            <h3>${report.vulnerabilities.low.length}</h3>
            <p>Low</p>
        </div>
    </div>
    
    <h2>Compliance Scores</h2>
    <div class="summary">
        <div class="metric">
            <h3>${report.compliance.owasp.score}%</h3>
            <p>OWASP</p>
        </div>
        <div class="metric">
            <h3>${report.compliance.nist.score}%</h3>
            <p>NIST</p>
        </div>
        <div class="metric">
            <h3>${report.compliance.gdpr.score}%</h3>
            <p>GDPR</p>
        </div>
    </div>
    
    <h2>Critical Vulnerabilities</h2>
    ${report.vulnerabilities.critical.map(v => `
        <div class="vulnerability critical">
            <h4>${v.title}</h4>
            <p><strong>ID:</strong> ${v.id}</p>
            <p><strong>Description:</strong> ${v.description}</p>
            <p><strong>Recommendation:</strong> ${v.recommendation}</p>
        </div>
    `).join('')}
    
    <h2>Recommendations</h2>
    <div class="recommendations">
        ${report.recommendations.map(r => `
            <h4>${r.title} (${r.priority})</h4>
            <p>${r.description}</p>
            <ul>
                ${r.actions.map(action => `<li>${action}</li>`).join('')}
            </ul>
        `).join('')}
    </div>
</body>
</html>`;
  }

  generateCsvSummary(report) {
    const rows = [
      ['Metric', 'Value'],
      ['Generated At', report.metadata.generatedAt],
      ['Total Tests', report.summary.totalTests],
      ['Passed Tests', report.summary.passed],
      ['Failed Tests', report.summary.failed],
      ['Critical Vulnerabilities', report.vulnerabilities.critical.length],
      ['High Vulnerabilities', report.vulnerabilities.high.length],
      ['Medium Vulnerabilities', report.vulnerabilities.medium.length],
      ['Low Vulnerabilities', report.vulnerabilities.low.length],
      ['OWASP Score', report.compliance.owasp.score],
      ['NIST Score', report.compliance.nist.score],
      ['GDPR Score', report.compliance.gdpr.score]
    ];
    
    return rows.map(row => row.join(',')).join('\n');
  }

  generateMarkdownReport(report) {
    const vulnerabilityCount = Object.values(report.vulnerabilities).flat().length;
    
    return `# Security Test Report

**Generated:** ${report.metadata.generatedAt}

## Executive Summary

- **Total Tests:** ${report.summary.totalTests}
- **Passed:** ${report.summary.passed}
- **Failed:** ${report.summary.failed}
- **Total Vulnerabilities:** ${vulnerabilityCount}

## Vulnerability Summary

| Severity | Count |
|----------|-------|
| Critical | ${report.vulnerabilities.critical.length} |
| High     | ${report.vulnerabilities.high.length} |
| Medium   | ${report.vulnerabilities.medium.length} |
| Low      | ${report.vulnerabilities.low.length} |

## Compliance Scores

| Framework | Score |
|-----------|-------|
| OWASP     | ${report.compliance.owasp.score}% |
| NIST      | ${report.compliance.nist.score}% |
| GDPR      | ${report.compliance.gdpr.score}% |

## Critical Vulnerabilities

${report.vulnerabilities.critical.map(v => `
### ${v.title}

**ID:** ${v.id}
**Severity:** Critical
**Description:** ${v.description}
**Recommendation:** ${v.recommendation}
`).join('\n')}

## Recommendations

${report.recommendations.map(r => `
### ${r.title} (${r.priority.toUpperCase()})

${r.description}

**Actions:**
${r.actions.map(action => `- ${action}`).join('\n')}
`).join('\n')}

## Trends

${report.trends.improvements.length > 0 ? `
**Improvements:**
${report.trends.improvements.map(i => `- ${i}`).join('\n')}
` : ''}

${report.trends.regressions.length > 0 ? `
**Regressions:**
${report.trends.regressions.map(r => `- ${r}`).join('\n')}
` : ''}
`;
  }

  mapAuditSeverity(severity) {
    const mapping = {
      'critical': 'critical',
      'high': 'high',
      'moderate': 'medium',
      'low': 'low',
      'info': 'info'
    };
    
    return mapping[severity] || 'medium';
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node generate-security-report.js <test-results-file> [output-directory]');
    process.exit(1);
  }
  
  const generator = new SecurityReportGenerator();
  generator.generateReport(args[0], args[1])
    .then(report => {
      console.log('Report generation completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Report generation failed:', error);
      process.exit(1);
    });
}

module.exports = SecurityReportGenerator;