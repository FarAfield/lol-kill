function importModule() {
  return {
    type: "hero",
    id: "Karma",
    title: "天启者",
    name: "卡尔玛",
    avatar: "Karma.png",
    skins: [
      { name: "default", skin: "Karma_0.jpg" },
      { name: "日冕女神 卡尔玛", skin: "Karma_1.jpg" },
      { name: "樱花乱舞 卡尔玛", skin: "Karma_2.jpg" },
      { name: "传统服饰 卡尔玛", skin: "Karma_3.jpg" },
      { name: "莲花之令 卡尔玛", skin: "Karma_4.jpg" },
      { name: "光明骑士 卡尔玛", skin: "Karma_5.jpg" },
      { name: "冬季仙境 卡尔玛", skin: "Karma_6.jpg" },
      { name: "征服者 卡尔玛", skin: "Karma_7.jpg" },
      { name: "暗星 卡尔玛", skin: "Karma_8.jpg" },
      { name: "黎明使者 卡尔玛", skin: "Karma_19.jpg" },
      { name: "奥德赛 卡尔玛", skin: "Karma_26.jpg" },
      { name: "破败军团 卡尔玛", skin: "Karma_27.jpg" },
      { name: "神龙尊者 宁静之龙 卡尔玛", skin: "Karma_44.jpg" },
      { name: "花仙女王 卡尔玛", skin: "Karma_54.jpg" },
      { name: "地狱火 卡尔玛", skin: "Karma_61.jpg" },
    ],
    spells: [
      { id: "KarmaP", name: "聚能之炎", icon: "KarmaP.png", description: "" },
      { id: "KarmaQ", name: "心灵烈焰", icon: "KarmaQ.png", description: "" },
      { id: "KarmaW", name: "坚定不移", icon: "KarmaW.png", description: "" },
      { id: "KarmaE", name: "鼓舞", icon: "KarmaE.png", description: "" },
      { id: "KarmaR", name: "梵咒", icon: "KarmaR.png", description: "" },
    ],
    effects: {
      KarmaP: null,
      KarmaQ: null,
      KarmaW: null,
      KarmaE: null,
      KarmaR: null,
    },
  };
}
export { importModule };
