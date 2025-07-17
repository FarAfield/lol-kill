function importModule() {
  return {
    type: "hero",
    id: "Katarina",
    title: "不祥之刃",
    name: "卡特琳娜",
    avatar: "Katarina.png",
    skins: [
      { name: "default", skin: "Katarina_0.jpg" },
      { name: "赏金猎人 卡特琳娜", skin: "Katarina_1.jpg" },
      { name: "红牌！退场！ 卡特琳娜", skin: "Katarina_2.jpg" },
      { name: "海贼魅影 卡特琳娜", skin: "Katarina_3.jpg" },
      { name: "暗夜猫女 卡特琳娜", skin: "Katarina_4.jpg" },
      { name: "前线指挥官 卡特琳娜", skin: "Katarina_5.jpg" },
      { name: "沙漠风暴 卡特琳娜", skin: "Katarina_6.jpg" },
      { name: "夺命美人 卡特琳娜", skin: "Katarina_7.jpg" },
      { name: "闭月之颜 貂蝉", skin: "Katarina_8.jpg" },
      { name: "源计划：雄心 卡特琳娜", skin: "Katarina_9.jpg" },
      { name: "死亡誓约 卡特琳娜", skin: "Katarina_10.jpg" },
      { name: "战斗学院 卡特琳娜", skin: "Katarina_12.jpg" },
      { name: "腥红之月 卡特琳娜", skin: "Katarina_21.jpg" },
      { name: "女帝 卡特琳娜", skin: "Katarina_29.jpg" },
      { name: "西部魔影 执行人 卡特琳娜", skin: "Katarina_37.jpg" },
      { name: "花仙使者 卡特琳娜", skin: "Katarina_47.jpg" },
      { name: "至臻 花仙使者 卡特琳娜", skin: "Katarina_48.jpg" },
    ],
    spells: [
      { id: "KatarinaP", name: "贪婪", icon: "KatarinaP.png", description: "" },
      {
        id: "KatarinaQ",
        name: "弹射之刃",
        icon: "KatarinaQ.png",
        description: "",
      },
      {
        id: "KatarinaW",
        name: "伺机待发",
        icon: "KatarinaW.png",
        description: "",
      },
      { id: "KatarinaE", name: "瞬步", icon: "KatarinaE.png", description: "" },
      {
        id: "KatarinaR",
        name: "死亡莲华",
        icon: "KatarinaR.png",
        description: "",
      },
    ],
    effects: {
      KatarinaP: null,
      KatarinaQ: null,
      KatarinaW: null,
      KatarinaE: null,
      KatarinaR: null,
    },
  };
}
export { importModule };
