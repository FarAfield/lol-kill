/**  GameEvent */
export interface IGameEvent {
  name: string;
  done: boolean;
  parent: null | IGameEvent;
  next: Array<IGameEvent>;
  after: Array<IGameEvent>;
  step: number;
  aop: boolean;
  timing: number;
  executor: null | Function;
  result: null | Record<string, any>;
  finish(): IGameEvent;
  getParent(nameOrDeep: string | number): null | IGameEvent;
  insertNext(name: string, aop?: boolean): IGameEvent;
  insertAfter(name: string, aop?: boolean): IGameEvent;
  setExecutor(executor: Function): IGameEvent;
  goto(step: number): IGameEvent;
  trigger(name: string, aop?: boolean): IGameEvent;
}
/**  GameCard */
export interface IGameCard {
  package: string;
  type: string;
  id: string;
  name: string;
  image: string;
  description: string;
  knowers: Array<string>;
  isVirtual: boolean;
  addKnower(player: IGamePlayer): void;
  removeKnower(player: IGamePlayer): void;
  clearKnowers(): void;
  isKnower(player: IGamePlayer): boolean;
}
/**  GamePlayer */
export interface IGameHero {
  type: string;
  id: string;
  title: string;
  name: string;
  avatar: string;
  skins: Array<{ name: string; skin: string }>;
  spells: Array<IGameSpell>;
}
export interface IGameSpell {
  id: string;
  name: string;
  icon: string;
  description: string;
}
export interface IGamePlayer extends IGameHero {
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
  skipPhaseList: Array<string>;
  marks: Record<string, any>;
  chooseHero(hero: IGameHero): void;
}
/**  GameEngine */
export interface IGameEngine {
  delay(ms: number): Promise<void>;
  createPlayer(): void;
  createCard(): void;
  washCard(): void;
  //
  getHeroList(): Array<IGameHero>;
  getPlayerList(): Array<IGamePlayer>;
  getCardPileList(): Array<IGameCard>;
  getCurrentPlayer(): null | IGamePlayer;
  getMe(): null | IGamePlayer;
}
