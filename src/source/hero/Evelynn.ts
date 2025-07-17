function importModule() {
  return {
    type: "hero",
    id: "Evelynn",
    title: "痛苦之拥",
    name: "伊芙琳",
    avatar: "Evelynn.png",
    skins: [
      { name: "default", skin: "Evelynn_0.jpg" },
      { name: "黑暗女王 伊芙琳", skin: "Evelynn_1.jpg" },
      { name: "假面女皇 伊芙琳", skin: "Evelynn_2.jpg" },
      { name: "探戈灵魂 伊芙琳", skin: "Evelynn_3.jpg" },
      { name: "惊天魔盗 伊芙琳", skin: "Evelynn_4.jpg" },
      { name: "腥红之月 伊芙琳", skin: "Evelynn_5.jpg" },
      { name: "K/DA 伊芙琳", skin: "Evelynn_6.jpg" },
      { name: "至臻 K/DA 伊芙琳", skin: "Evelynn_7.jpg" },
      { name: "糖果大战 伊芙琳", skin: "Evelynn_8.jpg" },
      { name: "K/DA ALL OUT 伊芙琳", skin: "Evelynn_15.jpg" },
      { name: "魔女 伊芙琳", skin: "Evelynn_24.jpg" },
      { name: "至臻 K/DA 伊芙琳 (2022)", skin: "Evelynn_31.jpg" },
      { name: "灵魂莲华 伊芙琳", skin: "Evelynn_32.jpg" },
      { name: "斗魂觉醒 伊芙琳", skin: "Evelynn_42.jpg" },
      { name: "西部魔影 伊芙琳", skin: "Evelynn_52.jpg" },
      { name: "至臻 西部魔影 伊芙琳", skin: "Evelynn_53.jpg" },
    ],
    spells: [
      {
        id: "EvelynnP",
        name: "恶魔魅影",
        icon: "EvelynnP.png",
        description: "",
      },
      {
        id: "EvelynnQ",
        name: "憎恨之刺",
        icon: "EvelynnQ.png",
        description: "",
      },
      { id: "EvelynnW", name: "引诱", icon: "EvelynnW.png", description: "" },
      { id: "EvelynnE", name: "鞭笞", icon: "EvelynnE.png", description: "" },
      {
        id: "EvelynnR",
        name: "最终抚慰",
        icon: "EvelynnR.png",
        description: "",
      },
    ],
    effects: {
      EvelynnP: null,
      EvelynnQ: null,
      EvelynnW: null,
      EvelynnE: null,
      EvelynnR: null,
    },
  };
}
export { importModule };
