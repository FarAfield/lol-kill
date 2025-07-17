function importModule() {
  return {
    type: "hero",
    id: "Zac",
    title: "生化魔人",
    name: "扎克",
    avatar: "Zac.png",
    skins: [
      { name: "default", skin: "Zac_0.jpg" },
      { name: "邪恶魔人 扎克", skin: "Zac_1.jpg" },
      { name: "泳池派对 扎克", skin: "Zac_2.jpg" },
      { name: "SKT T1 扎克", skin: "Zac_6.jpg" },
      { name: "战地机甲 扎克", skin: "Zac_7.jpg" },
      { name: "至高天 扎克", skin: "Zac_14.jpg" },
      { name: "香浓芝士 扎克", skin: "Zac_24.jpg" },
    ],
    spells: [
      { id: "ZacP", name: "细胞分裂", icon: "ZacP.png", description: "" },
      { id: "ZacQ", name: "延伸打击", icon: "ZacQ.png", description: "" },
      { id: "ZacW", name: "不稳定物质", icon: "ZacW.png", description: "" },
      { id: "ZacE", name: "橡筋弹弓", icon: "ZacE.png", description: "" },
      { id: "ZacR", name: "动感弹球", icon: "ZacR.png", description: "" },
    ],
    effects: { ZacP: null, ZacQ: null, ZacW: null, ZacE: null, ZacR: null },
  };
}
export { importModule };
