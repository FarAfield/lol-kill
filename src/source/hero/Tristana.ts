function importModule() {
  return {
    type: "hero",
    id: "Tristana",
    title: "麦林炮手",
    name: "崔丝塔娜",
    avatar: "Tristana.png",
    skins: [
      { name: "default", skin: "Tristana_0.jpg" },
      { name: "粉色萝莉 崔丝塔娜", skin: "Tristana_1.jpg" },
      { name: "圣诞精灵 崔丝塔娜 ", skin: "Tristana_2.jpg" },
      { name: "烈焰雄心 崔丝塔娜", skin: "Tristana_3.jpg" },
      { name: "游击队员 崔丝塔娜", skin: "Tristana_4.jpg" },
      { name: "约德尔海贼团 崔丝塔娜", skin: "Tristana_5.jpg" },
      { name: "火箭达人 崔丝塔娜", skin: "Tristana_6.jpg" },
      { name: "驯龙炮手 崔丝塔娜", skin: "Tristana_10.jpg" },
      { name: "魅惑女巫 崔丝塔娜", skin: "Tristana_11.jpg" },
      { name: "欧米伽小队 魔鬼伞兵", skin: "Tristana_12.jpg" },
      { name: "小恶魔 崔丝塔娜", skin: "Tristana_24.jpg" },
      { name: "我，羽饰骑士 崔丝塔娜", skin: "Tristana_33.jpg" },
      { name: "海克斯科技 崔丝塔娜", skin: "Tristana_40.jpg" },
      { name: "虎头虎脑 崔丝塔娜", skin: "Tristana_41.jpg" },
      { name: "灵魂莲华 崔丝塔娜", skin: "Tristana_51.jpg" },
      { name: "花仙子 崔丝塔娜", skin: "Tristana_61.jpg" },
    ],
    spells: [
      { id: "TristanaP", name: "瞄准", icon: "TristanaP.png", description: "" },
      {
        id: "TristanaQ",
        name: "急速射击",
        icon: "TristanaQ.png",
        description: "",
      },
      {
        id: "TristanaW",
        name: "火箭跳跃",
        icon: "TristanaW.png",
        description: "",
      },
      {
        id: "TristanaE",
        name: "爆炸火花",
        icon: "TristanaE.png",
        description: "",
      },
      {
        id: "TristanaR",
        name: "毁灭射击",
        icon: "TristanaR.png",
        description: "",
      },
    ],
    effects: {
      TristanaP: null,
      TristanaQ: null,
      TristanaW: null,
      TristanaE: null,
      TristanaR: null,
    },
  };
}
export { importModule };
