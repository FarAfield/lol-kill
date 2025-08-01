import { IGameEvent, IGameEngine } from "@/core/game.types";

const GameExecutor: Record<string, Function> = {
  game: function (event: IGameEvent, game: IGameEngine) {
    function step1() {
      // 创建玩家
      game.createPlayer();
      // 创建卡牌
      game.createCard();
      // 洗牌
      game.washCard();
      // 选择英雄
      event.trigger("chooseHero", true);
    }
    function step2() {
      event.trigger("gameStart", true);
    }
    function step3() {
      event.trigger("gameDraw", true);
    }
    function step4() {
      event.trigger("gamePhaseLoop", true);
    }
    function step5() {
      event.trigger("gameOver");
    }
    return {
      step1,
      step2,
      step3,
      step4,
      step5,
    };
  },
  chooseHero: function (event: IGameEvent, game: IGameEngine) {
    async function step1() {
      const playerList = game.getPlayerList();
      const me = game.getMe();
      for (let i = 0; i < playerList.length; i++) {
        const player = playerList[i];
        const hero = await game.chooseHero(player.seatNum === me?.seatNum);
        player.chooseHero(hero);
      }
    }
    return {
      step1,
    };
  },
  gameDraw: function (event: IGameEvent, game: IGameEngine) {
    async function step1() {
      const playerList = game.getPlayerList();
      for (let i = 0; i < playerList.length; i++) {
        const player = playerList[i];
        player.drawCard(2);
      }
    }
    return {
      step1,
    };
  },
};

export default GameExecutor;
