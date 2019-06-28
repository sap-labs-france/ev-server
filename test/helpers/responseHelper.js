module.exports = function(chai, utils) {
  const Assertion = chai.Assertion;

  utils.addProperty(Assertion.prototype, 'validTransaction', function() {
    const obj = this._obj;
    // First, our instanceof check, shortcut
    new Assertion(this._obj).to.be.instanceof(Object);
    new Assertion(this._obj).to.be.not.null;
    new Assertion(this._obj.data).to.not.be.null;

    // Second, our type check
    this.assert(
      obj.data.transactionId > 0
      , 'expected transactionId to be above #{exp} but got #{act}'
      , 'expected transactionId to not be above #{act}'
      , 1
      , obj.data.transactionId
    );
  });

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

  utils.addProperty(Assertion.prototype, 'transactionAccepted', function() {
    const obj = this._obj;
    // First, our instanceof check, shortcut
    //console.log(obj);
    new Assertion(this._obj).to.be.transaction;
    // Second, our type check
    this.assert(
      obj.data.idTagInfo.status === 'Accepted'
      , 'expected idTagInfo.status to be #{exp} but got #{act}'
      , 'expected idTagInfo to not be #{act}'
      , 'Accepted'
      , obj.data.idTagInfo.status
    );
  });

  utils.addProperty(Assertion.prototype, 'transactionValid', function() {
    const obj = this._obj;
    // First, our instanceof check, shortcut
    new Assertion(this._obj).to.be.transactionAccepted;
    // Second, our type check
    this.assert(
      obj.data.transactionId > 1
      , 'expected transactionId to be above #{exp} but got #{act}'
      , 'expected transactionId to not be above #{act}'
      , 1
      , obj.data.transactionId
    );
  });


};
