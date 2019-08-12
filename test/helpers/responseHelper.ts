declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  export namespace Chai {
    interface Assertion {
      transaction(expected: any): Assertion;
      transactionValid(expected: any): Assertion;
      transactionStatus(expectedStatus: string): void;
      validatedSetting(identifier: string, type: string): void;
    }
  }
}

export default function(chai, utils) {
  const Assertion = chai.Assertion;

  utils.addProperty(Assertion.prototype, 'transaction', function() {
    const obj = this._obj;
    // First, our instanceof check, shortcut
    new Assertion(this._obj).to.be.instanceof(Object);
    new Assertion(this._obj).to.be.not.null;
    new Assertion(this._obj.data).to.not.be.null;
    // Second, our type check
    this.assert(
      obj.data.idTagInfo instanceof Object
      , 'expected idTagInfo to be #{exp} but got #{act}'
      , 'expected idTagInfo to not be above #{act}'
      , 'Object'
      , obj.data
    );
  });

  utils.addProperty(Assertion.prototype, 'transactionValid', function() {
    const obj = this._obj;
    // First, our instanceof check, shortcut
    new Assertion(this._obj).to.be.transactionStatus('Accepted');
    // Second, our type check
    this.assert(
      obj.data.transactionId > 1
      , 'expected transactionId to be above #{exp} but got #{act}'
      , 'expected transactionId to not be above #{act}'
      , 1
      , obj.data.transactionId
    );
  });

  Assertion.addMethod('transactionStatus', function(expectedStatus) {
    const obj = this._obj;
    // First, our instanceof check, shortcut
    new Assertion(this._obj).to.be.transaction;
    // Second, our type check
    this.assert(
      obj.data.idTagInfo.status === expectedStatus
      , 'expected idTagInfo.status to be #{exp} but got #{act}'
      , 'expected idTagInfo to not be #{act}'
      , expectedStatus
      , obj.data.idTagInfo.status
    );
  });

  Assertion.addMethod('validatedSetting', function(identifier, type) {
    // First, our instanceof check, shortcut
    new Assertion(this._obj).to.be.instanceof(Object);
    new Assertion(this._obj).to.be.not.null;
    // Second, our type check
    // To be completed
    new Assertion(this._obj).to.have.property('id');
    new Assertion(this._obj).to.have.property('identifier');
    new Assertion(this._obj).to.have.property('sensitiveData');
    new Assertion(this._obj).to.have.property('content');
    new Assertion(this._obj.identifier).to.equal(identifier);
    if (type) {
      new Assertion(this._obj.content).to.have.property('type');
      new Assertion(this._obj.content.type).to.equal(type);
    }
  });
};
