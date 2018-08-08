class DummyTask {
	migrate(config={}) {
		for (let index = 0; index < 100000000; index++) {
		}
	}

	getVersion() {
		return "1";
	}

	getName() {
		return "DummyTask";
	}
}
module.exports=DummyTask;
