function importModule() {
  return {
    type: "hero",
    id: "Gragas",
    title: "酒桶",
    name: "古拉加斯",
    avatar: "Gragas.png",
    skins: [
      { name: "default", skin: "Gragas_0.jpg" },
      { name: "深潜蛙人 古拉加斯", skin: "Gragas_1.jpg" },
      { name: "乡村农夫 古拉加斯", skin: "Gragas_2.jpg" },
      { name: "圣诞老人 古拉加斯", skin: "Gragas_3.jpg" },
      { name: "品酒大师 古拉加斯", skin: "Gragas_4.jpg" },
      { name: "飞车暴走族 古拉加斯", skin: "Gragas_5.jpg" },
      { name: "美酒节特使 古拉加斯", skin: "Gragas_6.jpg" },
      { name: "狂热球迷 古拉加斯", skin: "Gragas_7.jpg" },
      { name: "Fnatic 古拉加斯", skin: "Gragas_8.jpg" },
      { name: "古拉加斯·碎桶者", skin: "Gragas_9.jpg" },
      { name: "冰原核弹 古拉加斯", skin: "Gragas_10.jpg" },
      { name: "光明骑士 古拉加斯", skin: "Gragas_11.jpg" },
      { name: "太空律动 “电音酒桶” 古拉加斯", skin: "Gragas_20.jpg" },
      { name: "西部魔影 古拉加斯", skin: "Gragas_29.jpg" },
      { name: "超级音乐粉丝 古拉加斯", skin: "Gragas_39.jpg" },
    ],
    spells: [
      { id: "GragasP", name: "欢乐时光", icon: "GragasP.png", description: "" },
      { id: "GragasQ", name: "滚动酒桶", icon: "GragasQ.png", description: "" },
      { id: "GragasW", name: "醉酒狂暴", icon: "GragasW.png", description: "" },
      { id: "GragasE", name: "肉弹冲击", icon: "GragasE.png", description: "" },
      { id: "GragasR", name: "爆破酒桶", icon: "GragasR.png", description: "" },
    ],
    effects: {
      GragasP: null,
      GragasQ: null,
      GragasW: null,
      GragasE: null,
      GragasR: null,
    },
  };
}
export { importModule };
