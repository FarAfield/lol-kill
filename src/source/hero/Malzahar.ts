function importModule() {
  return {
    type: "hero",
    id: "Malzahar",
    title: "虚空先知",
    name: "玛尔扎哈",
    avatar: "Malzahar.png",
    skins: [
      { name: "default", skin: "Malzahar_0.jpg" },
      { name: "元老议会 玛尔扎哈", skin: "Malzahar_1.jpg" },
      { name: "暗影王子 玛尔扎哈", skin: "Malzahar_2.jpg" },
      { name: "魔灵 玛尔扎哈", skin: "Malzahar_3.jpg" },
      { name: "至高君王 玛尔扎哈", skin: "Malzahar_4.jpg" },
      { name: "冰雪节 玛尔扎哈", skin: "Malzahar_5.jpg" },
      { name: "战场BOSS 玛尔扎哈", skin: "Malzahar_6.jpg" },
      { name: "海克斯科技 玛尔扎哈", skin: "Malzahar_7.jpg" },
      { name: "创世之神 玛尔扎哈", skin: "Malzahar_9.jpg" },
      { name: "小蜜蜂 玛尔扎哈", skin: "Malzahar_18.jpg" },
      { name: "虚空执事 玛尔扎哈", skin: "Malzahar_28.jpg" },
      { name: "荣誉使者 玛尔扎哈", skin: "Malzahar_38.jpg" },
      { name: "至高天 玛尔扎哈", skin: "Malzahar_39.jpg" },
    ],
    spells: [
      {
        id: "MalzaharP",
        name: "虚空穿越",
        icon: "MalzaharP.png",
        description: "",
      },
      {
        id: "MalzaharQ",
        name: "虚空召唤",
        icon: "MalzaharQ.png",
        description: "",
      },
      {
        id: "MalzaharW",
        name: "虚空虫群",
        icon: "MalzaharW.png",
        description: "",
      },
      {
        id: "MalzaharE",
        name: "煞星幻象",
        icon: "MalzaharE.png",
        description: "",
      },
      {
        id: "MalzaharR",
        name: "冥府之握",
        icon: "MalzaharR.png",
        description: "",
      },
    ],
    effects: {
      MalzaharP: null,
      MalzaharQ: null,
      MalzaharW: null,
      MalzaharE: null,
      MalzaharR: null,
    },
  };
}
export { importModule };
