import { IGameCore, IGameEvent } from "@/core/game.types";

function importModule() {
  return [
    {
      type: "sword",
      id: "BloodThirstSword",
      name: "饮血剑",
      image: "BloodThirstSword.png",
      description: "",
      effects: {
        BloodThirstSword: (event: IGameEvent, game: IGameCore) => {
          return {
            trigger: { player: "current", event: "useCard" },
            action: () => {
              const current = game.getCurrentPlayer();
              current!.hp += 10;
            },
          };
        },
      },
    },
  ];
}

export { importModule };
