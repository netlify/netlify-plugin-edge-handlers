const FIXTURES_DIR = `${__dirname}/../fixtures`;

// Resolve fixture name to an absolute path
const resolveFixtureName = function (fixtureName) {
  return `${FIXTURES_DIR}/${fixtureName}`;
};

module.exports = { resolveFixtureName };
