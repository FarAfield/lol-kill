function importModule() {
  return {
    type: "hero",
    id: "Gnar",
    title: "迷失之牙",
    name: "纳尔",
    avatar: "Gnar.png",
    skins: [
      { name: "default", skin: "Gnar_0.jpg" },
      { name: "最后一只恐龙 纳尔", skin: "Gnar_1.jpg" },
      { name: "萌侦探 喵尔摩斯", skin: "Gnar_2.jpg" },
      { name: "冰雪兽 纳尔", skin: "Gnar_3.jpg" },
      { name: "狂狮 纳尔", skin: "Gnar_4.jpg" },
      { name: "银河魔装机神 纳尔", skin: "Gnar_13.jpg" },
      { name: "SSG 纳尔", skin: "Gnar_14.jpg" },
      { name: "宇航员 纳尔", skin: "Gnar_15.jpg" },
      { name: "永恒之森 纳尔", skin: "Gnar_22.jpg" },
      { name: "灵之菊 纳尔", skin: "Gnar_31.jpg" },
    ],
    spells: [
      { id: "GnarP", name: "狂怒基因", icon: "GnarP.png", description: "" },
      {
        id: "GnarQ",
        name: "投掷回力标 / 投掷顽石",
        icon: "GnarQ.png",
        description: "",
      },
      { id: "GnarW", name: "亢奋 /  痛殴", icon: "GnarW.png", description: "" },
      { id: "GnarE", name: "轻跳 / 猛踏", icon: "GnarE.png", description: "" },
      { id: "GnarR", name: "呐啊！", icon: "GnarR.png", description: "" },
    ],
    effects: {
      GnarP: null,
      GnarQ: null,
      GnarW: null,
      GnarE: null,
      GnarR: null,
    },
  };
}
export { importModule };
