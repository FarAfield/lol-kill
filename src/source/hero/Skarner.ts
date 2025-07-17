function importModule() {
  return {
    type: "hero",
    id: "Skarner",
    title: "上古领主",
    name: "斯卡纳",
    avatar: "Skarner.png",
    skins: [
      { name: "default", skin: "Skarner_0.jpg" },
      { name: "沙暴巨蝎 斯卡纳", skin: "Skarner_1.jpg" },
      { name: "远土之灵 斯卡纳", skin: "Skarner_2.jpg" },
      { name: "战地机甲 斯卡纳", skin: "Skarner_3.jpg" },
      { name: "沙之守护 斯卡纳", skin: "Skarner_4.jpg" },
      { name: "天蝎星神 斯卡纳", skin: "Skarner_5.jpg" },
    ],
    spells: [
      { id: "SkarnerP", name: "战栗", icon: "SkarnerP.png", description: "" },
      {
        id: "SkarnerQ",
        name: "撼地 / 擎天",
        icon: "SkarnerQ.png",
        description: "",
      },
      {
        id: "SkarnerW",
        name: "震地壁垒",
        icon: "SkarnerW.png",
        description: "",
      },
      {
        id: "SkarnerE",
        name: "以绪塔尔冲击",
        icon: "SkarnerE.png",
        description: "",
      },
      {
        id: "SkarnerR",
        name: "毒刺贯体",
        icon: "SkarnerR.png",
        description: "",
      },
    ],
    effects: {
      SkarnerP: null,
      SkarnerQ: null,
      SkarnerW: null,
      SkarnerE: null,
      SkarnerR: null,
    },
  };
}
export { importModule };
