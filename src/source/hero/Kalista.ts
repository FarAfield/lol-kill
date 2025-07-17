function importModule() {
  return {
    type: "hero",
    id: "Kalista",
    title: "复仇之矛",
    name: "卡莉丝塔",
    avatar: "Kalista.png",
    skins: [
      { name: "default", skin: "Kalista_0.jpg" },
      { name: "腥红之月 卡莉丝塔", skin: "Kalista_1.jpg" },
      { name: "冠军之矛 卡莉丝塔", skin: "Kalista_2.jpg" },
      { name: "SKT T1 卡莉丝塔", skin: "Kalista_3.jpg" },
      { name: "黑暗骑士 卡莉丝塔", skin: "Kalista_5.jpg" },
      { name: "花仙骑士 卡莉丝塔", skin: "Kalista_14.jpg" },
    ],
    spells: [
      {
        id: "KalistaP",
        name: "武术姿态",
        icon: "KalistaP.png",
        description: "",
      },
      { id: "KalistaQ", name: "穿刺", icon: "KalistaQ.png", description: "" },
      { id: "KalistaW", name: "哨兵", icon: "KalistaW.png", description: "" },
      { id: "KalistaE", name: "撕裂", icon: "KalistaE.png", description: "" },
      {
        id: "KalistaR",
        name: "命运的召唤",
        icon: "KalistaR.png",
        description: "",
      },
    ],
    effects: {
      KalistaP: null,
      KalistaQ: null,
      KalistaW: null,
      KalistaE: null,
      KalistaR: null,
    },
  };
}
export { importModule };
