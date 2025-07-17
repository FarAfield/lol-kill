function importModule() {
  return {
    type: "hero",
    id: "Ziggs",
    title: "爆破鬼才",
    name: "吉格斯",
    avatar: "Ziggs.png",
    skins: [
      { name: "default", skin: "Ziggs_0.jpg" },
      { name: "科学狂人 吉格斯", skin: "Ziggs_1.jpg" },
      { name: "少校 吉格斯", skin: "Ziggs_2.jpg" },
      { name: "泳池派对 吉格斯", skin: "Ziggs_3.jpg" },
      { name: "雪球也能爆炸！ 吉格斯", skin: "Ziggs_4.jpg" },
      { name: "奥术大师 吉格斯", skin: "Ziggs_5.jpg" },
      { name: "战场BOSS 吉格斯", skin: "Ziggs_6.jpg" },
      { name: "奥德赛 吉格斯", skin: "Ziggs_7.jpg" },
      { name: "糖果大战 吉格斯", skin: "Ziggs_14.jpg" },
      { name: "海克斯科技 吉格斯", skin: "Ziggs_23.jpg" },
      { name: "小蜜蜂 吉格斯", skin: "Ziggs_24.jpg" },
      { name: "魂蔷薇 吉格斯", skin: "Ziggs_33.jpg" },
    ],
    spells: [
      { id: "ZiggsP", name: "一触即发", icon: "ZiggsP.png", description: "" },
      { id: "ZiggsQ", name: "弹跳炸弹", icon: "ZiggsQ.png", description: "" },
      { id: "ZiggsW", name: "定点爆破", icon: "ZiggsW.png", description: "" },
      {
        id: "ZiggsE",
        name: "海克斯爆破雷区",
        icon: "ZiggsE.png",
        description: "",
      },
      {
        id: "ZiggsR",
        name: "科学的地狱火炮",
        icon: "ZiggsR.png",
        description: "",
      },
    ],
    effects: {
      ZiggsP: null,
      ZiggsQ: null,
      ZiggsW: null,
      ZiggsE: null,
      ZiggsR: null,
    },
  };
}
export { importModule };
