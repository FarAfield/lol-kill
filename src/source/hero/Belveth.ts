function importModule() {
  return {
    type: "hero",
    id: "Belveth",
    title: "虚空女皇",
    name: "卑尔维斯",
    avatar: "Belveth.png",
    skins: [
      { name: "default", skin: "Belveth_0.jpg" },
      { name: "战场BOSS 卑尔维斯", skin: "Belveth_1.jpg" },
      { name: "星界女神 卑尔维斯", skin: "Belveth_10.jpg" },
      { name: "海魔女 卑尔维斯", skin: "Belveth_19.jpg" },
    ],
    spells: [
      {
        id: "BelvethP",
        name: "溶烛化紫 ",
        icon: "BelvethP.png",
        description: "",
      },
      {
        id: "BelvethQ",
        name: "虚空激流",
        icon: "BelvethQ.png",
        description: "",
      },
      {
        id: "BelvethW",
        name: "上觐沉渊",
        icon: "BelvethW.png",
        description: "",
      },
      {
        id: "BelvethE",
        name: "搠面皇锋",
        icon: "BelvethE.png",
        description: "",
      },
      {
        id: "BelvethR",
        name: "万载豪筵",
        icon: "BelvethR.png",
        description: "",
      },
    ],
    effects: {
      BelvethP: null,
      BelvethQ: null,
      BelvethW: null,
      BelvethE: null,
      BelvethR: null,
    },
  };
}
export { importModule };
