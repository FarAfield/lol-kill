import GameLog from "@/core/gameLog";
import GameEngine from "@/core/gameEngine";
import useGameStore from "@/core/gameStore";
import { cloneDeep, omit } from "lodash-es";

class GameLoad {
  static async onLoad() {
    const gameStore = useGameStore();
    GameLog.info("游戏资源加载中...");
    // 解析英雄信息
    for (const i of gameStore.heroModule) {
      const hero = omit(cloneDeep(i), ["effects"]);
      Object.assign(gameStore.effectMap, i.effects);
      gameStore.heroList.push(hero);
    }
    // 解析装备、天赋、符文信息
    for (const i of gameStore.equipModule) {
      const card = omit(cloneDeep(i), ["effects"]);
      Object.assign(gameStore.effectMap, i.effects);
      card.package = "equip";
      gameStore.cardList.push(card);
    }
    for (const i of gameStore.talentModule) {
      const card = omit(cloneDeep(i), ["effects"]);
      Object.assign(gameStore.effectMap, i.effects);
      card.package = "talent";
      gameStore.cardList.push(card);
    }
    for (const i of gameStore.runeModule) {
      const card = omit(cloneDeep(i), ["effects"]);
      Object.assign(gameStore.effectMap, i.effects);
      card.package = "rune";
      gameStore.cardList.push(card);
    }
    GameLog.success("System", "资源加载完成");
    // 启动游戏
    GameEngine.start();
  }
}

export default GameLoad;
