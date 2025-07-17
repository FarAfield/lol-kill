function importModule() {
  return {
    type: "hero",
    id: "Cassiopeia",
    title: "魔蛇之拥",
    name: "卡西奥佩娅",
    avatar: "Cassiopeia.png",
    skins: [
      { name: "default", skin: "Cassiopeia_0.jpg" },
      { name: "荒漠之咬 卡西奥佩娅", skin: "Cassiopeia_1.jpg" },
      { name: "深海妖姬 卡西奥佩娅", skin: "Cassiopeia_2.jpg" },
      { name: "蛇发女妖 卡西奥佩娅", skin: "Cassiopeia_3.jpg" },
      { name: "碧玉之牙 卡西奥佩娅", skin: "Cassiopeia_4.jpg" },
      { name: "上古魔蛇 卡西奥佩娅", skin: "Cassiopeia_8.jpg" },
      { name: "灵魂莲华 卡西奥佩娅", skin: "Cassiopeia_9.jpg" },
      { name: "魔女 卡西奥佩娅", skin: "Cassiopeia_18.jpg" },
      { name: "魅惑女巫 卡西奥佩娅", skin: "Cassiopeia_28.jpg" },
    ],
    spells: [
      {
        id: "CassiopeiaP",
        name: "优雅蛇行",
        icon: "CassiopeiaP.png",
        description: "",
      },
      {
        id: "CassiopeiaQ",
        name: "瘟毒爆炸",
        icon: "CassiopeiaQ.png",
        description: "",
      },
      {
        id: "CassiopeiaW",
        name: "剧毒迷雾",
        icon: "CassiopeiaW.png",
        description: "",
      },
      {
        id: "CassiopeiaE",
        name: "双生毒牙",
        icon: "CassiopeiaE.png",
        description: "",
      },
      {
        id: "CassiopeiaR",
        name: "石化凝视",
        icon: "CassiopeiaR.png",
        description: "",
      },
    ],
    effects: {
      CassiopeiaP: null,
      CassiopeiaQ: null,
      CassiopeiaW: null,
      CassiopeiaE: null,
      CassiopeiaR: null,
    },
  };
}
export { importModule };
