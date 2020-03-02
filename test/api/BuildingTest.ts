import chai from 'chai';
import chaiSubset from 'chai-subset';
import ContextProvider from './contextProvider/ContextProvider';

chai.use(chaiSubset);

class TestData {
}

const testData: TestData = new TestData();

describe('Building Test', function() {
  this.timeout(1000000); // Will automatically stop the unit test after that period of time

  before(async () => {
    chai.config.includeStack = true;
    await ContextProvider.DefaultInstance.prepareContexts();
  })
});

