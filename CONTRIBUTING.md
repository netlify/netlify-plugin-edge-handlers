# CONTRIBUTING

Contributions are always welcome, no matter how large or small. Before contributing, please read the
[code of conduct](CODE_OF_CONDUCT.md).

## Setup

> Install Node.js + npm on your system: https://nodejs.org/en/download/

```sh
git clone git@github.com:netlify/netlify-plugin-edge-handlers.git
cd netlify-plugin-edge-handlers
npm install
```

## Testing

To run tests in this plugin, simply run:

```sh
npm test
```

This will run formatting, linting and the integration tests located in the `test` folder.

## Releasing

1. Merge the release PR
2. Switch to the default branch `git checkout master`
3. Pull latest changes `git pull`
4. Publish the package `npm publish`

## License

By contributing to Netlify Node Client, you agree that your contributions will be licensed under its
[MIT license](LICENSE).
