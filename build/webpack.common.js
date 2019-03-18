const nodeExternals = require('webpack-node-externals');
const commonPaths = require('./webpack.common.paths');
const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const JavaScriptObfuscator = require('webpack-obfuscator');
const CopyPlugin = require('copy-webpack-plugin');

const config = {
  entry: commonPaths.srcPath + "/start.js",
  target: 'node',
  node: {
    console: false,
    global: false,
    process: false,
    Buffer: false,
    __filename: false,
    __dirname: false
  },
  externals: [nodeExternals()],
  output: {
    filename: "start.js",
    path: commonPaths.outputPath
  },
  module: {
    rules: [
    ]
  },
  plugins: [
    new webpack.ProgressPlugin(),
    new UglifyJSPlugin({
      sourceMap: true
    }),
    new JavaScriptObfuscator ({
      rotateUnicodeArray: true
    }, []),
    new CopyPlugin([
      {from: 'src/assets/', to: 'assets/', ignore: ['**/configs/**']}
    ])
  ]
};

module.exports = config;
