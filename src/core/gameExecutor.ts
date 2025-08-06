import { IGameEvent, IGameCore } from "@/core/game.types";

const GameExecutor: Record<string, Function> = {
  game: function (event: IGameEvent, game: IGameCore) {
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
  chooseHero: function (event: IGameEvent, game: IGameCore) {
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
  gameDraw: function (event: IGameEvent, game: IGameCore) {
    async function step1() {
      const playerList = game.getPlayerList();
      const initCardNum = game.getGameConfig().initCardNum;
      for (let i = 0; i < playerList.length; i++) {
        const player = playerList[i];
        const cards = game.getTopCards(initCardNum);
        player.drawCard(cards);
      }
    }
    return {
      step1,
    };
  },
  gamePhaseLoop: function (event: IGameEvent, game: IGameCore) {
    async function step1() {
      let round = game.getRound();
      const maxRound = game.getGameConfig().maxRound;
      const current = game.getCurrentPlayer();
      const seatNum = current?.seatNum;
      if (seatNum === 0) {
        game.setRound(round + 1);
        round = round + 1;
      }
      if (round > maxRound) {
        event.finish();
        return;
      }
      game.debug(`【${current!.name}】回合开始`);
      event.trigger("phase");
    }
    async function step2() {
      const playerList = game.getPlayerList();
      const current = game.getCurrentPlayer();
      const seatNum = current!.seatNum;
      const nextSeatNum = seatNum + 1 >= playerList.length ? 0 : seatNum + 1;
      game.setCurrentPlayer(playerList[nextSeatNum]);
      event.goto(1);
    }
    return {
      step1,
      step2,
    };
  },
  phase: function (event: IGameEvent, game: IGameCore) {
    async function step1() {
      await game.delay(3000);
      event.finish();
    }
    return {
      step1,
    };
  },
};

export default GameExecutor;
