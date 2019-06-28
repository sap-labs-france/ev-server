module.exports = function (chai, utils) {
  var Assertion = chai.Assertion;

  utils.addProperty(Assertion.prototype, 'transaction', function () {
    const obj = this._obj;
    // first, our instanceof check, shortcut
    new Assertion(this._obj).to.be.instanceof(Object);
    new Assertion(this._obj).to.be.not.null;
    new Assertion(this._obj.data).to.not.be.null;
    // second, our type check
    this.assert(
      obj.data.idTagInfo instanceof Object
      , "expected idTagInfo to be #{exp} but got #{act}"
      , "expected idTagInfo to not be above #{act}"
      , "Object"
      , obj.data
    );
  });

  utils.addProperty(Assertion.prototype, 'transactionValid', function () {
    const obj = this._obj;
    // first, our instanceof check, shortcut
    new Assertion(this._obj).to.be.transactionAccepted;
    // second, our type check
    this.assert(
      obj.data.transactionId > 1
      , "expected transactionId to be above #{exp} but got #{act}"
      , "expected transactionId to not be above #{act}"
      , 1
      , obj.data.transactionId
    );
  });

  Assertion.addMethod('transactionStatus', function (expectedStatus) {
    const obj = this._obj;
    // first, our instanceof check, shortcut
    new Assertion(this._obj).to.be.transaction;
    // second, our type check
    this.assert(
      obj.data.idTagInfo.status === expectedStatus
      , "expected idTagInfo.status to be #{exp} but got #{act}"
      , "expected idTagInfo to not be #{act}"
      , expectedStatus
      , obj.data.idTagInfo.status
    );

  });

};
