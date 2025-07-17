import GameLog from "@/core/gameLog";
import { IGameEvent } from "@/core/game.types";

class GameEvent implements IGameEvent {
  // 基础属性
  protected id: number;
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

  constructor(name: string, aop: boolean = false) {
    this.id = Math.round(Math.random() * 1000000);
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
  }

  finish() {
    this.done = true;
    GameLog.debug(`【${this.name}】执行完成`);
    return this;
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
  setExecutor(executor: Function) {
    this.executor = executor;
    return this;
  }
  goto(step: number) {
    this.step = step;
    return this;
  }
  trigger(name: string, aop: boolean = false) {
    const next = new GameEvent(name, aop);
    this.next.push(next);
    return next;
  }
}
export default GameEvent;
