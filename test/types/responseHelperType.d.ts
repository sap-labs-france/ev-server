declare module Chai {
  interface Assertion {
    isTransaction(expected: any): Assertion;
    transactionValid(expected: any): Assertion;
  }
}
