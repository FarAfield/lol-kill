function importModule() {
  return {
    type: "hero",
    id: "Camille",
    title: "青钢影",
    name: "卡蜜尔",
    avatar: "Camille.png",
    skins: [
      { name: "default", skin: "Camille_0.jpg" },
      { name: "源代码 卡蜜尔", skin: "Camille_1.jpg" },
      { name: "魔女 卡蜜尔", skin: "Camille_2.jpg" },
      { name: "iG 卡蜜尔", skin: "Camille_10.jpg" },
      { name: "莫测之影 卡蜜尔", skin: "Camille_11.jpg" },
      { name: "海珀利安小队 Y03-权天使 卡蜜尔", skin: "Camille_21.jpg" },
      { name: "北极星钢影 卡蜜尔", skin: "Camille_31.jpg" },
      { name: "至臻 北极星钢影 卡蜜尔", skin: "Camille_32.jpg" },
    ],
    spells: [
      {
        id: "CamilleP",
        name: "适应性防御",
        icon: "CamilleP.png",
        description: "",
      },
      {
        id: "CamilleQ",
        name: "精准礼仪",
        icon: "CamilleQ.png",
        description: "",
      },
      {
        id: "CamilleW",
        name: "战术横扫",
        icon: "CamilleW.png",
        description: "",
      },
      { id: "CamilleE", name: "钩索", icon: "CamilleE.png", description: "" },
      {
        id: "CamilleR",
        name: "海克斯最后通牒",
        icon: "CamilleR.png",
        description: "",
      },
    ],
    effects: {
      CamilleP: null,
      CamilleQ: null,
      CamilleW: null,
      CamilleE: null,
      CamilleR: null,
    },
  };
}
export { importModule };
