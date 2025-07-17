function importModule() {
  return {
    type: "hero",
    id: "Jhin",
    title: "戏命师",
    name: "烬",
    avatar: "Jhin.png",
    skins: [
      { name: "default", skin: "Jhin_0.jpg" },
      { name: "西部牛仔 烬", skin: "Jhin_1.jpg" },
      { name: "腥红之月 烬", skin: "Jhin_2.jpg" },
      { name: "SKT T1 烬", skin: "Jhin_3.jpg" },
      { name: "源计划：升华 烬", skin: "Jhin_4.jpg" },
      { name: "暗星尊 烬", skin: "Jhin_5.jpg" },
      { name: "山海绘卷 烬", skin: "Jhin_14.jpg" },
      { name: "DWG 烬", skin: "Jhin_23.jpg" },
      { name: "至高天 烬", skin: "Jhin_25.jpg" },
      { name: "斗魂觉醒 烬", skin: "Jhin_36.jpg" },
      { name: "暗星绝杀 烬", skin: "Jhin_37.jpg" },
    ],
    spells: [
      { id: "JhinP", name: "低语", icon: "JhinP.png", description: "" },
      { id: "JhinQ", name: "曼舞手雷", icon: "JhinQ.png", description: "" },
      { id: "JhinW", name: "致命华彩", icon: "JhinW.png", description: "" },
      { id: "JhinE", name: "万众倾倒", icon: "JhinE.png", description: "" },
      { id: "JhinR", name: "完美谢幕", icon: "JhinR.png", description: "" },
    ],
    effects: {
      JhinP: null,
      JhinQ: null,
      JhinW: null,
      JhinE: null,
      JhinR: null,
    },
  };
}
export { importModule };
