declare module Chai {
  interface Assertion {
    transaction(expected: any): Assertion;
    transactionValid(expected: any): Assertion;

    transactionStatus(expectedStatus: string): void;
  }
}
