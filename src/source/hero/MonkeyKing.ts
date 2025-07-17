function importModule() {
  return {
    type: "hero",
    id: "MonkeyKing",
    title: "齐天大圣",
    name: "孙悟空",
    avatar: "MonkeyKing.png",
    skins: [
      { name: "default", skin: "MonkeyKing_0.jpg" },
      { name: "三昧真火 孙悟空", skin: "MonkeyKing_1.jpg" },
      { name: "斗战胜佛 孙悟空", skin: "MonkeyKing_2.jpg" },
      { name: "定海神珍 孙悟空", skin: "MonkeyKing_3.jpg" },
      { name: "地狱行者 孙悟空", skin: "MonkeyKing_4.jpg" },
      { name: "美猴王 孙悟空", skin: "MonkeyKing_5.jpg" },
      { name: "破空枪骑 孙悟空", skin: "MonkeyKing_6.jpg" },
      { name: "战斗学院 孙悟空", skin: "MonkeyKing_7.jpg" },
      { name: "永恒之森 孙悟空", skin: "MonkeyKing_16.jpg" },
    ],
    spells: [
      {
        id: "MonkeyKingP",
        name: "金刚不坏",
        icon: "MonkeyKingP.png",
        description: "",
      },
      {
        id: "MonkeyKingQ",
        name: "粉碎打击",
        icon: "MonkeyKingQ.png",
        description: "",
      },
      {
        id: "MonkeyKingW",
        name: "真假猴王",
        icon: "MonkeyKingW.png",
        description: "",
      },
      {
        id: "MonkeyKingE",
        name: "腾云突击",
        icon: "MonkeyKingE.png",
        description: "",
      },
      {
        id: "MonkeyKingR",
        name: "大闹天宫",
        icon: "MonkeyKingR.png",
        description: "",
      },
    ],
    effects: {
      MonkeyKingP: null,
      MonkeyKingQ: null,
      MonkeyKingW: null,
      MonkeyKingE: null,
      MonkeyKingR: null,
    },
  };
}
export { importModule };
