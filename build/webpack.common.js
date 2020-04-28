const nodeExternals = require('webpack-node-externals');
const commonPaths = require('./webpack.common.paths');
const webpack = require('webpack');
const WebpackShellPlugin = require('webpack-shell-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');

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
    filename: 'start.js',
    path: commonPaths.outputPath
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.json']
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: [/node_modules/, /\.git/]
      }
    ]
  },
  plugins: [
    new WebpackShellPlugin({ onBuildStart: ['node src/componentsExport.js'] }),
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
    minimize: false,
    minimizer: [new TerserPlugin()]
  }
};

module.exports = config;
