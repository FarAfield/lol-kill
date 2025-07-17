function importModule() {
  return {
    type: "hero",
    id: "Elise",
    title: "蜘蛛女皇",
    name: "伊莉丝",
    avatar: "Elise.png",
    skins: [
      { name: "default", skin: "Elise_0.jpg" },
      { name: "死亡绽放 伊莉丝", skin: "Elise_1.jpg" },
      { name: "胜利女神 伊莉丝", skin: "Elise_2.jpg" },
      { name: "腥红之月 伊莉丝", skin: "Elise_3.jpg" },
      { name: "SKT T1 伊莉丝", skin: "Elise_4.jpg" },
      { name: "银河魔装机神 伊莉丝", skin: "Elise_5.jpg" },
      { name: "魅惑女巫 伊莉丝", skin: "Elise_6.jpg" },
      { name: "幽梦玫瑰 伊莉丝", skin: "Elise_15.jpg" },
      { name: "魔女 伊莉丝", skin: "Elise_24.jpg" },
    ],
    spells: [
      { id: "EliseP", name: "蜘蛛女皇", icon: "EliseP.png", description: "" },
      {
        id: "EliseQ",
        name: "神经毒素 / 剧毒之蜇",
        icon: "EliseQ.png",
        description: "",
      },
      {
        id: "EliseW",
        name: "自爆蜘蛛 / 掠行狂暴",
        icon: "EliseW.png",
        description: "",
      },
      {
        id: "EliseE",
        name: "结茧 / 盘丝",
        icon: "EliseE.png",
        description: "",
      },
      { id: "EliseR", name: "蜘蛛形态", icon: "EliseR.png", description: "" },
    ],
    effects: {
      EliseP: null,
      EliseQ: null,
      EliseW: null,
      EliseE: null,
      EliseR: null,
    },
  };
}
export { importModule };
