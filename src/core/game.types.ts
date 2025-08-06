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
  getCardId(): string;
  setIsVirtual(isVirtual: boolean): void;
  destroy(): void;
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
  debug(...args: Array<any>): void;
  createPlayer(): void;
  createCard(): void;
  washCard(): void;
  chooseHero(showModal: boolean): Promise<Array<IGameHero>>;
  getTopCards(num: number): Array<IGameCard>;
  getBottomCards(num: number): Array<IGameCard>;
}
export interface IGameCore extends IGameEngine, IGameStoreActions {}
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
  getParent(nameOrDeep: string | number): null | IGameEvent;
  isAop(): boolean;
  getResult(key: undefined | string): null | Record<string, any>;
  setResult(key: string, value: any): void;
  setExecutor(executor: Function): IGameEvent;
  finish(): IGameEvent;
  insertNext(name: string, aop?: boolean): IGameEvent;
  insertAfter(name: string, aop?: boolean): IGameEvent;
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
  drawCard(cards: Array<IGameCard>): void;
  discardCard(num: number): void;
  giftCard(
    cards: IGameCard | Array<IGameCard>,
    targets: IGamePlayer | Array<IGamePlayer>
  ): void;
  recastCard(cards: IGameCard | Array<IGameCard>): void;
  upsertEquip(card: IGameCard, index: number): void;
  swapEquip(): void;
}
/**  GameStore */
export interface IGameConfig {
  mode: string;
  playerNum: number;
  maxHp: number;
  maxPower: number;
  equipNum: number;
  magicNum: number;
  runeNum: number;
  maxRound: number;
  initCardNum: number;
  phaseCardNum: number;
}
export interface IGameStoreState {
  heroModule: Array<any>;
  equipModule: Array<any>;
  magicModule: Array<any>;
  runeModule: Array<any>;
  fullHeroList: Array<IGameHero>;
  fullCardList: Array<IGameCard>;
  fullEffectMap: Record<string, Function>;
  config: IGameConfig;
  round: number;
  pause: boolean;
  over: boolean;
  event: null | IGameEvent;
  playerList: Array<IGamePlayer>;
  globalEffectMap: Record<string, Function>;
  effectMap: Record<string, Function>;
  cardList: Array<IGameCard>;
  discardList: Array<IGameCard>;
  current: null | IGamePlayer;
  me: null | IGamePlayer;
}
export interface IGameStoreActions {
  // get
  getGameConfig(): IGameConfig;
  getRound(): number;
  getPlayerList(): Array<IGamePlayer>;
  getGlobalEffectMap(): Record<string, Function>;
  getEffectMap(): Record<string, Function>;
  getCardList(): Array<IGameCard>;
  getDiscardList(): Array<IGameCard>;
  getCurrentPlayer(): null | IGamePlayer;
  getMe(): null | IGamePlayer;
  // set
  setRound(round: number): void;
  setCurrentPlayer(current: IGamePlayer): void;
}
