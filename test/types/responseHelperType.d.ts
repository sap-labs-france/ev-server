declare namespace Chai {
  interface Assertion {
    isTransaction(expected: any): Assertion;
    transactionValid(expected: any): Assertion;
  }
}
