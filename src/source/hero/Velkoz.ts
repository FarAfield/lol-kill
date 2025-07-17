function importModule() {
  return {
    type: "hero",
    id: "Velkoz",
    title: "虚空之眼",
    name: "维克兹",
    avatar: "Velkoz.png",
    skins: [
      { name: "default", skin: "Velkoz_0.jpg" },
      { name: "战地机甲 维克兹", skin: "Velkoz_1.jpg" },
      { name: "苍穹之光 维克兹", skin: "Velkoz_2.jpg" },
      { name: "这货不是维克兹", skin: "Velkoz_3.jpg" },
      { name: "地狱火 维克兹", skin: "Velkoz_4.jpg" },
      { name: "黯晶之眼 维克兹", skin: "Velkoz_11.jpg" },
      { name: "天才蜂 维克兹", skin: "Velkoz_20.jpg" },
    ],
    spells: [
      {
        id: "VelkozP",
        name: "有机体解构",
        icon: "VelkozP.png",
        description: "",
      },
      {
        id: "VelkozQ",
        name: "等离子裂变",
        icon: "VelkozQ.png",
        description: "",
      },
      { id: "VelkozW", name: "虚空裂隙", icon: "VelkozW.png", description: "" },
      { id: "VelkozE", name: "构造分解", icon: "VelkozE.png", description: "" },
      {
        id: "VelkozR",
        name: "生命形态瓦解射线",
        icon: "VelkozR.png",
        description: "",
      },
    ],
    effects: {
      VelkozP: null,
      VelkozQ: null,
      VelkozW: null,
      VelkozE: null,
      VelkozR: null,
    },
  };
}
export { importModule };
