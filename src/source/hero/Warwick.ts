function importModule() {
  return {
    type: "hero",
    id: "Warwick",
    title: "祖安怒兽",
    name: "沃里克",
    avatar: "Warwick.png",
    skins: [
      { name: "default", skin: "Warwick_0.jpg" },
      { name: "暗影 沃里克", skin: "Warwick_1.jpg" },
      { name: "披着海牛的狼 沃里克", skin: "Warwick_2.jpg" },
      { name: "狼外婆 沃里克", skin: "Warwick_3.jpg" },
      { name: "冻原猎手 沃里克", skin: "Warwick_4.jpg" },
      { name: "嗜血狂暴 沃里克", skin: "Warwick_5.jpg" },
      { name: "火牙狼人 沃里克", skin: "Warwick_6.jpg" },
      { name: "荒野豺狼 沃里克", skin: "Warwick_7.jpg" },
      { name: "黑暗骑士 沃里克", skin: "Warwick_8.jpg" },
      { name: "海牛狼人 沃里克", skin: "Warwick_9.jpg" },
      { name: "南天之怒 沃里克 ", skin: "Warwick_10.jpg" },
      { name: "源计划：末日 沃里克", skin: "Warwick_16.jpg" },
      { name: "古神 沃里克", skin: "Warwick_35.jpg" },
      { name: "北极星使者 沃里克", skin: "Warwick_45.jpg" },
      { name: "至臻 北极星使者 沃里克", skin: "Warwick_46.jpg" },
    ],
    spells: [
      {
        id: "WarwickP",
        name: "血之饥渴",
        icon: "WarwickP.png",
        description: "",
      },
      {
        id: "WarwickQ",
        name: "野兽之口",
        icon: "WarwickQ.png",
        description: "",
      },
      {
        id: "WarwickW",
        name: "鲜血追猎",
        icon: "WarwickW.png",
        description: "",
      },
      {
        id: "WarwickE",
        name: "远祖嗥叫",
        icon: "WarwickE.png",
        description: "",
      },
      {
        id: "WarwickR",
        name: "无尽束缚",
        icon: "WarwickR.png",
        description: "",
      },
    ],
    effects: {
      WarwickP: null,
      WarwickQ: null,
      WarwickW: null,
      WarwickE: null,
      WarwickR: null,
    },
  };
}
export { importModule };
