function importModule() {
  return {
    type: "hero",
    id: "Soraka",
    title: "众星之子",
    name: "索拉卡",
    avatar: "Soraka.png",
    skins: [
      { name: "default", skin: "Soraka_0.jpg" },
      { name: "森林女神 索拉卡", skin: "Soraka_1.jpg" },
      { name: "月光女神阿忒弥斯 索拉卡", skin: "Soraka_2.jpg" },
      { name: "圣洁化身 索拉卡", skin: "Soraka_3.jpg" },
      { name: "灵魂收割者 索拉卡", skin: "Soraka_4.jpg" },
      { name: "蕉泥座人 索拉卡", skin: "Soraka_5.jpg" },
      { name: "源代码 索拉卡", skin: "Soraka_6.jpg" },
      { name: "星之守护者 索拉卡", skin: "Soraka_7.jpg" },
      { name: "睡衣守护者 索拉卡", skin: "Soraka_8.jpg" },
      { name: "冬境仙灵 索拉卡", skin: "Soraka_9.jpg" },
      { name: "黎明使者 索拉卡", skin: "Soraka_15.jpg" },
      { name: "黑夜使者 索拉卡", skin: "Soraka_16.jpg" },
      { name: "至臻 星之守护者 索拉卡", skin: "Soraka_17.jpg" },
      { name: "咖啡甜心 索拉卡", skin: "Soraka_18.jpg" },
      { name: "灵魂莲华 索拉卡", skin: "Soraka_27.jpg" },
      { name: "玉剑传说 星仙子", skin: "Soraka_37.jpg" },
      { name: "花仙子 索拉卡", skin: "Soraka_44.jpg" },
    ],
    spells: [
      { id: "SorakaP", name: "拯救", icon: "SorakaP.png", description: "" },
      { id: "SorakaQ", name: "流星坠落", icon: "SorakaQ.png", description: "" },
      { id: "SorakaW", name: "星之灌注", icon: "SorakaW.png", description: "" },
      { id: "SorakaE", name: "星体结界", icon: "SorakaE.png", description: "" },
      { id: "SorakaR", name: "祈愿", icon: "SorakaR.png", description: "" },
    ],
    effects: {
      SorakaP: null,
      SorakaQ: null,
      SorakaW: null,
      SorakaE: null,
      SorakaR: null,
    },
  };
}
export { importModule };
