/**
 * Class used by Jest runner, to display usefull information when test cases are performed
 * Currently Jest is not able to nativly handle a custom reporter written in TS, please migrate when it does !
 */
class JestEvseReporter {
  testInError = [];
  testInSuccess = [];
  testInUnknown = [];

  /**
   * Note there are other hoocks that we could override, please check base reporter implementation:
   * https://github.com/facebook/jest/blob/fb10f7a95161f3d93ec54be3b3f69359913b5691/packages/jest-cli/src/reporters/base_reporter.js
   */
  onTestStart(test) {
    this.log(`\nRunning: ${test.path}`);
  }

  onTestCaseResult(test, testCaseResult) {
    const testPrintmessage = testCaseResult.title;
    if (testCaseResult.status === 'passed') {
      this.testInSuccess.push(testCaseResult);
      this.log('\x1b[32m \u2713 \x1b[0m' + testPrintmessage + this.getReportMessage());
    } else if (testCaseResult.status === 'failed') {
      this.log('');
      this.testInError.push(testCaseResult);
      this.log(testCaseResult.fullName);
      this.log(testCaseResult.failureMessages);
      this.log('\x1b[31m \u2717 \x1b[0m' + testPrintmessage + this.getReportMessage());
      this.log('');
      this.log('#### Stack associated to this error is above ! ####');
      this.log('\n');
    } else {
      this.testInUnknown.push(testCaseResult);
      this.log('\u25E6  ' + testPrintmessage + this.getReportMessage());
    }
  }

  getReportMessage() {
    if (this.testInError.length > 0) {
      return (
        ' #### Errors detected [' +
        this.testInSuccess.length +
        ' OK, ' +
        this.testInError.length +
        ' ERR, ' +
        this.testInUnknown.length +
        ' UNK' +
        ']'
      );
    }
    return '';
  }

  log(message) {
    console.log(message);
  }
}

module.exports = JestEvseReporter;
