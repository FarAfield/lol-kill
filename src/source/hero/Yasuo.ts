function importModule() {
  return {
    type: "hero",
    id: "Yasuo",
    title: "疾风剑豪",
    name: "亚索",
    avatar: "Yasuo.png",
    skins: [
      { name: "default", skin: "Yasuo_0.jpg" },
      { name: "西部牛仔 亚索", skin: "Yasuo_1.jpg" },
      { name: "源计划：风 亚索", skin: "Yasuo_2.jpg" },
      { name: "腥红之月 亚索", skin: "Yasuo_3.jpg" },
      { name: "黑夜使者 亚索", skin: "Yasuo_9.jpg" },
      { name: "奥德赛 亚索", skin: "Yasuo_10.jpg" },
      { name: "战场BOSS 亚索", skin: "Yasuo_17.jpg" },
      { name: "真实伤害 亚索", skin: "Yasuo_18.jpg" },
      { name: "至臻 真实伤害 亚索", skin: "Yasuo_35.jpg" },
      { name: "灵魂莲华 亚索", skin: "Yasuo_36.jpg" },
      { name: "断浪之刃 亚索", skin: "Yasuo_45.jpg" },
      { name: "神龙尊者 昼日真龙 亚索", skin: "Yasuo_54.jpg" },
      { name: "神龙尊者 夜月幻龙 亚索", skin: "Yasuo_55.jpg" },
      { name: "墨之影武者 亚索", skin: "Yasuo_56.jpg" },
      { name: "至臻 墨之影武者 亚索", skin: "Yasuo_57.jpg" },
      { name: "预知之眼 亚索", skin: "Yasuo_68.jpg" },
      { name: "幻灵孤狼 亚索", skin: "Yasuo_77.jpg" },
      { name: "创世 黑夜使者 亚索", skin: "Yasuo_87.jpg" },
    ],
    spells: [
      { id: "YasuoP", name: "浪客之道", icon: "YasuoP.png", description: "" },
      { id: "YasuoQ", name: "斩钢闪", icon: "YasuoQ.png", description: "" },
      { id: "YasuoW", name: "风之障壁", icon: "YasuoW.png", description: "" },
      { id: "YasuoE", name: "踏前斩", icon: "YasuoE.png", description: "" },
      { id: "YasuoR", name: "狂风绝息斩", icon: "YasuoR.png", description: "" },
    ],
    effects: {
      YasuoP: null,
      YasuoQ: null,
      YasuoW: null,
      YasuoE: null,
      YasuoR: null,
    },
  };
}
export { importModule };
