import GameLog from "@/core/gameLog";
import {
  IGameCard,
  IGamePlayer,
  IGameEvent,
  IGameEffect,
} from "@/core/game.types";
import useGameStore from "@/core/gameStore";
import { getUUID } from "@/core/utils";

const gameStore = useGameStore();
class GameEvent implements IGameEvent {
  // 基础属性
  protected id: string;
  name: string;
  done: boolean;
  // 事件属性
  parent: null | IGameEvent;
  next: Array<IGameEvent>;
  after: Array<IGameEvent>;
  step: number;
  aop: boolean;
  timing: number;
  executor: null | Function;
  result: null | Record<string, any>;
  // 游戏属性
  source: null | IGamePlayer;
  player: null | IGamePlayer;
  target: null | IGamePlayer;
  targets: null | Array<IGamePlayer>;
  card: null | IGameCard;
  cards: null | Array<IGameCard>;

  constructor(name: string, aop: boolean = false) {
    this.id = getUUID();
    this.name = name;
    this.done = false;
    this.parent = null;
    this.next = [];
    this.after = [];
    this.step = 1;
    this.aop = aop;
    this.timing = Number(aop);
    this.executor = null;
    this.result = null;
    this.source = null;
    this.player = null;
    this.target = null;
    this.targets = null;
    this.card = null;
    this.cards = null;
  }

