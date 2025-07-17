function importModule() {
  return {
    type: "hero",
    id: "Maokai",
    title: "扭曲树精",
    name: "茂凯",
    avatar: "Maokai.png",
    skins: [
      { name: "default", skin: "Maokai_0.jpg" },
      { name: "烈焰古树 茂凯", skin: "Maokai_1.jpg" },
      { name: "图腾古树 茂凯", skin: "Maokai_2.jpg" },
      { name: "喜庆之树 茂凯", skin: "Maokai_3.jpg" },
      { name: "鬼影森森 茂凯", skin: "Maokai_4.jpg" },
      { name: "绿茵门神 茂凯", skin: "Maokai_5.jpg" },
      { name: "喵凯", skin: "Maokai_6.jpg" },
      { name: "胜利之树 茂凯", skin: "Maokai_7.jpg" },
      { name: "创世之神 茂凯", skin: "Maokai_16.jpg" },
      { name: "宇航员 茂凯", skin: "Maokai_24.jpg" },
      { name: "DRX 茂凯", skin: "Maokai_33.jpg" },
    ],
    spells: [
      { id: "MaokaiP", name: "吸元秘术", icon: "MaokaiP.png", description: "" },
      { id: "MaokaiQ", name: "荆棘重击", icon: "MaokaiQ.png", description: "" },
      { id: "MaokaiW", name: "扭曲突刺", icon: "MaokaiW.png", description: "" },
      { id: "MaokaiE", name: "树苗投掷", icon: "MaokaiE.png", description: "" },
      { id: "MaokaiR", name: "自然之握", icon: "MaokaiR.png", description: "" },
    ],
    effects: {
      MaokaiP: null,
      MaokaiQ: null,
      MaokaiW: null,
      MaokaiE: null,
      MaokaiR: null,
    },
  };
}
export { importModule };
