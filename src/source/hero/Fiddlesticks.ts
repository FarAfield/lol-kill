function importModule() {
  return {
    type: "hero",
    id: "Fiddlesticks",
    title: "远古恐惧",
    name: "费德提克",
    avatar: "Fiddlesticks.png",
    skins: [
      { name: "default", skin: "Fiddlesticks_0.jpg" },
      { name: "幽魂 费德提克", skin: "Fiddlesticks_1.jpg" },
      { name: "联合王国 费德提克", skin: "Fiddlesticks_2.jpg" },
      { name: "荒野幽灵 费德提克", skin: "Fiddlesticks_3.jpg" },
      { name: "南瓜头 费德提克", skin: "Fiddlesticks_4.jpg" },
      { name: "铁钩船长 费德提克", skin: "Fiddlesticks_5.jpg" },
      { name: "惊悚派对 费德提克", skin: "Fiddlesticks_6.jpg" },
      { name: "糖果使徒 费德提克", skin: "Fiddlesticks_7.jpg" },
      { name: "重生之沙 费德提克", skin: "Fiddlesticks_8.jpg" },
      { name: "禁卫机甲 费德提克", skin: "Fiddlesticks_9.jpg" },
      { name: "星之吞噬者 费德提克", skin: "Fiddlesticks_27.jpg" },
      { name: "腥红之月 费德提克", skin: "Fiddlesticks_37.jpg" },
    ],
    spells: [
      {
        id: "FiddlesticksP",
        name: "巫骇草人",
        icon: "FiddlesticksP.png",
        description: "",
      },
      {
        id: "FiddlesticksQ",
        name: "恐惧",
        icon: "FiddlesticksQ.png",
        description: "",
      },
      {
        id: "FiddlesticksW",
        name: "五骨丰登",
        icon: "FiddlesticksW.png",
        description: "",
      },
      {
        id: "FiddlesticksE",
        name: "夜割",
        icon: "FiddlesticksE.png",
        description: "",
      },
      {
        id: "FiddlesticksR",
        name: "群鸦风暴",
        icon: "FiddlesticksR.png",
        description: "",
      },
    ],
    effects: {
      FiddlesticksP: null,
      FiddlesticksQ: null,
      FiddlesticksW: null,
      FiddlesticksE: null,
      FiddlesticksR: null,
    },
  };
}
export { importModule };
