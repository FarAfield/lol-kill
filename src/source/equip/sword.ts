import { IGameCore, IGameEvent, IGameEffect } from "@/core/game.types";
interface IModule {
  type: string;
  id: string;
  name: string;
  image: string;
  description: string;
  effects: Record<string, IGameEffect>;
}

function importModule(): Array<IModule> {
  return [
    // {
    //   type: "sword",
    //   id: "BloodThirstSword",
    //   name: "饮血剑",
    //   image: "BloodThirstSword.png",
    //   description: "",
    //   effects: {
    //     BloodThirstSword: {
    //       trigger: { player: "current" },
    //       content: (event: IGameEvent, game: IGameCore) => {
    //         const current = game.getCurrentPlayer();
    //         current!.hp += 10;
    //       },
    //     },
    //   },
    // },
    {
      type: "sword",
      id: "Test1",
      name: "测试1",
      image: "",
      description: "",
      effects: {
        Test1: {
          trigger: { player: "phaseUse" },
          content: (event: IGameEvent, game: IGameCore) => {
            const current = game.getCurrentPlayer();
            current!.hp += 10;
          },
        },
      },
    },
    {
      type: "sword",
      id: "Test2",
      name: "测试2",
      image: "",
      description: "",
      effects: {
        Test2: {
          trigger: { global: "phaseDiscard" },
          content: (event: IGameEvent, game: IGameCore) => {
            const current = game.getCurrentPlayer();
            current!.hp += 10;
          },
        },
      },
    },
    {
      type: "sword",
      id: "Test3",
      name: "测试3",
      image: "",
      description: "",
      effects: {
        Test3: {
          trigger: { player: "phaseDiscardAfter" },
          content: (event: IGameEvent, game: IGameCore) => {
            const current = game.getCurrentPlayer();
            current!.hp += 10;
          },
        },
      },
    },
    {
      type: "sword",
      id: "Test4",
      name: "测试4",
      image: "",
      description: "",
      effects: {
        Test4: {
          trigger: { target: "damage" },
          content: (event: IGameEvent, game: IGameCore) => {
            const current = game.getCurrentPlayer();
            current!.hp += 10;
          },
        },
      },
    },
  ];
}

export { importModule };
