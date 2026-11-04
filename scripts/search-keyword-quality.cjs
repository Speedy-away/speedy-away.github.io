// Section controls and navigation labels are not page subjects. Keep this
// deliberately narrow so named tools, games and compatibility pins remain terms.
const patterns = [
  /^additional tools:?$/i,
  /^before you download$/i,
  /^related (?:switch |ps[1-5] |xbox(?: 360)? )?(?:apps|tools|resources|guides|pages|downloads)$/i,
  /^more for (?:your )?(?:games|ps[1-5]|xbox(?: 360)?|ps vita|psp|steam deck|wii(?: u)?|gamecube)\.?$/i,
  /^best free .*\bupdated\b[^a-z\d]*$/i,
  /^choose (?:how to play|files for your console|(?:your|a|an|the) (?:(?:correct|right) )?(?:ps[1-5]|xbox 360|console|online|call of duty|uncharted|game|system|platform|guide|download|payload|hen|customization|transfer|setup|file|method|boot)\b)/i
];

function isGenericKeyword(term) {
  const value = String(term ?? '').replace(/\s+/g, ' ').trim();
  return !value || patterns.some(pattern => pattern.test(value));
}

module.exports = {isGenericKeyword};
