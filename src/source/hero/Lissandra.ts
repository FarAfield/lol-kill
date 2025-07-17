function importModule() {
  return {
    type: "hero",
    id: "Lissandra",
    title: "冰霜女巫",
    name: "丽桑卓",
    avatar: "Lissandra.png",
    skins: [
      { name: "default", skin: "Lissandra_0.jpg" },
      { name: "血石妖后 丽桑卓", skin: "Lissandra_1.jpg" },
      { name: "刀锋女王 丽桑卓", skin: "Lissandra_2.jpg" },
      { name: "源代码 丽桑卓", skin: "Lissandra_3.jpg" },
      { name: "魔女 丽桑卓", skin: "Lissandra_4.jpg" },
      { name: "暗星女王 丽桑卓", skin: "Lissandra_12.jpg" },
      { name: "青花瓷 丽桑卓", skin: "Lissandra_23.jpg" },
      { name: "至臻 青花瓷 丽桑卓", skin: "Lissandra_33.jpg" },
      { name: "太空律动 “噪音女王” 丽桑卓", skin: "Lissandra_34.jpg" },
    ],
    spells: [
      {
        id: "LissandraP",
        name: "冰脉驱役",
        icon: "LissandraP.png",
        description: "",
      },
      {
        id: "LissandraQ",
        name: "寒冰碎片",
        icon: "LissandraQ.png",
        description: "",
      },
      {
        id: "LissandraW",
        name: "冰霜之环",
        icon: "LissandraW.png",
        description: "",
      },
      {
        id: "LissandraE",
        name: "冰川之径",
        icon: "LissandraE.png",
        description: "",
      },
      {
        id: "LissandraR",
        name: "冰封陵墓",
        icon: "LissandraR.png",
        description: "",
      },
    ],
    effects: {
      LissandraP: null,
      LissandraQ: null,
      LissandraW: null,
      LissandraE: null,
      LissandraR: null,
    },
  };
}
export { importModule };
