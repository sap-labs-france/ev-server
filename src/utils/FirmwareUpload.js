const assert = require('assert');
const fs = require('fs');
const mongodb = require('mongodb');

const db = '';
const mongoURI = `mongodb+srv://<user>:<password>@evse-xoo6t.mongodb.net/${db}?retryWrites=true&w=majority`;
const bucketName = 'default.firmwares'

const args = process.argv.slice(2);
const firmwareFile = args[0];

if (!firmwareFile) {
  console.log('Firmware file CLI argument not provided')
} else if (fs.existsSync(firmwareFile)) {
  // Connect to MongoDB
  mongodb.MongoClient.connect(mongoURI,
    { useUnifiedTopology: true },
    (error, client) => {
      assert.ifError(error);
      // Create the read stream
      const readStream = fs.createReadStream(firmwareFile);
      // Get the bucket
      const bucket = new mongodb.GridFSBucket(client.db(db), { bucketName: bucketName });
      // Put the file
      const uploadStream = bucket.openUploadStream(firmwareFile);
      uploadStream.on('error', (error) => {
        assert.ifError(error);
      })
      uploadStream.once('finish', () => {
        console.log(`Firmware file '${firmwareFile}' uploaded to GridFSBucket`);
        process.exit(0);
      });
      readStream.pipe(uploadStream);
    }
  );
} else {
  console.log(`Firmware file '${firmwareFile}' does not exist`);
}

