const nodeExternals = require('webpack-node-externals');
const commonPaths = require('./webpack.common.paths');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

const config = {
  entry: commonPaths.srcPath + '/start.ts',
  devtool: 'source-map',
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
    filename: './start.js',
    path: commonPaths.outputPath
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.json']
  },
  module: {
    rules: [
      { test: /\.(t|j)sx?$/, use: 'ts-loader', exclude: /node_modules/ }
    ]
  },
  plugins: [
    new webpack.WatchIgnorePlugin([
      /\.js$/,
      /\.d\.ts$/
    ]),
    new webpack.ProgressPlugin(),
    new CopyPlugin([
      { from: 'src/assets/', to: 'assets/', ignore: ['**/configs/**'] }
    ])
  ],
  optimization: {
    minimizer: [
      new TerserPlugin({
        sourceMap: true,
        parallel: true,
        cache: true,
      }),
    ],
  }
};

module.exports = config;
