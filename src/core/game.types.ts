/**  GameCard */
export interface IGameCard {
  package: string;
  type: string;
  id: string;
  name: string;
  image: string;
  description: string;
  tags: Array<string>;
  knowers: Array<string>;
  isVirtual: boolean;
  addTag(tag: string): void;
  removeTag(tag: string): void;
  clearTags(): void;
  hasTag(tag: string): boolean;
  addKnower(player: IGamePlayer): void;
  removeKnower(player: IGamePlayer): void;
  clearKnowers(): void;
  isKnower(player: IGamePlayer): boolean;
}
/**  GameEngine */
export interface IGameEngine {
  delay(ms: number): Promise<void>;
  createPlayer(): void;
  createCard(): void;
  washCard(): void;
  chooseHero(showModal: boolean): Promise<Array<IGameHero>>;
  getHeroList(): Array<IGameHero>;
  getPlayerList(): Array<IGamePlayer>;
  getCardPileList(): Array<IGameCard>;
  getCurrentPlayer(): null | IGamePlayer;
  getMe(): null | IGamePlayer;
}
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
  source: null | IGamePlayer;
  player: null | IGamePlayer;
  target: null | IGamePlayer;
  targets: null | Array<IGamePlayer>;
  card: null | IGameCard;
  cards: null | Array<IGameCard>;
  finish(): IGameEvent;
  getParent(nameOrDeep: string | number): null | IGameEvent;
  insertNext(name: string, aop?: boolean): IGameEvent;
  insertAfter(name: string, aop?: boolean): IGameEvent;
  setExecutor(executor: Function): IGameEvent;
  goto(step: number): IGameEvent;
  trigger(name: string, aop?: boolean): IGameEvent;
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
export interface IGamePlayer {
  heroes: Array<IGameHero>;
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
  marks: Record<string, any>;
  chooseHero(heroes: Array<IGameHero>): void;
  setIdentity(identity: string): void;
  setSeatNum(seatNum: number): void;
  setMaxHpAndMaxPow(maxHp: number, maxPow: number): void;
  addJudgeCard(card: IGameCard): void;
  removeJudgeCard(card: IGameCard): void;
  addMark(key: string, value: number): void;
  updateMark(key: string, value: number): void;
  removeMark(key: string): void;
  clearMark(): void;
  countMark(key: string): number;
  hasMark(key: string): boolean;
  drawCard(num: number): void;
  discardCard(num: number): void;
  giftCard(
    cards: IGameCard | Array<IGameCard>,
    targets: IGamePlayer | Array<IGamePlayer>
  ): void;
  recastCard(cards: IGameCard | Array<IGameCard>): void;
  upsertEquip(card: IGameCard, index: number): void;
  swapEquip(): void;
}
