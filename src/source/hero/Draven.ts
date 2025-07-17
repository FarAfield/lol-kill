function importModule() {
  return {
    type: "hero",
    id: "Draven",
    title: "荣耀行刑官",
    name: "德莱文",
    avatar: "Draven.png",
    skins: [
      { name: "default", skin: "Draven_0.jpg" },
      { name: "灵魂收割者 德莱文", skin: "Draven_1.jpg" },
      { name: "绞肉机刽子手 德莱文", skin: "Draven_2.jpg" },
      { name: "金牌主播 德莱文", skin: "Draven_3.jpg" },
      { name: "泳池派对 德莱文", skin: "Draven_4.jpg" },
      { name: "野兽猎人 德莱文", skin: "Draven_5.jpg" },
      { name: "德莱德莱德莱文", skin: "Draven_6.jpg" },
      { name: "圣诞老人 德莱文", skin: "Draven_12.jpg" },
      { name: "王国机神青龙 德莱文", skin: "Draven_13.jpg" },
      { name: "破败军团 德莱文", skin: "Draven_20.jpg" },
      { name: "刃执事 德莱文", skin: "Draven_29.jpg" },
      { name: "魔域梦魇 德莱文", skin: "Draven_39.jpg" },
      { name: "魂蔷薇 德莱文", skin: "Draven_48.jpg" },
    ],
    spells: [
      {
        id: "DravenP",
        name: "德莱文联盟",
        icon: "DravenP.png",
        description: "",
      },
      { id: "DravenQ", name: "旋转飞斧", icon: "DravenQ.png", description: "" },
      { id: "DravenW", name: "血性冲刺", icon: "DravenW.png", description: "" },
      { id: "DravenE", name: "开道利斧", icon: "DravenE.png", description: "" },
      { id: "DravenR", name: "冷血追命", icon: "DravenR.png", description: "" },
    ],
    effects: {
      DravenP: null,
      DravenQ: null,
      DravenW: null,
      DravenE: null,
      DravenR: null,
    },
  };
}
export { importModule };
