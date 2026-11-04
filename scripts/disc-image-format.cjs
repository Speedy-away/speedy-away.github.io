// Identify common 2048-byte-sector optical-disc images without mounting them.
function discImageFormat(bytes) {
  if (bytes.length < 19 * 2048 || bytes.length % 2048 !== 0) return null;
  if (bytes.subarray(32769, 32774).toString('ascii') === 'CD001') return 'ISO9660';
  // Blu-ray images can be UDF-only, with no ISO9660 bridge descriptor.
  let state = 0;
  for (let sector = 16; sector < Math.min(32, bytes.length / 2048); sector++) {
    const offset = sector * 2048;
    if (bytes[offset] !== 0 || bytes[offset + 6] !== 1) continue;
    const id = bytes.subarray(offset + 1, offset + 6).toString('ascii');
    if (id === 'BEA01') state = 1;
    else if (state === 1 && (id === 'NSR02' || id === 'NSR03')) state = 2;
    else if (state === 2 && id === 'TEA01') return 'UDF';
  }
  return null;
}
module.exports = {discImageFormat};
