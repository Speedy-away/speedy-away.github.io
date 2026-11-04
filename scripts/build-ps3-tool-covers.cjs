// Original vector identity art, not tool screenshots.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const covers=[
 ['ccapi','CCAPI','CONSOLE CONNECTION','<path d="M400 160h130v100H400zM420 184h90M420 205h55M455 260v22m-30 0h60M400 205h-36v-48h-28m194 48h35v-48h28"/><circle cx="327" cy="157" r="12"/><circle cx="601" cy="157" r="12"/>'],
 ['artemis','ARTEMIS','CHEAT DATABASE','<path d="M463 108l77 30v58c0 51-40 80-77 97-37-17-77-46-77-97v-58zM423 183l25 25 57-61"/><path d="M355 155c-30 70-4 124 49 146m166-146c30 70 4 124-49 146"/>'],
 ['psninja','PSNINJA','LEGACY PS3 UTILITY','<path d="M389 140q72-55 144 0v97q-72 61-144 0zM391 173h140v36H391M409 188h22m60 0h22M441 243l20 10 20-10"/>']
];
for(const [id,title,caption,shape] of covers){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#091b17"/><stop offset="1" stop-color="#070d12"/></linearGradient><radialGradient id="light"><stop stop-color="#16bb88" stop-opacity=".22"/><stop offset="1" stop-color="#16bb88" stop-opacity="0"/></radialGradient></defs><rect width="640" height="360" fill="url(#bg)"/><ellipse cx="467" cy="200" rx="190" ry="170" fill="url(#light)"/><g stroke="#42d5a7" stroke-opacity=".1"><path d="M0 300L640 60M0 340L640 100M120 360L640 160M0 60L640 300M0 100L640 340"/></g><g fill="none" stroke="#58e1b6" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${shape}</g><text x="44" y="164" fill="#effcf6" font-family="Arial,sans-serif" font-size="43" font-weight="700">${title}</text><path d="M46 188h94" stroke="#55dcb0" stroke-width="3"/><text x="46" y="218" fill="#96b6aa" font-family="Arial,sans-serif" font-size="12" letter-spacing="2">${caption}</text><text x="46" y="317" fill="#6e9687" font-family="Arial,sans-serif" font-size="12" letter-spacing="2">PLAYSTATION 3</text></svg>`;
 fs.writeFileSync(path.join(root,'assets/images/game-card-covers/'+id+'-tool-v1.svg'),svg);
}
console.log('Wrote three original PS3 utility cover illustrations.');
