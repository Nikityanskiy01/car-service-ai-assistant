const { transformSync } = require('esbuild');

module.exports = {
  process(sourceText, sourcePath) {
    const result = transformSync(sourceText, {
      loader: 'ts',
      format: 'esm',
      target: 'node22',
      sourcefile: sourcePath,
    });
    return { code: result.code };
  },
};
