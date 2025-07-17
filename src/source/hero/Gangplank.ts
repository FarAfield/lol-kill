function importModule() {
  return {
    type: "hero",
    id: "Gangplank",
    title: "海洋之灾",
    name: "普朗克",
    avatar: "Gangplank.png",
    skins: [
      { name: "default", skin: "Gangplank_0.jpg" },
      { name: "幽灵船长 普朗克", skin: "Gangplank_1.jpg" },
      { name: "老兵 普朗克", skin: "Gangplank_2.jpg" },
      { name: "大力水手 普朗克", skin: "Gangplank_3.jpg" },
      { name: "英勇玩具兵 普朗克", skin: "Gangplank_4.jpg" },
      { name: "特种部队 普朗克", skin: "Gangplank_5.jpg" },
      { name: "奥斯曼大帝 普朗克", skin: "Gangplank_6.jpg" },
      { name: "昔日霸主 普朗克", skin: "Gangplank_7.jpg" },
      { name: "恐惧新星 普朗克", skin: "Gangplank_8.jpg" },
      { name: "泳池派对 普朗克", skin: "Gangplank_14.jpg" },
      { name: "FPX 普朗克", skin: "Gangplank_21.jpg" },
      { name: "背叛之刃 普朗克", skin: "Gangplank_23.jpg" },
      { name: "源计划：铁腕 普朗克", skin: "Gangplank_33.jpg" },
    ],
    spells: [
      {
        id: "GangplankP",
        name: "烈火审讯",
        icon: "GangplankP.png",
        description: "",
      },
      {
        id: "GangplankQ",
        name: "枪火谈判",
        icon: "GangplankQ.png",
        description: "",
      },
      {
        id: "GangplankW",
        name: "坏血病疗法",
        icon: "GangplankW.png",
        description: "",
      },
      {
        id: "GangplankE",
        name: "火药桶",
        icon: "GangplankE.png",
        description: "",
      },
      {
        id: "GangplankR",
        name: "加农炮幕",
        icon: "GangplankR.png",
        description: "",
      },
    ],
    effects: {
      GangplankP: null,
      GangplankQ: null,
      GangplankW: null,
      GangplankE: null,
      GangplankR: null,
    },
  };
}
export { importModule };
