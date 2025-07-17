function importModule() {
  return {
    type: "hero",
    id: "Shen",
    title: "暮光之眼",
    name: "慎",
    avatar: "Shen.png",
    skins: [
      { name: "default", skin: "Shen_0.jpg" },
      { name: "极寒 慎", skin: "Shen_1.jpg" },
      { name: "炎爆 慎", skin: "Shen_2.jpg" },
      { name: "主治医师 慎", skin: "Shen_3.jpg" },
      { name: "腥红之月 鬼武者 慎", skin: "Shen_4.jpg" },
      { name: "战国大名 慎", skin: "Shen_5.jpg" },
      { name: "暗杀星 慎", skin: "Shen_6.jpg" },
      { name: "未来战士 慎", skin: "Shen_15.jpg" },
      { name: "奈落之炎 慎", skin: "Shen_16.jpg" },
      { name: "灵能特工 慎", skin: "Shen_22.jpg" },
      { name: "冲击之刃 慎", skin: "Shen_40.jpg" },
      { name: "灰烬守护者 慎", skin: "Shen_49.jpg" },
    ],
    spells: [
      { id: "ShenP", name: "忍法！气合盾", icon: "ShenP.png", description: "" },
      { id: "ShenQ", name: "奥义！暮临", icon: "ShenQ.png", description: "" },
      { id: "ShenW", name: "奥义！魂佑", icon: "ShenW.png", description: "" },
      { id: "ShenE", name: "奥义！影缚", icon: "ShenE.png", description: "" },
      {
        id: "ShenR",
        name: "秘奥义！慈悲度魂落",
        icon: "ShenR.png",
        description: "",
      },
    ],
    effects: {
      ShenP: null,
      ShenQ: null,
      ShenW: null,
      ShenE: null,
      ShenR: null,
    },
  };
}
export { importModule };
