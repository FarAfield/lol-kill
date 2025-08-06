import { defineStore } from "pinia";
import { IGameStoreState, IGamePlayer } from "@/core/game.types";

export default defineStore("game", {
  state: (): IGameStoreState => ({
    // 导入的模块资源
    heroModule: [],
    equipModule: [],
    magicModule: [],
    runeModule: [],
    // 解析后的游戏资源
    fullHeroList: [],
    fullCardList: [],
    fullEffectMap: {},
    // 游戏配置信息
    config: {
      mode: "standard",
      playerNum: 2,
      maxHp: 100,
      maxPower: 10,
      equipNum: 100,
      magicNum: 10,
      runeNum: 10,
      maxRound: 3,
      initCardNum: 4,
      phaseCardNum: 2,
    },
    // 游戏运行时数据
    round: 0,
    pause: false,
    over: false,
    event: null,
    playerList: [],
    globalEffectMap: {},
    effectMap: {},
    cardList: [],
    discardList: [],
    current: null,
    me: null,
  }),
  getters: {},
  actions: {
    // get
    getGameConfig() {
      return this.config;
    },
    getRound() {
      return this.round;
    },
    getPlayerList() {
      return this.playerList;
    },
    getGlobalEffectMap() {
      return this.globalEffectMap;
    },
    getEffectMap() {
      return this.effectMap;
    },
    getCardList() {
      return this.cardList;
    },
    getDiscardList() {
      return this.discardList;
    },
    getCurrentPlayer() {
      return this.current;
    },
    getMe() {
      return this.me;
    },
    // set
    setRound(round: number) {
      this.round = round;
    },
    setCurrentPlayer(current: IGamePlayer) {
      this.current = current;
    },
  },
});
