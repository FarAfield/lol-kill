import {
  IGameCard,
  IGameHero,
  IGamePlayer,
  IGameSpell,
} from "@/core/game.types";

class Player implements IGamePlayer {
  // 英雄属性
  type: string;
  id: string;
  title: string;
  name: string;
  avatar: string;
  skins: Array<{ name: string; skin: string }>;
  spells: Array<IGameSpell>;
  // 玩家属性
  skin: string;
  identity: string;
  seatNum: number;
  maxHp: number;
  hp: number;
  maxPow: number;
  pow: number;
  judgeCards: Array<IGameCard>;
  handCards: Array<IGameCard>;
  equipCards: Array<IGameCard>;
  // 游戏属性
  skipPhaseList: Array<string>;
  marks: Record<string, any>;
  constructor() {
    this.type = "hero";
    this.id = "";
    this.title = "";
    this.name = "";
    this.avatar = "";
    this.skins = [];
    this.spells = [];
    this.skin = "";
    this.identity = "";
    this.seatNum = 0;
    this.maxHp = 0;
    this.hp = 0;
    this.maxPow = 0;
    this.pow = 0;
    this.judgeCards = [];
    this.handCards = [];
    this.equipCards = [];
    this.skipPhaseList = [];
    this.marks = {};
  }
  chooseHero(hero: IGameHero) {
    this.type = hero.type;
    this.id = hero.id;
    this.title = hero.title;
    this.name = hero.name;
    this.avatar = hero.avatar;
    this.skins = hero.skins;
    this.spells = hero.spells;
    this.skin = hero.skins[0].skin;
  }
}
export default Player;
