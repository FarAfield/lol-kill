function importModule() {
  return {
    type: "hero",
    id: "Orianna",
    title: "发条魔灵",
    name: "奥莉安娜",
    avatar: "Orianna.png",
    skins: [
      { name: "default", skin: "Orianna_0.jpg" },
      { name: "哥特女仆 奥莉安娜", skin: "Orianna_1.jpg" },
      { name: "恶灵布偶 奥莉安娜", skin: "Orianna_2.jpg" },
      { name: "灵骨工匠 奥莉安娜", skin: "Orianna_3.jpg" },
      { name: "暗杀星 奥莉安娜", skin: "Orianna_4.jpg" },
      { name: "冬季仙境 奥莉安娜", skin: "Orianna_5.jpg" },
      { name: "觅心魔灵 奥莉安娜", skin: "Orianna_6.jpg" },
      { name: "暗星 奥莉安娜", skin: "Orianna_7.jpg" },
      { name: "胜利女神 奥莉安娜", skin: "Orianna_8.jpg" },
      { name: "泳池派对 奥莉安娜", skin: "Orianna_11.jpg" },
      { name: "小蜜蜂 奥莉安娜", skin: "Orianna_20.jpg" },
      { name: "星之守护者 奥莉安娜", skin: "Orianna_29.jpg" },
      { name: "T1 奥莉安娜", skin: "Orianna_38.jpg" },
    ],
    spells: [
      {
        id: "OriannaP",
        name: "发条协奏",
        icon: "OriannaP.png",
        description: "",
      },
      {
        id: "OriannaQ",
        name: "指令：攻击",
        icon: "OriannaQ.png",
        description: "",
      },
      {
        id: "OriannaW",
        name: "指令：杂音",
        icon: "OriannaW.png",
        description: "",
      },
      {
        id: "OriannaE",
        name: "指令：防卫",
        icon: "OriannaE.png",
        description: "",
      },
      {
        id: "OriannaR",
        name: "指令：冲击波",
        icon: "OriannaR.png",
        description: "",
      },
    ],
    effects: {
      OriannaP: null,
      OriannaQ: null,
      OriannaW: null,
      OriannaE: null,
      OriannaR: null,
    },
  };
}
export { importModule };
