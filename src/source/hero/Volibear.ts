function importModule() {
  return {
    type: "hero",
    id: "Volibear",
    title: "不灭狂雷",
    name: "沃利贝尔",
    avatar: "Volibear.png",
    skins: [
      { name: "default", skin: "Volibear_0.jpg" },
      { name: "雷霆领主 沃利贝尔", skin: "Volibear_1.jpg" },
      { name: "北地风暴 沃利贝尔", skin: "Volibear_2.jpg" },
      { name: "符文战熊 沃利贝尔", skin: "Volibear_3.jpg" },
      { name: "警长 沃利贝尔", skin: "Volibear_4.jpg" },
      { name: "怒熊 沃利贝尔", skin: "Volibear_5.jpg" },
      { name: "坚韧不屈 沃利贝尔", skin: "Volibear_6.jpg" },
      { name: "神龙尊者 均衡之龙 沃利贝尔", skin: "Volibear_7.jpg" },
      { name: "至臻 神龙尊者 均衡之龙 沃利贝尔", skin: "Volibear_9.jpg" },
      { name: "墨影之灵 沃利贝尔", skin: "Volibear_19.jpg" },
    ],
    spells: [
      {
        id: "VolibearP",
        name: "狂雷渐起",
        icon: "VolibearP.png",
        description: "",
      },
      {
        id: "VolibearQ",
        name: "擂首一击",
        icon: "VolibearQ.png",
        description: "",
      },
      {
        id: "VolibearW",
        name: "暴怒撕咬",
        icon: "VolibearW.png",
        description: "",
      },
      {
        id: "VolibearE",
        name: "霹天雳地",
        icon: "VolibearE.png",
        description: "",
      },
      {
        id: "VolibearR",
        name: "天声震落",
        icon: "VolibearR.png",
        description: "",
      },
    ],
    effects: {
      VolibearP: null,
      VolibearQ: null,
      VolibearW: null,
      VolibearE: null,
      VolibearR: null,
    },
  };
}
export { importModule };
