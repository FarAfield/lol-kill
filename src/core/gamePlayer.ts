import {
  IGameCard,
  IGameHero,
  IGamePlayer,
  IGameSpell,
} from "@/core/game.types";
import GameLog from "@/core/gameLog";

class Player implements IGamePlayer {
  heroes: Array<IGameHero> = [];
  id: string;
  title: string;
  name: string;
  avatar: string;
  spells: Array<IGameSpell>;
  identity: string;
  seatNum: number;
  maxHp: number;
  hp: number;
  maxPow: number;
  pow: number;
  judgeCards: Array<IGameCard>;
  equipCards: Array<IGameCard>;
  handCards: Array<IGameCard>;
  skipPhaseList: Array<string>;
  marks: Record<string, number>;
  constructor() {
    this.id = "";
    this.title = "";
    this.name = "";
    this.avatar = "";
    this.spells = [];
    this.identity = "";
    this.seatNum = 0;
    this.maxHp = 0;
    this.hp = 0;
    this.maxPow = 0;
    this.pow = 0;
    this.judgeCards = [];
    this.equipCards = [];
    this.handCards = [];
    this.skipPhaseList = [];
    this.marks = {};
  }
  chooseHero(heroes: Array<IGameHero>) {
    this.heroes = heroes;
    this.id = heroes.map((hero) => hero.id).join("_");
    this.title = heroes[0].title;
    this.name = heroes[0].name;
    this.avatar = heroes[0].avatar;
    this.spells = heroes.map((hero) => hero.spells).flat();
  }

  setIdentity(identity: string) {
    this.identity = identity;
  }
  setSeatNum(seatNum: number) {
    this.seatNum = seatNum;
  }
  setMaxHpAndMaxPow(maxHp: number, maxPow: number) {
    this.maxHp = maxHp;
    this.hp = maxHp;
    this.maxPow = maxPow;
    this.pow = maxPow;
  }

  addJudgeCard(card: IGameCard) {
    this.judgeCards.push(card);
  }
  removeJudgeCard(card: IGameCard) {
    this.judgeCards = this.judgeCards.filter((c) => c.id !== card.id);
  }

  addMark(key: string, value: number) {
    this.marks[key] = value;
  }

  updateMark(key: string, value: number) {
    this.marks[key] = value;
  }
  removeMark(key: string) {
    delete this.marks[key];
  }
  clearMark() {
    this.marks = {};
  }
  countMark(key: string) {
    return this.marks[key] || 0;
  }
  hasMark(key: string) {
    return this.marks[key] !== undefined;
  }

  drawCard(cards: Array<IGameCard>) {
    GameLog.log(`玩家${this.name}摸牌：${cards.map((c) => c.name).join(",")}`);
    this.handCards.push(...cards);
  }

  discardCard(num: number) {}

  giftCard(
    cards: IGameCard | Array<IGameCard>,
    targets: IGamePlayer | Array<IGamePlayer>
  ) {}

  recastCard(cards: IGameCard | Array<IGameCard>) {}

  upsertEquip(card: IGameCard, index: number) {
    this.equipCards[index] = card;
  }
  swapEquip() {}
}
export default Player;
