function importModule() {
  return {
    type: "hero",
    id: "Shyvana",
    title: "龙血武姬",
    name: "希瓦娜",
    avatar: "Shyvana.png",
    skins: [
      { name: "default", skin: "Shyvana_0.jpg" },
      { name: "钢之逆鳞 希瓦娜", skin: "Shyvana_1.jpg" },
      { name: "骸骨之爪 希瓦娜", skin: "Shyvana_2.jpg" },
      { name: "黯黑魔龙 希瓦娜", skin: "Shyvana_3.jpg" },
      { name: "冰霜亚龙 希瓦娜", skin: "Shyvana_4.jpg" },
      { name: "冠军之血 希瓦娜", skin: "Shyvana_5.jpg" },
      { name: "银河魔装机神 希瓦娜", skin: "Shyvana_6.jpg" },
      { name: "破败军团 希瓦娜", skin: "Shyvana_8.jpg" },
      { name: "玉剑传说 舞龙卫", skin: "Shyvana_17.jpg" },
    ],
    spells: [
      {
        id: "ShyvanaP",
        name: "龙族之怒",
        icon: "ShyvanaP.png",
        description: "",
      },
      {
        id: "ShyvanaQ",
        name: "龙牙突刺",
        icon: "ShyvanaQ.png",
        description: "",
      },
      {
        id: "ShyvanaW",
        name: "烈火燎原",
        icon: "ShyvanaW.png",
        description: "",
      },
      {
        id: "ShyvanaE",
        name: "烈焰吐息",
        icon: "ShyvanaE.png",
        description: "",
      },
      {
        id: "ShyvanaR",
        name: "魔龙降世",
        icon: "ShyvanaR.png",
        description: "",
      },
    ],
    effects: {
      ShyvanaP: null,
      ShyvanaQ: null,
      ShyvanaW: null,
      ShyvanaE: null,
      ShyvanaR: null,
    },
  };
}
export { importModule };
