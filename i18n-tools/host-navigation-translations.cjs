'use strict';
const langs=['es','pt','fr','de','ru','tr','pl','it','zh','ja','ko','th','vi','id','hi','sr','nl','ka','ar','he'],table={};
function row(key,values){const cells=values.split('|');if(cells.length!==20||cells.some(v=>!v))throw Error('Invalid navigation translation row');table[key]=Object.fromEntries(langs.map((lang,i)=>[lang,cells[i]]));}
row('Game patches','Parches de juegos|Patches de jogos|Correctifs de jeux|Spielpatches|Патчи игр|Oyun yamaları|Łatki do gier|Patch dei giochi|游戏补丁|ゲームパッチ|게임 패치|แพตช์เกม|Bản vá trò chơi|Patch game|गेम पैच|Закрпе за игре|Gamepatches|თამაშის პატჩები|تصحيحات الألعاب|תיקוני משחקים');
row('Choose HEN','Elegir HEN|Escolher HEN|Choisir HEN|HEN wählen|Выбрать HEN|HEN seç|Wybierz HEN|Scegli HEN|选择 HEN|HENを選択|HEN 선택|เลือก HEN|Chọn HEN|Pilih HEN|HEN चुनें|Изабери HEN|HEN kiezen|HEN-ის არჩევა|اختيار HEN|בחירת HEN');
module.exports=table;
