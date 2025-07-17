function importModule() {
  return {
    type: "hero",
    id: "Trundle",
    title: "巨魔之王",
    name: "特朗德尔",
    avatar: "Trundle.png",
    skins: [
      { name: "default", skin: "Trundle_0.jpg" },
      { name: "里尔击球手  特朗德尔", skin: "Trundle_1.jpg" },
      { name: "垃圾场  特朗德尔", skin: "Trundle_2.jpg" },
      { name: "传统造型 特朗德尔", skin: "Trundle_3.jpg" },
      { name: "巡逻警官 特朗德尔", skin: "Trundle_4.jpg" },
      { name: "创世之神 特朗德尔", skin: "Trundle_5.jpg" },
      { name: "屠龙勇士 特朗德尔", skin: "Trundle_6.jpg" },
      { name: "魔域梦魇 特朗德尔", skin: "Trundle_12.jpg" },
      { name: "超级电竞粉丝 特朗德尔", skin: "Trundle_21.jpg" },
    ],
    spells: [
      {
        id: "TrundleP",
        name: "国王的贡品",
        icon: "TrundleP.png",
        description: "",
      },
      {
        id: "TrundleQ",
        name: "利齿撕咬",
        icon: "TrundleQ.png",
        description: "",
      },
      {
        id: "TrundleW",
        name: "冰封领域",
        icon: "TrundleW.png",
        description: "",
      },
      {
        id: "TrundleE",
        name: "寒冰之柱",
        icon: "TrundleE.png",
        description: "",
      },
      {
        id: "TrundleR",
        name: "强权至上",
        icon: "TrundleR.png",
        description: "",
      },
    ],
    effects: {
      TrundleP: null,
      TrundleQ: null,
      TrundleW: null,
      TrundleE: null,
      TrundleR: null,
    },
  };
}
export { importModule };
