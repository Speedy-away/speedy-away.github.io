const {test} = require('node:test');
const assert = require('node:assert/strict');
const {discImageFormat} = require('../disc-image-format.cjs');

test('recognizes ISO9660 and UDF-only Blu-ray volume descriptors', () => {
  const iso = Buffer.alloc(20 * 2048);
  iso.write('CD001', 16 * 2048 + 1);
  assert.equal(discImageFormat(iso), 'ISO9660');
  for (const revision of ['NSR02', 'NSR03']) {
    const udf = Buffer.alloc(20 * 2048);
    ['BEA01', revision, 'TEA01'].forEach((id, index) => {
      udf.write(id, (16 + index) * 2048 + 1);
      udf[(16 + index) * 2048 + 6] = 1;
    });
    assert.equal(discImageFormat(udf), 'UDF');
    assert.equal(discImageFormat(udf.subarray(0, udf.length - 1)), null);
    udf.fill(0, 18 * 2048, 19 * 2048);
    assert.equal(discImageFormat(udf), null);
  }
});

test('rejects web pages, short data and out-of-order UDF identifiers', () => {
  assert.equal(discImageFormat(Buffer.from('<html>Not a disc image</html>')), null);
  const bytes = Buffer.alloc(20 * 2048);
  ['NSR03', 'BEA01', 'TEA01'].forEach((id, index) => {
    bytes.write(id, (16 + index) * 2048 + 1);
    bytes[(16 + index) * 2048 + 6] = 1;
  });
  assert.equal(discImageFormat(bytes), null);
});
