function importModule() {
  return {
    type: "hero",
    id: "Vi",
    title: "皮城执法官",
    name: "蔚",
    avatar: "Vi.png",
    skins: [
      { name: "default", skin: "Vi_0.jpg" },
      { name: "霓虹杀拳 蔚", skin: "Vi_1.jpg" },
      { name: "女警官 蔚", skin: "Vi_2.jpg" },
      { name: "铁拳执事 蔚", skin: "Vi_3.jpg" },
      { name: "炼狱魔女 蔚", skin: "Vi_4.jpg" },
      { name: "虎痴之拳 蔚", skin: "Vi_5.jpg" },
      { name: "源计划：裁决 蔚", skin: "Vi_11.jpg" },
      { name: "碎心之拳 蔚", skin: "Vi_12.jpg" },
      { name: "灵能特工 蔚", skin: "Vi_20.jpg" },
      { name: "双城之战 蔚", skin: "Vi_29.jpg" },
      { name: "意乱情迷 蔚", skin: "Vi_30.jpg" },
      { name: "伏虎之力 蔚", skin: "Vi_39.jpg" },
    ],
    spells: [
      { id: "ViP", name: "爆裂护盾", icon: "ViP.png", description: "" },
      { id: "ViQ", name: "强能冲拳", icon: "ViQ.png", description: "" },
      { id: "ViW", name: "爆弹重拳", icon: "ViW.png", description: "" },
      { id: "ViE", name: "透体之劲", icon: "ViE.png", description: "" },
      { id: "ViR", name: "天霸横空烈轰", icon: "ViR.png", description: "" },
    ],
    effects: { ViP: null, ViQ: null, ViW: null, ViE: null, ViR: null },
  };
}
export { importModule };
