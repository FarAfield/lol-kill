function importModule() {
  return {
    type: "hero",
    id: "Varus",
    title: "惩戒之箭",
    name: "韦鲁斯",
    avatar: "Varus.png",
    skins: [
      { name: "default", skin: "Varus_0.jpg" },
      { name: "夜魔水晶 韦鲁斯", skin: "Varus_1.jpg" },
      { name: "苍穹之光 韦鲁斯", skin: "Varus_2.jpg" },
      { name: "白色死神 韦鲁斯", skin: "Varus_3.jpg" },
      { name: "觅心射手 韦鲁斯", skin: "Varus_4.jpg" },
      { name: "韦鲁斯·迅箭", skin: "Varus_5.jpg" },
      { name: "暗星 韦鲁斯", skin: "Varus_6.jpg" },
      { name: "征服者 韦鲁斯", skin: "Varus_7.jpg" },
      { name: "地狱火 韦鲁斯", skin: "Varus_9.jpg" },
      { name: "源计划：天眼 韦鲁斯", skin: "Varus_16.jpg" },
      { name: "猎户星神 韦鲁斯", skin: "Varus_17.jpg" },
      { name: "西部魔影 天使 韦鲁斯", skin: "Varus_34.jpg" },
      { name: "净雪之月 韦鲁斯", skin: "Varus_44.jpg" },
      { name: "至高天 韦鲁斯", skin: "Varus_53.jpg" },
    ],
    spells: [
      { id: "VarusP", name: "复仇之欲", icon: "VarusP.png", description: "" },
      { id: "VarusQ", name: "穿刺之箭", icon: "VarusQ.png", description: "" },
      { id: "VarusW", name: "枯萎箭袋", icon: "VarusW.png", description: "" },
      { id: "VarusE", name: "恶灵箭雨", icon: "VarusE.png", description: "" },
      { id: "VarusR", name: "腐败锁链", icon: "VarusR.png", description: "" },
    ],
    effects: {
      VarusP: null,
      VarusQ: null,
      VarusW: null,
      VarusE: null,
      VarusR: null,
    },
  };
}
export { importModule };
