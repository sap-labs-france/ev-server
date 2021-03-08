#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mongodb = require('mongodb');

const db = '';
const mongoURI = `mongodb+srv://<user>:<password>@evse-xoo6t.mongodb.net/${db}?retryWrites=true&w=majority`;
const bucketName = 'default.firmwares'

const args = process.argv.slice(2);
const cmd = args[0];
const firmwareFile = args[1];

function putFirmwareFile(firmwareFile) {
  if (!firmwareFile) {
    console.error('Firmware file CLI argument not provided')
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
        const uploadStream = bucket.openUploadStream(path.basename(firmwareFile));
        uploadStream.on('error', (error) => {
          assert.ifError(error);
        })
        uploadStream.on('finish', () => {
          console.log(`Firmware file '${firmwareFile}' uploaded to GridFSBucket as ${path.basename(firmwareFile)}`);
          process.exit(0);
        });
        readStream.pipe(uploadStream);
      }
    );
  } else {
    console.error(`Firmware file '${firmwareFile}' does not exist`);
  }
}

function getFirmwareFile(firmwareFile) {
  if (!firmwareFile) {
    console.error('Firmware file CLI argument not provided')
  } else {
    // Connect to MongoDB
    mongodb.MongoClient.connect(mongoURI,
      { useUnifiedTopology: true },
      (error, client) => {
        assert.ifError(error);
        // Create the write stream
        const writeStream = fs.createWriteStream(firmwareFile);
        writeStream.on('error', (error) => {
          assert.ifError(error);
        })
        writeStream.on('finish', () => {
          console.log(`Firmware file '${firmwareFile}' downloaded`);
          process.exit(0);
        });
        // Get the bucket
        const bucket = new mongodb.GridFSBucket(client.db(db), { bucketName: bucketName });
        const downloadStream = bucket.openDownloadStreamByName(firmwareFile);
        downloadStream.pipe(writeStream);
      }
    );
  }
}

function deleteFirmwareFile(firmwareFileID) {
  if (!firmwareFileID) {
    console.error('Firmware file CLI argument not provided')
  } else {
    // Connect to MongoDB
    mongodb.MongoClient.connect(mongoURI,
      { useUnifiedTopology: true },
      (error, client) => {
        assert.ifError(error);
        // Get the bucket
        const bucket = new mongodb.GridFSBucket(client.db(db), { bucketName: bucketName });
        bucket.delete(mongodb.ObjectID(firmwareFileID), (error) => {
          assert.ifError(error);
          console.log(`Firmware file with ID ${firmwareFileID} deleted`);
          process.exit(0);
        });
      }
    );
  }
}

switch (cmd) {
  case 'put':
    putFirmwareFile(firmwareFile);
    break;
  case 'get':
    getFirmwareFile(firmwareFile);
    break;
  case 'delete':
    deleteFirmwareFile(firmwareFile);
    break;
  default:
    console.log(`Usage: - ./FirmwareUpload.js (put|get) <file>
       - ./FirmwareUpload.js delete <file id>`)
}
