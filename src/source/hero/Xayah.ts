function importModule() {
  return {
    type: "hero",
    id: "Xayah",
    title: "逆羽",
    name: "霞",
    avatar: "Xayah.png",
    skins: [
      { name: "default", skin: "Xayah_0.jpg" },
      { name: "暮星之羽 霞", skin: "Xayah_1.jpg" },
      { name: "甜心之羽 霞", skin: "Xayah_2.jpg" },
      { name: "SSG 霞", skin: "Xayah_3.jpg" },
      { name: "星之守护者 霞", skin: "Xayah_4.jpg" },
      { name: "永恒之森 霞", skin: "Xayah_8.jpg" },
      { name: "神凰行者 烈羽焰凰 霞", skin: "Xayah_17.jpg" },
      { name: "至臻 神凰行者 烈羽焰凰 霞", skin: "Xayah_26.jpg" },
      { name: "比翼之心 霞", skin: "Xayah_28.jpg" },
      { name: "绝息圣堂 霞", skin: "Xayah_37.jpg" },
      { name: "星之守护者 净化之羽 霞", skin: "Xayah_38.jpg" },
      { name: "幻灵蝙蝠 霞", skin: "Xayah_47.jpg" },
    ],
    spells: [
      { id: "XayahP", name: "锐切", icon: "XayahP.png", description: "" },
      { id: "XayahQ", name: "双刃", icon: "XayahQ.png", description: "" },
      { id: "XayahW", name: "致死羽衣", icon: "XayahW.png", description: "" },
      { id: "XayahE", name: "倒钩", icon: "XayahE.png", description: "" },
      { id: "XayahR", name: "暴风羽刃", icon: "XayahR.png", description: "" },
    ],
    effects: {
      XayahP: null,
      XayahQ: null,
      XayahW: null,
      XayahE: null,
      XayahR: null,
    },
  };
}
export { importModule };
