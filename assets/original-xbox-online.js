(function () {
  'use strict';
  function matches(game, query, mode) {
    return game.title.toLowerCase().includes(query.trim().toLowerCase()) &&
      (mode === 'all' || (mode === 'coop' && game.coop > 0) ||
       (mode === 'versus' && game.versus > 0) || (mode === 'shared' && game.perConsole > 1));
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { matches };
  if (typeof document === 'undefined') return;
  const search = document.getElementById('xbox-game-search');
  const mode = document.getElementById('xbox-game-mode');
  if (!search || !mode) return;
  const cards = Array.from(document.querySelectorAll('[data-xbox-game]'));
  function update() {
    let visible = 0;
    cards.forEach(card => {
      const game = JSON.parse(card.dataset.xboxGame);
      card.hidden = !matches(game, search.value, mode.value);
      if (!card.hidden) visible++;
    });
    document.getElementById('xbox-game-count').textContent = visible + ' of ' + cards.length + ' games';
    document.getElementById('xbox-game-empty').hidden = visible !== 0;
  }
  search.addEventListener('input', update);
  mode.addEventListener('change', update);
  document.getElementById('xbox-game-reset').addEventListener('click', () => {
    search.value = ''; mode.value = 'all'; update(); search.focus();
  });
  update();
})();
