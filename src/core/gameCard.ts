import { IGameCard, IGamePlayer } from "@/core/game.types";
import { getUUID } from "@/core/utils";

class Card implements IGameCard {
  package: string;
  // 卡牌基础属性
  type: string;
  id: string;
  name: string;
  image: string;
  description: string;
  // 卡牌标签
  tags: Array<string> = [];
  // 牌面知情者id
  knowers: Array<string> = [];
  // 是否是虚拟牌
  isVirtual: boolean = false;

  constructor(card: IGameCard) {
    this.package = card.package;
    this.type = card.type;
    this.id = card.id + "_" + getUUID();
    this.name = card.name;
    this.image = card.image;
    this.description = card.description;
  }

  getCardId() {
    return this.id.split("_")[0];
  }

  setIsVirtual(isVirtual: boolean) {
    this.isVirtual = isVirtual;
  }

  destroy() {
    this.tags = [];
    this.knowers = [];
  }

  addTag(tag: string) {
    this.tags.push(tag);
  }
  removeTag(tag: string) {
    this.tags = this.tags.filter((i) => i !== tag);
  }
  clearTags() {
    this.tags = [];
  }
  hasTag(tag: string) {
    return this.tags.includes(tag);
  }

  addKnower(player: IGamePlayer) {
    this.knowers.push(player.id);
  }
  removeKnower(player: IGamePlayer) {
    this.knowers = this.knowers.filter((i) => i !== player.id);
  }
  clearKnowers() {
    this.knowers = [];
  }
  isKnower(player: IGamePlayer) {
    return this.knowers.includes(player.id);
  }
}

export default Card;
