function importModule() {
  return {
    type: "hero",
    id: "Talon",
    title: "刀锋之影",
    name: "泰隆",
    avatar: "Talon.png",
    skins: [
      { name: "default", skin: "Talon_0.jpg" },
      { name: "刺客信条 泰隆", skin: "Talon_1.jpg" },
      { name: "血色精锐 泰隆", skin: "Talon_2.jpg" },
      { name: "银龙裁决 泰隆", skin: "Talon_3.jpg" },
      { name: "SSW 泰隆", skin: "Talon_4.jpg" },
      { name: "腥红之月 泰隆", skin: "Talon_5.jpg" },
      { name: "玉剑传说 无影", skin: "Talon_12.jpg" },
      { name: "泰隆 · 黑木", skin: "Talon_20.jpg" },
      { name: "幽梦玫瑰 泰隆", skin: "Talon_29.jpg" },
      { name: "西部魔影 猎天使恶魔 泰隆", skin: "Talon_38.jpg" },
      { name: "至臻 西部魔影 猎天使恶魔 泰隆", skin: "Talon_39.jpg" },
      { name: "伏虎之力 泰隆", skin: "Talon_49.jpg" },
    ],
    spells: [
      { id: "TalonP", name: "刀锋之末", icon: "TalonP.png", description: "" },
      {
        id: "TalonQ",
        name: "诺克萨斯式外交",
        icon: "TalonQ.png",
        description: "",
      },
      { id: "TalonW", name: "斩草除根", icon: "TalonW.png", description: "" },
      { id: "TalonE", name: "刺客之道", icon: "TalonE.png", description: "" },
      { id: "TalonR", name: "暗影突袭", icon: "TalonR.png", description: "" },
    ],
    effects: {
      TalonP: null,
      TalonQ: null,
      TalonW: null,
      TalonE: null,
      TalonR: null,
    },
  };
}
export { importModule };
