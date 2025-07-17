import { IGameCard, IGamePlayer } from "@/core/game.types";

class Card implements IGameCard {
  package: string;
  type: string;
  id: string;
  name: string;
  image: string;
  description: string;
  // 牌面知情者id
  knowers: Array<string> = [];
  // 是否是虚拟牌
  isVirtual: boolean = false;

  constructor(card: IGameCard) {
    this.package = card.package;
    this.type = card.type;
    this.id = card.id;
    this.name = card.name;
    this.image = card.image;
    this.description = card.description;
  }

  /** 牌知情者 */
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
