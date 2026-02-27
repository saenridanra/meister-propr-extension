/**
 * Webpack config for the local testbed.
 *
 * Identical entry points to webpack.config.js, but:
 *  - Outputs to testbed/dist/ instead of dist/
 *  - Aliases the real ADO SDK/API packages to lightweight mocks
 *  - Uses transpileOnly so ts-loader doesn't enforce rootDir boundaries
 */

const path = require('path');

module.exports = {
    entry: {
        settings: './src/settings/settings.ts',
        review:   './src/review/review.ts',
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'testbed/dist'),
    },
    devtool: 'inline-source-map',
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            // Exact-match aliases ($ suffix) so subpaths like /Git are matched separately
            'azure-devops-extension-sdk$':       path.resolve(__dirname, 'testbed/mocks/azure-devops-extension-sdk.ts'),
            'azure-devops-extension-api$':       path.resolve(__dirname, 'testbed/mocks/azure-devops-extension-api.ts'),
            'azure-devops-extension-api/Git$':   path.resolve(__dirname, 'testbed/mocks/azure-devops-extension-api-git.ts'),
        },
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: {
                    loader: 'ts-loader',
                    options: {
                        // Skip full type-checking so mock files outside src/ are accepted
                        transpileOnly: true,
                    },
                },
                exclude: /node_modules/,
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
};
