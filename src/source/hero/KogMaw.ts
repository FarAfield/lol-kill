function importModule() {
  return {
    type: "hero",
    id: "KogMaw",
    title: "深渊巨口",
    name: "克格莫",
    avatar: "KogMaw.png",
    skins: [
      { name: "default", skin: "KogMaw_0.jpg" },
      { name: "毛毛虫 克格莫", skin: "KogMaw_1.jpg" },
      { name: "索诺拉沙虫 克格莫", skin: "KogMaw_2.jpg" },
      { name: "帝王斑蝶 克格莫", skin: "KogMaw_3.jpg" },
      { name: "圣诞驯鹿 克格莫", skin: "KogMaw_4.jpg" },
      { name: "醒狮 克格莫", skin: "KogMaw_5.jpg" },
      { name: "深海怪鱼 克格莫", skin: "KogMaw_6.jpg" },
      { name: "侏罗纪化石 克格莫", skin: "KogMaw_7.jpg" },
      { name: "战地机甲 克格莫", skin: "KogMaw_8.jpg" },
      { name: "克格汪", skin: "KogMaw_9.jpg" },
      { name: "海克斯科技 克格莫", skin: "KogMaw_10.jpg" },
      { name: "奥术师 克格莫", skin: "KogMaw_19.jpg" },
      { name: "小蜜蜂 克格莫", skin: "KogMaw_28.jpg" },
      { name: "电格莫", skin: "KogMaw_37.jpg" },
      { name: "山海绘卷 克格莫", skin: "KogMaw_46.jpg" },
      { name: "胜利巨口 克格莫", skin: "KogMaw_55.jpg" },
    ],
    spells: [
      {
        id: "KogMawP",
        name: "来自艾卡西亚的惊喜",
        icon: "KogMawP.png",
        description: "",
      },
      { id: "KogMawQ", name: "腐蚀唾液", icon: "KogMawQ.png", description: "" },
      { id: "KogMawW", name: "生化弹幕", icon: "KogMawW.png", description: "" },
      { id: "KogMawE", name: "虚空淤泥", icon: "KogMawE.png", description: "" },
      { id: "KogMawR", name: "活体大炮", icon: "KogMawR.png", description: "" },
    ],
    effects: {
      KogMawP: null,
      KogMawQ: null,
      KogMawW: null,
      KogMawE: null,
      KogMawR: null,
    },
  };
}
export { importModule };
