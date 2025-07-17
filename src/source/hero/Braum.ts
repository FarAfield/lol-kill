function importModule() {
  return {
    type: "hero",
    id: "Braum",
    title: "弗雷尔卓德之心",
    name: "布隆",
    avatar: "Braum.png",
    skins: [
      { name: "default", skin: "Braum_0.jpg" },
      { name: "屠龙勇士 布隆", skin: "Braum_1.jpg" },
      { name: "猛虎 布隆", skin: "Braum_2.jpg" },
      { name: "布隆·狮心", skin: "Braum_3.jpg" },
      { name: "圣诞老人 布隆", skin: "Braum_10.jpg" },
      { name: "黑帮管家 布隆", skin: "Braum_11.jpg" },
      { name: "糖果大战 布隆", skin: "Braum_24.jpg" },
      { name: "泳池派对 布隆", skin: "Braum_33.jpg" },
    ],
    spells: [
      { id: "BraumP", name: "震荡猛击", icon: "BraumP.png", description: "" },
      { id: "BraumQ", name: "寒冬之咬", icon: "BraumQ.png", description: "" },
      { id: "BraumW", name: "挺身而出", icon: "BraumW.png", description: "" },
      { id: "BraumE", name: "坚不可摧", icon: "BraumE.png", description: "" },
      { id: "BraumR", name: "冰川裂隙", icon: "BraumR.png", description: "" },
    ],
    effects: {
      BraumP: null,
      BraumQ: null,
      BraumW: null,
      BraumE: null,
      BraumR: null,
    },
  };
}
export { importModule };
