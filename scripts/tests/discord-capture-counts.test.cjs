const {test}=require('node:test'),assert=require('node:assert/strict');
const {postCards}=require('../audit-discord-captures.cjs');
test('forum cards count singular replies, plural replies and comma-containing titles once',()=>{
 const tree='1 button Post Alpha, 0 messages\n2 button Post Beta, 1 message\n3 button Post Menu, Deluxe, 2 messages\nDocument text:\n2 button Post Beta, 1 message';
 assert.deepEqual(postCards(tree),[{index:1,title:'Alpha',replies:0},{index:2,title:'Beta',replies:1},{index:3,title:'Menu, Deluxe',replies:2}]);
});
