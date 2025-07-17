function importModule() {
  return {
    type: "hero",
    id: "Darius",
    title: "诺克萨斯之手",
    name: "德莱厄斯",
    avatar: "Darius.png",
    skins: [
      { name: "default", skin: "Darius_0.jpg" },
      { name: "铁血帝皇 德莱厄斯", skin: "Darius_1.jpg" },
      { name: "生化骑士 德莱厄斯", skin: "Darius_2.jpg" },
      { name: "勇敢的心 德莱厄斯", skin: "Darius_3.jpg" },
      { name: "灌篮高手 德莱厄斯", skin: "Darius_4.jpg" },
      { name: "热血班长 德莱厄斯", skin: "Darius_8.jpg" },
      { name: "恐惧新星 德莱厄斯", skin: "Darius_14.jpg" },
      { name: "神王 德莱厄斯", skin: "Darius_15.jpg" },
      { name: "西部魔影 德莱厄斯", skin: "Darius_16.jpg" },
      { name: "福牛守护者 德莱厄斯", skin: "Darius_24.jpg" },
      { name: "地下都市 梦魇 德莱厄斯", skin: "Darius_33.jpg" },
      { name: "灵魂莲华 德莱厄斯", skin: "Darius_43.jpg" },
      { name: "青花瓷 德莱厄斯", skin: "Darius_54.jpg" },
      { name: "圣洁神王 德莱厄斯", skin: "Darius_64.jpg" },
    ],
    spells: [
      { id: "DariusP", name: "出血", icon: "DariusP.png", description: "" },
      { id: "DariusQ", name: "大杀四方", icon: "DariusQ.png", description: "" },
      { id: "DariusW", name: "致残打击", icon: "DariusW.png", description: "" },
      { id: "DariusE", name: "无情铁手", icon: "DariusE.png", description: "" },
      {
        id: "DariusR",
        name: "诺克萨斯断头台",
        icon: "DariusR.png",
        description: "",
      },
    ],
    effects: {
      DariusP: null,
      DariusQ: null,
      DariusW: null,
      DariusE: null,
      DariusR: null,
    },
  };
}
export { importModule };
