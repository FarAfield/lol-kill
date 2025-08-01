import { defineStore } from "pinia";
import {
  IGameEvent,
  IGameHero,
  IGamePlayer,
  IGameCard,
} from "@/core/game.types";

interface GameState {
  heroModule: Array<any>;
  equipModule: Array<any>;
  talentModule: Array<any>;
  runeModule: Array<any>;
  heroList: Array<IGameHero>;
  cardList: Array<IGameCard>;
  effectMap: Record<string, Function>;
  event: null | IGameEvent;
  pause: boolean;
  over: boolean;
  round: number;
  modeConfig: Record<string, any>;
  playerList: Array<IGamePlayer>;
  cardPileList: Array<IGameCard>;
  discardPileList: Array<IGameCard>;
  current: null | IGamePlayer;
  me: null | IGamePlayer;
}

export default defineStore("game", {
  state: (): GameState => ({
    // 导入的模块资源
    heroModule: [],
    equipModule: [],
    talentModule: [],
    runeModule: [],
    // 解析后的资源
    heroList: [],
    cardList: [],
    effectMap: {},
    // 游戏流程
    event: null,
    pause: false,
    over: false,
    round: 0,
    // 游戏信息
    modeConfig: {
      playerNum: 2,
      hpUpperLimit: 100,
      powerUpperLimit: 10,
      cardNum: {
        equip: 1,
        talent: 1,
        rune: 1,
      },
    },
    playerList: [],
    cardPileList: [],
    discardPileList: [],
    current: null,
    me: null,
  }),
  getters: {},
  actions: {},
});
