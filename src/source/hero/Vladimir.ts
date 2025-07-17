function importModule() {
  return {
    type: "hero",
    id: "Vladimir",
    title: "猩红收割者",
    name: "弗拉基米尔",
    avatar: "Vladimir.png",
    skins: [
      { name: "default", skin: "Vladimir_0.jpg" },
      { name: "弗拉基米尔伯爵", skin: "Vladimir_1.jpg" },
      { name: "弗拉基米尔侯爵", skin: "Vladimir_2.jpg" },
      { name: "诺斯费拉图  弗拉基米尔", skin: "Vladimir_3.jpg" },
      { name: "霹雳游侠 弗拉基米尔", skin: "Vladimir_4.jpg" },
      { name: "血石领主 弗拉基米尔", skin: "Vladimir_5.jpg" },
      { name: "摄魂男爵 弗拉基米尔", skin: "Vladimir_6.jpg" },
      { name: "学生会长 弗拉基米尔", skin: "Vladimir_7.jpg" },
      { name: "黑潮 弗拉基米尔", skin: "Vladimir_8.jpg" },
      { name: "黑夜使者 弗拉基米尔", skin: "Vladimir_14.jpg" },
      { name: "波江星神 弗拉基米尔", skin: "Vladimir_21.jpg" },
      { name: "咖啡甜心 弗拉基米尔", skin: "Vladimir_30.jpg" },
      { name: "绝息圣堂 弗拉基米尔", skin: "Vladimir_39.jpg" },
    ],
    spells: [
      {
        id: "VladimirP",
        name: "血色契约",
        icon: "VladimirP.png",
        description: "",
      },
      {
        id: "VladimirQ",
        name: "鲜血转换",
        icon: "VladimirQ.png",
        description: "",
      },
      {
        id: "VladimirW",
        name: "血红之池",
        icon: "VladimirW.png",
        description: "",
      },
      {
        id: "VladimirE",
        name: "血之潮汐",
        icon: "VladimirE.png",
        description: "",
      },
      {
        id: "VladimirR",
        name: "血之瘟疫",
        icon: "VladimirR.png",
        description: "",
      },
    ],
    effects: {
      VladimirP: null,
      VladimirQ: null,
      VladimirW: null,
      VladimirE: null,
      VladimirR: null,
    },
  };
}
export { importModule };
