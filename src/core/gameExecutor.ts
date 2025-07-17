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
      const heroList = game.getHeroList();
      const playerList = game.getPlayerList();
      const me = game.getMe();
      for (let i = 0; i < playerList.length; i++) {
        const player = playerList[i];
        const optionalHeroList = game
          .getUniqueRandomNumbers(0, heroList.length - 1, 3)
          .map((i) => heroList[i]);
        console.log(
          `玩家${player.name}可选英雄：${optionalHeroList.map((hero) => hero.name).join("、")}`
        );
        const hero = optionalHeroList[game.getRandomNumber(0, 2)];
        console.log(`玩家${player.name}选择英雄：${hero.name}`);
        player.chooseHero(hero);
      }
      console.log(playerList, me);
    }
    return {
      step1,
    };
  },
};

export default GameExecutor;
