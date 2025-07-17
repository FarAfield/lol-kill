function importModule() {
  return {
    type: "hero",
    id: "Veigar",
    title: "邪恶小法师",
    name: "维迦",
    avatar: "Veigar.png",
    skins: [
      { name: "default", skin: "Veigar_0.jpg" },
      { name: "白魔法师 维迦", skin: "Veigar_1.jpg" },
      { name: "冰壶选手 维迦", skin: "Veigar_2.jpg" },
      { name: "灰胡子魔法师 维迦", skin: "Veigar_3.jpg" },
      { name: "绿野仙踪 维迦", skin: "Veigar_4.jpg" },
      { name: "魔导绅士 维迦", skin: "Veigar_5.jpg" },
      { name: "穿着正装的恶魔 维迦", skin: "Veigar_6.jpg" },
      { name: "邪恶圣诞老人 维迦", skin: "Veigar_7.jpg" },
      { name: "最终BOSS 维迦", skin: "Veigar_8.jpg" },
      { name: "欧米伽小队 天雷爆破手", skin: "Veigar_9.jpg" },
      { name: "永恒之森 维迦", skin: "Veigar_13.jpg" },
      { name: "我，怒角 维迦", skin: "Veigar_23.jpg" },
      { name: "宇航员 维迦", skin: "Veigar_32.jpg" },
      { name: "小怪兽训练师 维迦", skin: "Veigar_41.jpg" },
      { name: "蜂大王 维迦", skin: "Veigar_51.jpg" },
      { name: "魔域梦魇 维迦", skin: "Veigar_60.jpg" },
    ],
    spells: [
      { id: "VeigarP", name: "超凡邪力", icon: "VeigarP.png", description: "" },
      { id: "VeigarQ", name: "黑暗祭祀", icon: "VeigarQ.png", description: "" },
      { id: "VeigarW", name: "黑暗物质", icon: "VeigarW.png", description: "" },
      { id: "VeigarE", name: "扭曲空间", icon: "VeigarE.png", description: "" },
      { id: "VeigarR", name: "能量爆裂", icon: "VeigarR.png", description: "" },
    ],
    effects: {
      VeigarP: null,
      VeigarQ: null,
      VeigarW: null,
      VeigarE: null,
      VeigarR: null,
    },
  };
}
export { importModule };
