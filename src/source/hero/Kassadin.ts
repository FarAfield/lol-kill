function importModule() {
  return {
    type: "hero",
    id: "Kassadin",
    title: "虚空行者",
    name: "卡萨丁",
    avatar: "Kassadin.png",
    skins: [
      { name: "default", skin: "Kassadin_0.jpg" },
      { name: "寒冰王座 卡萨丁", skin: "Kassadin_1.jpg" },
      { name: "深海一号 卡萨丁", skin: "Kassadin_2.jpg" },
      { name: "虚空前世 卡萨丁", skin: "Kassadin_3.jpg" },
      { name: "先驱行者 卡萨丁", skin: "Kassadin_4.jpg" },
      { name: "掠星魔刃 卡萨丁", skin: "Kassadin_5.jpg" },
      { name: "伯爵 卡萨丁", skin: "Kassadin_6.jpg" },
      { name: "海克斯科技 卡萨丁", skin: "Kassadin_14.jpg" },
      { name: "冲击之刃 卡萨丁", skin: "Kassadin_15.jpg" },
      { name: "神龙尊者 星界之龙 卡萨丁", skin: "Kassadin_24.jpg" },
    ],
    spells: [
      {
        id: "KassadinP",
        name: "虚空之石",
        icon: "KassadinP.png",
        description: "",
      },
      {
        id: "KassadinQ",
        name: "虚无法球",
        icon: "KassadinQ.png",
        description: "",
      },
      {
        id: "KassadinW",
        name: "虚空之刃",
        icon: "KassadinW.png",
        description: "",
      },
      {
        id: "KassadinE",
        name: "能量脉冲",
        icon: "KassadinE.png",
        description: "",
      },
      {
        id: "KassadinR",
        name: "虚空行走",
        icon: "KassadinR.png",
        description: "",
      },
    ],
    effects: {
      KassadinP: null,
      KassadinQ: null,
      KassadinW: null,
      KassadinE: null,
      KassadinR: null,
    },
  };
}
export { importModule };
