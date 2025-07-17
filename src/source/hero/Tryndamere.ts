function importModule() {
  return {
    type: "hero",
    id: "Tryndamere",
    title: "蛮族之王",
    name: "泰达米尔",
    avatar: "Tryndamere.png",
    skins: [
      { name: "default", skin: "Tryndamere_0.jpg" },
      { name: "勇敢的心 泰达米尔", skin: "Tryndamere_1.jpg" },
      { name: "国王 泰达米尔", skin: "Tryndamere_2.jpg" },
      { name: "诸神的黄昏 泰达米尔", skin: "Tryndamere_3.jpg" },
      { name: "恶魔之刃 泰达米尔", skin: "Tryndamere_4.jpg" },
      { name: "奥斯曼大帝 泰达米尔", skin: "Tryndamere_5.jpg" },
      { name: "关羽 云长", skin: "Tryndamere_6.jpg" },
      { name: "梦魇 泰达米尔", skin: "Tryndamere_7.jpg" },
      { name: "野兽猎人 泰达米尔", skin: "Tryndamere_8.jpg" },
      { name: "生化领主 泰达米尔", skin: "Tryndamere_9.jpg" },
      { name: "腥红之月 泰达米尔", skin: "Tryndamere_10.jpg" },
      { name: "黑夜使者 泰达米尔", skin: "Tryndamere_18.jpg" },
      { name: "胜利之王 泰达米尔", skin: "Tryndamere_27.jpg" },
    ],
    spells: [
      {
        id: "TryndamereP",
        name: "战斗狂怒",
        icon: "TryndamereP.png",
        description: "",
      },
      {
        id: "TryndamereQ",
        name: "嗜血杀戮",
        icon: "TryndamereQ.png",
        description: "",
      },
      {
        id: "TryndamereW",
        name: "蔑视",
        icon: "TryndamereW.png",
        description: "",
      },
      {
        id: "TryndamereE",
        name: "旋风斩",
        icon: "TryndamereE.png",
        description: "",
      },
      {
        id: "TryndamereR",
        name: "无尽怒火",
        icon: "TryndamereR.png",
        description: "",
      },
    ],
    effects: {
      TryndamereP: null,
      TryndamereQ: null,
      TryndamereW: null,
      TryndamereE: null,
      TryndamereR: null,
    },
  };
}
export { importModule };
