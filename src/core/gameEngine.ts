import GameLog from "@/core/gameLog";
import GameEvent from "@/core/gameEvent";
import GameExecutor from "@/core/gameExecutor";
import GamePlayer from "@/core/gamePlayer";
import GameCard from "@/core/gameCard";
import GameAi from "@/core/gameAi";
import GameUi from "@/core/gameUi";
import useGameStore from "@/core/gameStore";
import { IGameEngine, IGameEvent } from "@/core/game.types";
import { getRandomNumber } from "@/core/utils";

const gameStore = useGameStore();

class GameEngine implements IGameEngine {
  static instance;
  constructor() {
    if (!GameEngine.instance) {
      Object.keys(gameStore).forEach((key) => {
        if (["get", "set"].some((i) => key.startsWith(i))) {
          this[key] = gameStore[key];
        }
      });
      GameEngine.instance = this;
    }
    return GameEngine.instance;
  }

  /** GameEngine相关事件 */
  static start() {
    GameLog.success("System", "游戏开始");
    // 初始化事件
    gameStore.event = new GameEvent("root");
    // 触发游戏事件
    gameStore.event.trigger("game");
    // 开启事件循环
    this.loop();
  }
  static over() {
    GameLog.success("System", "游戏结束");
    gameStore.over = true;
  }

  static pause() {
    GameLog.warn("System", "游戏暂停");
    gameStore.pause = true;
  }

  static resume() {
    GameLog.warn("System", "游戏恢复");
    gameStore.pause = false;
    this.loop();
  }

  static async loop() {
    while (true) {
      if (gameStore.pause || gameStore.over) {
        return;
      }
      const event = gameStore.event!;
      // 事件未执行
      if (!event.done) {
        // （1）存在next，执行next事件
        if (event.next.length) {
          const next = event.next.shift() as IGameEvent;
          next.parent = event;
          gameStore.event = next;
          continue;
        }
        // （2）timing为1，执行切面Before事件
        if (event.timing === 1) {
          event.insertNext(`${event.name}Before`);
          event.timing += 1;
          continue;
        }
        // （3）timing为2，执行切面Begin事件
        if (event.timing === 2) {
          event.insertNext(`${event.name}Begin`);
          event.timing += 1;
          continue;
        }
        // （4）不符合事件执行条件  todo
        if (0) {
          event.finish();
          continue;
        }
        // （5）执行该事件
        if (true) {
          await this.runEvent(event).then(() => {
            event.step += 1;
          });
          continue;
        }
      }
      // 事件已执行
      if (event.done) {
        // （1）存在after，执行after事件
        if (event.after.length) {
          const after = event.after.shift() as IGameEvent;
          after.parent = event;
          gameStore.event = after;
          continue;
        }
        // （2）timing为3，执行切面End事件
        if (event.timing === 3) {
          event.insertAfter(`${event.name}End`);
          event.timing += 1;
          continue;
        }
        // （3）timing为4，执行切面After事件
        if (event.timing === 4) {
          event.insertAfter(`${event.name}After`);
          event.timing += 1;
          continue;
        }
        // （4）存在parent，执行parent事件
        if (event.parent) {
          // 上报结果 todo
          gameStore.event = event.parent;
          continue;
        }
        if (true) {
          GameEngine.over();
          return;
        }
      }
    }
  }

  static async runEvent(event: IGameEvent) {
    return new Promise(async (resolve) => {
      if (typeof event.executor !== "function") {
        event.setExecutor(parseEventFunction(event));
      }
      const instance = new GameEngine();
      await event.executor!(event, instance).catch((err) => {
        GameLog.error("System", `【${event.name}】执行异常`);
        console.log(err);
        GameEngine.pause();
      });
      resolve(true);
    });
  }
  /** 游戏相关事件 */
  async delay(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
  debug() {
    GameLog.debug(...arguments);
  }

  createPlayer() {
    const [playerNum, maxHp, maxPow] = [
      gameStore.config.playerNum,
      gameStore.config.maxHp,
      gameStore.config.maxPower,
    ];
    gameStore.playerList = new Array(playerNum).fill(true).map((_, index) => {
      const player = new GamePlayer();
      player.setIdentity("player");
      player.setSeatNum(index);
      player.setMaxHpAndMaxPow(maxHp, maxPow);
      return player;
    });
    gameStore.current = gameStore.playerList[0];
    gameStore.me = gameStore.playerList[getRandomNumber(0, playerNum - 1)];
  }
  createCard() {
    const [equipNum, magicNum, runeNum, fullCardList] = [
      gameStore.config.equipNum,
      gameStore.config.magicNum,
      gameStore.config.runeNum,
      gameStore.fullCardList,
    ];
    function arrayRepeat<T extends any>(array: Array<T>, num: number) {
      return new Array(num).fill(array).flat() as Array<T>;
    }
    function getFullCardListByPackage(packageName: string) {
      return fullCardList.filter((i) => i.package === packageName);
    }
    const cardPile = arrayRepeat(getFullCardListByPackage("equip"), equipNum)
      .concat(arrayRepeat(getFullCardListByPackage("magic"), magicNum))
      .concat(arrayRepeat(getFullCardListByPackage("rune"), runeNum));
    gameStore.cardList = cardPile.map((i) => new GameCard(i));
  }
  washCard() {
    gameStore.cardList = gameStore.cardList.sort(() => Math.random() - 0.5);
  }
  chooseHero(showModal: boolean = false) {
    return GameUi.chooseHero(showModal);
  }
  getTopCards(num: number) {
    const cards = gameStore.cardList.splice(-num, num);
    return cards;
  }
  getBottomCards(num: number) {
    const cards = gameStore.cardList.splice(0, num);
    return cards;
  }
}
function parseEventFunction(event: IGameEvent) {
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const executor = GameExecutor[event.name];
  if (!executor) {
    return new AsyncFunction("event", "game", "event.finish();return;");
  }
  const executorMap = executor();
  const stepList = Object.keys(executorMap).sort(
    (a, b) => Number(a.replace("step", "")) - Number(b.replace("step", ""))
  );
  let str = `if(event.step > ${stepList.length}){event.finish();return;}`;
  str += "switch(event.step) {";
  stepList.forEach((key, index) => {
    let functionBody = executorMap[key].toString();
    functionBody = functionBody.substring(
      functionBody.indexOf("{") + 1,
      functionBody.lastIndexOf("}")
    );
    str += `case ${index + 1}:{${functionBody}break;}`;
  });
  str += "}";
  return new AsyncFunction("event", "game", str);
}

export default GameEngine;
