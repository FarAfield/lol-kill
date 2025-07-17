function importModule() {
  return {
    type: "hero",
    id: "Mordekaiser",
    title: "铁铠冥魂",
    name: "莫德凯撒",
    avatar: "Mordekaiser.png",
    skins: [
      { name: "default", skin: "Mordekaiser_0.jpg" },
      { name: "龙骑士 莫德凯撒", skin: "Mordekaiser_1.jpg" },
      { name: "地狱火 莫德凯撒", skin: "Mordekaiser_2.jpg" },
      { name: "五杀摇滚吉他手  莫德凯撒", skin: "Mordekaiser_3.jpg" },
      { name: "死亡领主 莫德凯撒", skin: "Mordekaiser_4.jpg" },
      { name: "梅花国王 莫德凯撒", skin: "Mordekaiser_5.jpg" },
      { name: "暗星 莫德凯撒", skin: "Mordekaiser_6.jpg" },
      { name: "源计划：超体 莫德凯撒", skin: "Mordekaiser_13.jpg" },
      { name: "五杀摇滚 III：遗失的章节 莫德凯撒", skin: "Mordekaiser_23.jpg" },
      { name: "西部魔影 地狱列车长 莫德凯撒", skin: "Mordekaiser_32.jpg" },
      { name: "灰烬骑士 莫德凯撒", skin: "Mordekaiser_42.jpg" },
      { name: "古神 莫德凯撒", skin: "Mordekaiser_44.jpg" },
    ],
    spells: [
      {
        id: "MordekaiserP",
        name: "黑暗起兮",
        icon: "MordekaiserP.png",
        description: "",
      },
      {
        id: "MordekaiserQ",
        name: "破灭之锤",
        icon: "MordekaiserQ.png",
        description: "",
      },
      {
        id: "MordekaiserW",
        name: "不坏之身",
        icon: "MordekaiserW.png",
        description: "",
      },
      {
        id: "MordekaiserE",
        name: "断魂一扼",
        icon: "MordekaiserE.png",
        description: "",
      },
      {
        id: "MordekaiserR",
        name: "轮回绝境",
        icon: "MordekaiserR.png",
        description: "",
      },
    ],
    effects: {
      MordekaiserP: null,
      MordekaiserQ: null,
      MordekaiserW: null,
      MordekaiserE: null,
      MordekaiserR: null,
    },
  };
}
export { importModule };
