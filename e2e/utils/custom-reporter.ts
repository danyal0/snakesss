import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import * as fs from 'fs';
import * as path from 'path';

interface CoverageEntry {
  testId: string;
  passed: boolean;
}

class SnakesssReporter implements Reporter {
  private coverage: CoverageEntry[] = [];
  private failures: Array<{ title: string; errors: string[] }> = [];

  onBegin(_config: FullConfig, _suite: Suite): void {
    const dir = path.join(process.cwd(), 'e2e/report');
    fs.mkdirSync(dir, { recursive: true });
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.coverage.push({
      testId: test.id,
      passed: result.status === 'passed',
    });
    if (result.status !== 'passed') {
      this.failures.push({
        title: test.title,
        errors: result.errors.map((e) => e.message ?? String(e)),
      });
    }
  }

  onEnd(result: FullResult): void {
    const reportDir = path.join(process.cwd(), 'e2e/report');
    fs.mkdirSync(reportDir, { recursive: true });

    const summary = {
      status: result.status,
      passed: this.coverage.filter((c) => c.passed).length,
      total: this.coverage.length,
      failures: this.failures,
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(reportDir, 'summary.json'),
      JSON.stringify(summary, null, 2)
    );

    const heatmap = this.coverage.reduce(
      (acc, c) => {
        acc[c.testId] = c.passed ? 1 : 0;
        return acc;
      },
      {} as Record<string, number>
    );
    fs.writeFileSync(
      path.join(reportDir, 'interaction-heatmap.json'),
      JSON.stringify(heatmap, null, 2)
    );

    fs.writeFileSync(
      path.join(reportDir, 'ui-coverage.json'),
      JSON.stringify(
        {
          elements: [
            'home-screen',
            'lobby-screen',
            'game-screen',
            'chat-panel',
            'public-rooms-screen',
            'leaderboard-screen',
            'admin-login-screen',
            'admin-dashboard',
          ],
          tested: this.coverage.filter((c) => c.passed).length,
        },
        null,
        2
      )
    );
  }
}

export default SnakesssReporter;
