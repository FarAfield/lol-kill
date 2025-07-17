function importModule() {
  return {
    type: "hero",
    id: "Graves",
    title: "法外狂徒",
    name: "格雷福斯",
    avatar: "Graves.png",
    skins: [
      { name: "default", skin: "Graves_0.jpg" },
      { name: "怒之火炮 格雷福斯", skin: "Graves_1.jpg" },
      { name: "杀出重围 格雷福斯", skin: "Graves_2.jpg" },
      { name: "黑帮教父 格雷福斯", skin: "Graves_3.jpg" },
      { name: "防暴士兵 格雷福斯", skin: "Graves_4.jpg" },
      { name: "泳池派对 格雷福斯", skin: "Graves_5.jpg" },
      { name: "无情重炮 格雷福斯", skin: "Graves_6.jpg" },
      { name: "冰雪节 格雷福斯", skin: "Graves_7.jpg" },
      { name: "胜利枪神 格雷福斯", skin: "Graves_14.jpg" },
      { name: "禁卫机甲 格雷福斯", skin: "Graves_18.jpg" },
      { name: "战斗教授 格雷福斯", skin: "Graves_25.jpg" },
      { name: "光明哨兵 格雷福斯", skin: "Graves_35.jpg" },
      { name: "EDG 格雷福斯", skin: "Graves_42.jpg" },
      { name: "青花瓷 格雷福斯", skin: "Graves_45.jpg" },
    ],
    spells: [
      { id: "GravesP", name: "新命运", icon: "GravesP.png", description: "" },
      { id: "GravesQ", name: "穷途末路", icon: "GravesQ.png", description: "" },
      { id: "GravesW", name: "烟幕弹", icon: "GravesW.png", description: "" },
      { id: "GravesE", name: "快速拔枪", icon: "GravesE.png", description: "" },
      { id: "GravesR", name: "终极爆弹", icon: "GravesR.png", description: "" },
    ],
    effects: {
      GravesP: null,
      GravesQ: null,
      GravesW: null,
      GravesE: null,
      GravesR: null,
    },
  };
}
export { importModule };
