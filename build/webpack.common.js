
const nodeExternals = require('webpack-node-externals');
const commonPaths = require('./webpack.common.paths');
const webpack = require('webpack');
const CopyPlugin = require('copy-webpack-plugin');

const config = {
  entry: commonPaths.srcPath + '/start.ts',
  devtool: 'source-map',
  target: 'node',
  node: {
    global: false,
    __filename: false,
    __dirname: false
  },
  externals: [nodeExternals()],
  output: {
    filename: 'start.js',
    path: commonPaths.outputPath
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.json']
  },
  plugins: [
    new webpack.WatchIgnorePlugin({
      paths: [
        /\.js$/,
        /\.d\.ts$/
       ]
    }),
    new webpack.ProgressPlugin(),
    new CopyPlugin({
      patterns: [
        { from: 'src/assets/', to: 'assets/' }
      ]
    })
  ],
  optimization: {
    minimize: false,
  },
};

module.exports = config;
