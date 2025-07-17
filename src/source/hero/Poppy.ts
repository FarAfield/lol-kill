function importModule() {
  return {
    type: "hero",
    id: "Poppy",
    title: "圣锤之毅",
    name: "波比",
    avatar: "Poppy.png",
    skins: [
      { name: "default", skin: "Poppy_0.jpg" },
      { name: "诺克萨斯 波比", skin: "Poppy_1.jpg" },
      { name: "波比的巧克力工坊", skin: "Poppy_2.jpg" },
      { name: "宗师级锻造训练师", skin: "Poppy_3.jpg" },
      { name: "圣诞玩偶 波比", skin: "Poppy_4.jpg" },
      { name: "军神战甲 波比", skin: "Poppy_5.jpg" },
      { name: "血色之锤 波比", skin: "Poppy_6.jpg" },
      { name: "星之守护者 波比", skin: "Poppy_7.jpg" },
      { name: "冰雪驯鹿 波比", skin: "Poppy_14.jpg" },
      { name: "海克斯科技 波比", skin: "Poppy_15.jpg" },
      { name: "宇航员 波比", skin: "Poppy_16.jpg" },
      { name: "魅惑女巫 波比", skin: "Poppy_24.jpg" },
      { name: "咖啡甜心 波比", skin: "Poppy_33.jpg" },
    ],
    spells: [
      { id: "PoppyP", name: "钢铁大使", icon: "PoppyP.png", description: "" },
      { id: "PoppyQ", name: "圣锤猛击", icon: "PoppyQ.png", description: "" },
      { id: "PoppyW", name: "坚定风采", icon: "PoppyW.png", description: "" },
      { id: "PoppyE", name: "英勇冲锋", icon: "PoppyE.png", description: "" },
      { id: "PoppyR", name: "持卫的裁决", icon: "PoppyR.png", description: "" },
    ],
    effects: {
      PoppyP: null,
      PoppyQ: null,
      PoppyW: null,
      PoppyE: null,
      PoppyR: null,
    },
  };
}
export { importModule };
