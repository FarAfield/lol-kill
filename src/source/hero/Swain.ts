function importModule() {
  return {
    type: "hero",
    id: "Swain",
    title: "诺克萨斯统领",
    name: "斯维因",
    avatar: "Swain.png",
    skins: [
      { name: "default", skin: "Swain_0.jpg" },
      { name: "北领前线 斯维因", skin: "Swain_1.jpg" },
      { name: "海贼参谋 斯维因", skin: "Swain_2.jpg" },
      { name: "绝代智将 斯维因", skin: "Swain_3.jpg" },
      { name: "驯龙大师 斯维因", skin: "Swain_4.jpg" },
      { name: "海克斯科技 斯维因", skin: "Swain_11.jpg" },
      { name: "水晶玫瑰 斯维因", skin: "Swain_12.jpg" },
      { name: "北极星猎人 斯维因", skin: "Swain_21.jpg" },
    ],
    spells: [
      { id: "SwainP", name: "狂食鸦群", icon: "SwainP.png", description: "" },
      { id: "SwainQ", name: "解脱之触", icon: "SwainQ.png", description: "" },
      { id: "SwainW", name: "帝国视界", icon: "SwainW.png", description: "" },
      { id: "SwainE", name: "永不复行", icon: "SwainE.png", description: "" },
      { id: "SwainR", name: "恶魔升华", icon: "SwainR.png", description: "" },
    ],
    effects: {
      SwainP: null,
      SwainQ: null,
      SwainW: null,
      SwainE: null,
      SwainR: null,
    },
  };
}
export { importModule };
