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
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  '@tailwindcss/postcss',
                ],
              },
            },
          },
        ],
      },
    ],
  },

  plugins: [
    new HtmlWebpackPlugin({
      chunks: ["index"],
      filename: "index.html",
      inject: "body",
      title: "Text to STL",
      favicon: "./src/images/favicon.png",
      meta: {
        viewport: "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
      }
    }),
    new CopyPlugin({
      patterns: [
        { from: "fonts", to: "fonts" },
      ],
    }),
  ],

  target: "web",

  resolve: {
    extensions: [".tsx", ".ts", ".js"],
  },

  output: {
    path: path.resolve("./dist"),
    filename: "[name].js",
  },

  entry: {
    index: "./src/index.tsx",
  },

  performance: {
    hints: false,
  },
};