  getParent(nameOrDeep: string | number): null | IGameEvent {
    let event: null | IGameEvent = this;
    if (typeof nameOrDeep === "string") {
      while (true) {
        if (!event) {
          return null;
        }
        if (event.name === nameOrDeep) {
          return event;
        }
        event = event.parent;
      }
    } else if (typeof nameOrDeep === "number") {
      for (let i = 1; i < nameOrDeep; i++) {
        if (!event) {
          return null;
        }
        event = event.parent;
      }
      return event;
    }
    return null;
  }
  isAop(): boolean {
    return this.aop;
  }
  getResult(key: undefined | string) {
    if (!key) {
      return this.result;
    }
    return this.result?.[key];
  }
  setResult(key: string, value: any) {
    if (!this.result) {
      this.result = {};
    }
    this.result[key] = value;
  }
  setExecutor(executor: Function) {
    this.executor = executor;
    return this;
  }
  finish(): IGameEvent {
    this.done = true;
    // GameLog.log(`【${this.name}】执行完成`);
    return this;
  }
  insertNext(name: string, aop: boolean = false) {
    return this.trigger(name, aop, "before");
  }
  insertAfter(name: string, aop: boolean = false) {
    return this.trigger(name, aop, "after");
  }
  goto(step: number) {
    this.step = step - 1;
    return this;
  }
  trigger(
    name: string,
    aop: boolean = false,
    type: "before" | "after" = "before"
  ) {
    const next = new GameEvent(name, aop);
    /** 触发器处理逻辑开始 */
    const current = gameStore.current;
    const playerList = gameStore.playerList;
    if (current && current.id) {
      next.player = gameStore.current;
      GameLog.log(`【${current.name}】触发了【${name}】事件`);
      // 此处是mock，给英雄添加测试技能
      if (!gameStore.playerList[0].spells.map((i) => i.id).includes("Test1")) {
        gameStore.playerList[0].spells.push(
          ...[
            {
              id: "Test1",
              name: "测试1",
              icon: "",
              description: "",
            },
            {
              id: "Test2",
              name: "测试2",
              icon: "",
              description: "",
            },
          ]
        );
      }
      if (!gameStore.playerList[1].spells.map((i) => i.id).includes("Test3")) {
        gameStore.playerList[1].spells.push(
          ...[
            {
              id: "Test3",
              name: "测试3",
              icon: "",
              description: "",
            },
            {
              id: "Test4",
              name: "测试4",
              icon: "",
              description: "",
            },
          ]
        );
      }
      const [
        globalEffectList,
        playerEffectList,
        sourceEffectList,
        targetEffectList,
      ] = this.collectEffect(name);
      // 全局技能由指定的玩家触发
      if (globalEffectList.length) {
        globalEffectList.forEach((effect) => {
          const player = playerList.find((i) => i.id === effect.triggerId);
          const effectName = player?.spells.find(
            (i) => i.id === effect.effectId
          )?.name;
          if (player) {
            GameLog.error("Tip", `${player.name}触发全局技能：${effectName}`);
          }
        });
      }
      // 玩家技能由当前玩家触发
      if (playerEffectList.length) {
        playerEffectList.forEach((effect) => {
          const effectName = current?.spells.find(
            (i) => i.id === effect.effectId
          )?.name;
          GameLog.error("Tip", `${current.name}触发玩家技能：${effectName}`);
        });
      }
      // 玩家来源技能由当前玩家触发
      if (sourceEffectList.length) {
        sourceEffectList.forEach((effect) => {
          const effectName = current?.spells.find(
            (i) => i.id === effect.effectId
          )?.name;
          GameLog.error("Tip", `${current.name}触发来源技能：${effectName}`);
        });
      }
      // 目标技能，待实现
    }
    /** 触发器处理逻辑结束 */
    if (type === "before") {
      this.next.push(next);
    } else if (type === "after") {
      this.after.push(next);
    }
    return next;
  }
  protected collectEffect(eventName: string) {
    const playerList = gameStore.playerList.filter((i) => !i.isDead());
    const current = gameStore.current;
    const globalEffectMap = gameStore.globalEffectMap;
    const triggerEffectMap = gameStore.triggerEffectMap;
    const globalEffectIds = Object.keys(globalEffectMap);
    const triggerEffectIds = Object.keys(triggerEffectMap);
    // 以当前角色为起点开始排序
    const index = playerList.map((i) => i.id).indexOf(current!.id);
    const sortPlayerList = playerList
      .slice(index)
      .concat(...playerList.slice(0, index));
    interface IEventEffect extends IGameEffect {
      triggerId: string;
      effectId: string;
    }
    // 按照排序后的角色顺序排序技能
    const sortGlobalEffectList: Array<IEventEffect> = [];
    const sortPlayerEffectList: Array<IEventEffect> = [];
    const sortSourceEffectList: Array<IEventEffect> = [];
    const sortTargetEffectList: Array<IEventEffect> = [];
    function isEqual(a: string | Array<string>, b: string) {
      if (Array.isArray(a)) {
        return a.includes(b);
      }
      return a === b;
    }
    sortPlayerList.forEach((player) => {
      const effectId = player.spells.map((i) => i.id);
      effectId.forEach((id) => {
        if (globalEffectIds.includes(id)) {
          const globalEffect = globalEffectMap[id];
          // 全局技能，不论当前玩家，以当前玩家为起始顺序触发
          if (isEqual(globalEffect.trigger!.global!, eventName)) {
            sortGlobalEffectList.push({
              ...globalEffect,
              triggerId: player.id,
              effectId: id,
            });
          }
        }
        if (triggerEffectIds.includes(id)) {
          const triggerEffect = triggerEffectMap[id];
          // 自身技能，当前玩家才能触发
          if (
            isEqual(triggerEffect.trigger!.player!, eventName) &&
            current!.id === player.id
          ) {
            sortPlayerEffectList.push({
              ...triggerEffect,
              triggerId: player.id,
              effectId: id,
            });
          }
          // 来源技能，当前玩家才能触发
          if (
            isEqual(triggerEffect.trigger!.source!, eventName) &&
            current!.id === player.id
          ) {
            sortSourceEffectList.push({
              ...triggerEffect,
              triggerId: player.id,
              effectId: id,
            });
          }
          // 目标技能，非当前玩家且自身成为目标才能触发 todo  自身也能成为目标，目标如何获取
          if (
            isEqual(triggerEffect.trigger!.target!, eventName) &&
            current!.id !== player.id
          ) {
            sortTargetEffectList.push({
              ...triggerEffect,
              triggerId: player.id,
              effectId: id,
            });
          }
        }
      });
    });
    // 默认按照以当前角色为起始触发，若存在优先级，则提升技能优先级
    sortGlobalEffectList.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    sortPlayerEffectList.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    sortSourceEffectList.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    sortTargetEffectList.sort((a, b) => (a.priority || 0) - (b.priority || 0));
    return [
      sortGlobalEffectList,
      sortPlayerEffectList,
      sortSourceEffectList,
      sortTargetEffectList,
    ];
  }
}
export default GameEvent;
