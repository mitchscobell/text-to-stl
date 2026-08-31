const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  context: path.resolve(__dirname),

  mode: "production",

  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.(png|jpg|jpeg)$/,
        use: "url-loader",
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      chunks: ["index"],
      filename: "index.html",
      inject: "body",
      title: "Text to STL",
      favicon: "./src/images/favicon.svg",
    }),
    new CopyPlugin({
      patterns: [
        { from: "fonts", to: "fonts" },
        { from: "public/version.json", to: "version.json", noErrorOnMissing: true },
      ],
    }),
  ],

  devServer: {
    port: 8080,
    static: {
      directory: path.join(__dirname, "public"),
    },
  },

  target: "web",

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },

  output: {
    path: path.resolve("./dist"),
    filename: "[name].[contenthash:8].js",
    clean: true,
  },

  entry: {
    index: "./src/index.tsx",
  },

  performance: {
    hints: false,
  },
};
