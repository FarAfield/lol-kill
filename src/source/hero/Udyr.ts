function importModule() {
  return {
    type: "hero",
    id: "Udyr",
    title: "兽灵行者",
    name: "乌迪尔",
    avatar: "Udyr.png",
    skins: [
      { name: "default", skin: "Udyr_0.jpg" },
      { name: "武力全开 乌迪尔", skin: "Udyr_1.jpg" },
      { name: "四神之力 乌迪尔", skin: "Udyr_2.jpg" },
      { name: "灵魂守卫 乌迪尔", skin: "Udyr_3.jpg" },
      { name: "这货不是乌迪尔", skin: "Udyr_4.jpg" },
      { name: "龙神之力 乌迪尔", skin: "Udyr_5.jpg" },
      { name: "墨影行者 乌迪尔", skin: "Udyr_6.jpg" },
    ],
    spells: [
      { id: "UdyrP", name: "众灵纽带", icon: "UdyrP.png", description: "" },
      { id: "UdyrQ", name: "狂暴爪击", icon: "UdyrQ.png", description: "" },
      { id: "UdyrW", name: "坚铁甲胄", icon: "UdyrW.png", description: "" },
      { id: "UdyrE", name: "踏火蛮冲", icon: "UdyrE.png", description: "" },
      { id: "UdyrR", name: "极凌飓风", icon: "UdyrR.png", description: "" },
    ],
    effects: {
      UdyrP: null,
      UdyrQ: null,
      UdyrW: null,
      UdyrE: null,
      UdyrR: null,
    },
  };
}
export { importModule };
