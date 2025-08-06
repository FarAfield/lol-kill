import GameLog from "@/core/gameLog";
import { IGameCard, IGamePlayer, IGameEvent } from "@/core/game.types";
import { getUUID } from "@/core/utils";

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
    GameLog.log(`【${this.name}】执行完成`);
    return this;
  }
  insertNext(name: string, aop: boolean = false) {
    const next = new GameEvent(name, aop);
    this.next.push(next);
    return next;
  }
  insertAfter(name: string, aop: boolean = false) {
    const after = new GameEvent(name, aop);
    this.after.push(after);
    return after;
  }
  goto(step: number) {
    this.step = step - 1;
    return this;
  }
  trigger(name: string, aop: boolean = false) {
    const next = new GameEvent(name, aop);
    this.next.push(next);
    return next;
  }
}
export default GameEvent;
